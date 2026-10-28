<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Events\PixSettingsChanged;
use App\Modules\Content\Models\SiteSetting;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\StoredFile;
use App\Modules\Platform\Files\UploadKind;
use App\Modules\Platform\Files\UploadStore;
use App\Shared\Http\BusinessRuleException;
use App\Shared\Http\TooManyAttemptsException;
use App\Shared\Http\UnprocessableRuleException;
use App\Shared\ValueObjects\Cnpj;
use App\Shared\ValueObjects\InvalidValueObject;
use App\Shared\ValueObjects\PixCopyPasteCode;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Altera os dados PIX (CAP-18). A ordem importa e é a da arquitetura:
 *
 *  1. a senha do operador, reconfirmada na própria requisição (BR-060); errar não revela nada dos outros campos;
 *  2. os destinatários do alerta, que vêm do `.env` e não do painel (BR-063): sem eles, nada muda;
 *  3. os campos (CNPJ, Copia e Cola) e o QR Code, que passa pelo `UploadStore` (BR-061, BR-062, BR-045);
 *  4. a gravação, o evento (auditoria e alerta na mesma transação) e o snapshot público.
 *
 * Só a chave `pix` da tabela `site_settings` é gravada. O QR anterior é apagado do disco depois da confirmação.
 */
final class UpdatePixSettings
{
    private const MAX_PASSWORD_FAILURES = 5;

    private const LOCK_SECONDS = 900;

    public function __construct(private readonly UploadStore $uploads) {}

    /**
     * @param  array{pix_key: string, beneficiary_name: string, copy_paste_code?: string|null, current_password: string}  $input
     * @return array{pix_key: string, beneficiary_name: string, qr_image_path: string|null, copy_paste_code: string|null}
     */
    public function __invoke(User $actor, array $input, ?UploadedFile $qrImage): array
    {
        $this->confirmPassword($actor, $input['current_password']);
        $this->ensureAlertRecipients();

        [$key, $beneficiary, $code] = $this->validatedFields($input);

        /** @var SiteSetting $setting */
        $setting = SiteSetting::query()->findOrFail('pix');
        $current = $this->currentValue($setting);

        if ($qrImage === null && $current['qr_image_path'] === null) {
            throw ValidationException::withMessages(['qr_image' => [__('errors.pix_qr_required')]]);
        }

        $stored = $qrImage === null ? null : $this->uploads->store($qrImage, UploadKind::PixQr, 'qr_image');

        try {
            $new = DB::transaction(fn (): array => $this->save($actor, $current, $key, $beneficiary, $code, $stored));
        } catch (Throwable $e) {
            if ($stored !== null) {
                $this->uploads->delete($stored->path);
            }

            throw $e;
        }

        if ($stored !== null && $current['qr_image_path'] !== null) {
            $this->uploads->delete($current['qr_image_path']);
        }

        return $new;
    }

    private function confirmPassword(User $actor, string $password): void
    {
        $bucket = 'pix-password:'.$actor->getKey();

        if (RateLimiter::tooManyAttempts($bucket, self::MAX_PASSWORD_FAILURES)) {
            throw new TooManyAttemptsException(__('errors.too_many_requests'), RateLimiter::availableIn($bucket));
        }

        if (! Hash::check($password, $actor->password)) {
            RateLimiter::hit($bucket, self::LOCK_SECONDS);
            Log::warning('pix.password_failed', ['userId' => $actor->getKey()]);

            throw new UnprocessableRuleException('PASSWORD_CONFIRMATION_FAILED', __('business.BR-060'), [
                ['field' => 'current_password', 'code' => 'password_confirmation_failed', 'message' => __('business.BR-060')],
            ]);
        }

        RateLimiter::clear($bucket);
    }

    private function ensureAlertRecipients(): void
    {
        if ((array) config('pibls.pix_alert_recipients', []) === []) {
            throw new BusinessRuleException('PIX_ALERT_NOT_CONFIGURED', __('business.BR-063'));
        }
    }

