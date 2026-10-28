<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Modules\Content\Settings\SettingSchemas;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * `PATCH /api/admin/settings`: `{ "<chave>": <valor completo>, … }`. Só as chaves enviadas são validadas, cada uma pelo
 * seu schema (`SettingSchemas`). A `pix` é recusada aqui (BR-060): ela tem rota própria, com reconfirmação de senha.
 */
final class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return ['pix' => ['prohibited']] + SettingSchemas::rules(array_keys($this->all()));
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return SettingSchemas::messages() + ['pix.prohibited' => __('errors.settings_pix_forbidden')];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $sent = array_keys($this->all());

                if ($sent === []) {
                    $validator->errors()->add('settings', __('errors.settings_empty'));
                }

                foreach (array_diff($sent, SettingSchemas::KEYS, ['pix']) as $unknown) {
                    $validator->errors()->add((string) $unknown, __('errors.settings_unknown_key'));
                }

                // Um aviso ligado sem texto apareceria como uma faixa vazia no site
                foreach (['campaign_notice', 'lords_supper_notice'] as $notice) {
                    $value = $this->input($notice);
                    if (is_array($value) && ($value['active'] ?? false) && trim((string) ($value['text'] ?? '')) === '') {
                        $validator->errors()->add("{$notice}.text", __('errors.settings_notice_text_required'));
                    }
                }
            },
        ];
    }

    /**
     * As chaves enviadas, no formato que vai para o banco.
     *
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach ($this->validated() as $key => $value) {
            $changes[(string) $key] = SettingSchemas::normalize((string) $key, $value);
        }

        return $changes;
    }
}