    /**
     * @param  array{pix_key: string, beneficiary_name: string, copy_paste_code?: string|null}  $input
     * @return array{0: Cnpj, 1: string, 2: PixCopyPasteCode|null}
     */
    private function validatedFields(array $input): array
    {
        $errors = [];
        $key = null;

        try {
            $key = Cnpj::from($input['pix_key']);
        } catch (InvalidValueObject) {
            $errors['pix_key'] = [__('business.BR-061')];
        }

        $rawCode = trim((string) ($input['copy_paste_code'] ?? ''));
        $code = null;
        if ($rawCode !== '') {
            try {
                $code = PixCopyPasteCode::from($rawCode);
            } catch (InvalidValueObject) {
                $errors['copy_paste_code'] = [__('business.BR-062')];
            }
        }

        if ($key === null || $errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [$key, trim($input['beneficiary_name']), $code];
    }

    /**
     * @param  array{pix_key: string, beneficiary_name: string, qr_image_path: string|null, copy_paste_code: string|null}  $current
     * @return array{pix_key: string, beneficiary_name: string, qr_image_path: string|null, copy_paste_code: string|null}
     */
    private function save(User $actor, array $current, Cnpj $key, string $beneficiary, ?PixCopyPasteCode $code, ?StoredFile $stored): array
    {
        $new = [
            'pix_key' => $key->digits(),
            'beneficiary_name' => $beneficiary,
            'qr_image_path' => $stored === null ? $current['qr_image_path'] : $stored->path,
            'copy_paste_code' => $code === null ? null : (string) $code,
        ];

        $changed = array_keys(array_filter([
            'pix_key' => $new['pix_key'] !== $current['pix_key'],
            'beneficiary_name' => $new['beneficiary_name'] !== $current['beneficiary_name'],
            'qr_image' => $stored !== null,
            'copy_paste_code' => $new['copy_paste_code'] !== $current['copy_paste_code'],
        ]));

        // Mesmos dados e nenhum QR novo: nada a gravar, nada a auditar, e o alerta não dispara à toa
        if ($changed === []) {
            return $current;
        }

        $setting = SiteSetting::query()->lockForUpdate()->findOrFail('pix');
        $setting->forceFill(['value' => $new, 'updated_by' => $actor->getKey()])->save();

        event(new PixSettingsChanged(
            (int) $actor->getKey(),
            $actor->name,
            $this->summary($current),
            $this->summary($new),
            $changed,
            CarbonImmutable::now('UTC'),
        ));
        event(new PublicContentChanged(['settings']));

        return $new;
    }

    /**
     * @param  array<string, mixed>  $value
     * @return array{pix_key: string, beneficiary_name: string, has_qr_image: bool, has_copy_paste_code: bool}
     */
    private function summary(array $value): array
    {
        return [
            'pix_key' => (string) $value['pix_key'],
            'beneficiary_name' => (string) $value['beneficiary_name'],
            'has_qr_image' => ! empty($value['qr_image_path']),
            'has_copy_paste_code' => ! empty($value['copy_paste_code']),
        ];
    }

    /**
     * @return array{pix_key: string, beneficiary_name: string, qr_image_path: string|null, copy_paste_code: string|null}
     */
    private function currentValue(SiteSetting $setting): array
    {
        $value = $setting->value;

        return [
            'pix_key' => (string) ($value['pix_key'] ?? ''),
            'beneficiary_name' => (string) ($value['beneficiary_name'] ?? ''),
            'qr_image_path' => isset($value['qr_image_path']) && $value['qr_image_path'] !== '' ? (string) $value['qr_image_path'] : null,
            'copy_paste_code' => isset($value['copy_paste_code']) && $value['copy_paste_code'] !== '' ? (string) $value['copy_paste_code'] : null,
        ];
    }
}
