<?php

declare(strict_types=1);

namespace App\Modules\Content\Settings;

use App\Shared\Validation\ValidPhone;
use App\Shared\ValueObjects\EmailAddress;
use App\Shared\ValueObjects\PhoneNumber;
use Closure;

/**
 * O schema de cada chave de `site_settings` que a Secretaria edita (architecture.md → site_settings, CAP-17). A chave
 * `pix` não está aqui: ela só muda por `POST /api/admin/settings/pix`, com reconfirmação de senha (BR-060).
 *
 * Cada chave é enviada inteira e substitui a anterior. As regras valem para a forma (tamanhos, formatos, `https`);
 * `normalize()` devolve o valor que vai para o banco, já limpo (espaços, CEP só com dígitos, UF em maiúsculas,
 * telefone em E.164, e-mails em minúsculas e sem repetição).
 */
final class SettingSchemas
{
    /** @var list<string> as chaves que o painel de configurações edita */
    public const KEYS = [
        'schedule', 'campaign_notice', 'lords_supper_notice', 'address', 'map_links', 'whatsapp', 'youtube_links',
        'social_links', 'notification_recipients',
    ];

    /** A única chave que não é pública (BR-050). */
    public const PRIVATE_KEY = 'notification_recipients';

    /** @var list<string> os tipos de contato que têm lista de destinatários (`LeadType`) */
    public const LEAD_TYPES = ['VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO', 'MINISTERIO'];

    public const MAX_SCHEDULE_ITEMS = 20;

    public const MAX_SOCIAL_LINKS = 10;

    public const MAX_RECIPIENTS = 10;

    private const TIME = '/^([01]\d|2[0-3]):[0-5]\d$/';

    private const ZIP = '/^\d{5}-?\d{3}$/';

    /**
     * @param  list<string>  $keys  as chaves enviadas; só elas são validadas
     * @return array<string, list<mixed>>
     */
    public static function rules(array $keys): array
    {
        $rules = [];

        foreach (array_intersect($keys, self::KEYS) as $key) {
            $rules += match ($key) {
                'schedule' => [
                    'schedule' => ['required', 'array', 'max:'.self::MAX_SCHEDULE_ITEMS],
                    'schedule.*' => ['required', 'array'],
                    'schedule.*.day' => ['required', 'string', 'max:40'],
                    'schedule.*.recurrence' => ['nullable', 'string', 'max:60'],
                    'schedule.*.activity' => ['required', 'string', 'max:80'],
                    'schedule.*.time' => ['required', 'string', 'regex:'.self::TIME],
                    'schedule.*.mode' => ['nullable', 'string', 'max:80'],
                ],
                'campaign_notice' => [
                    'campaign_notice' => ['required', 'array'],
                    'campaign_notice.active' => ['required', 'boolean'],
                    'campaign_notice.title' => ['nullable', 'string', 'max:80'],
                    'campaign_notice.text' => ['present', 'nullable', 'string', 'max:500'],
                ],
                'lords_supper_notice' => [
                    'lords_supper_notice' => ['required', 'array'],
                    'lords_supper_notice.active' => ['required', 'boolean'],
                    'lords_supper_notice.text' => ['present', 'nullable', 'string', 'max:300'],
                ],
                'address' => [
                    'address' => ['required', 'array'],
                    'address.street' => ['required', 'string', 'max:120'],
                    'address.number' => ['required', 'string', 'max:20'],
                    'address.complement' => ['nullable', 'string', 'max:80'],
                    'address.neighborhood' => ['required', 'string', 'max:80'],
                    'address.city' => ['required', 'string', 'max:80'],
                    'address.state' => ['required', 'string', 'regex:/^[A-Za-z]{2}$/'],
                    'address.zip' => ['required', 'string', 'regex:'.self::ZIP],
                ],
                'map_links' => [
                    'map_links' => ['required', 'array'],
                    'map_links.google_maps_url' => ['nullable', 'string', 'max:500', 'url:https'],
                    'map_links.waze_url' => ['nullable', 'string', 'max:500', 'url:https'],
                    'map_links.embed_url' => ['nullable', 'string', 'max:1000', 'url:https'],
                ],
                'whatsapp' => [
                    'whatsapp' => ['required', 'array'],
                    'whatsapp.phone' => ['required', 'string', new ValidPhone],
                    'whatsapp.default_text' => ['nullable', 'string', 'max:200'],
                ],
                'youtube_links' => [
                    'youtube_links' => ['required', 'array'],
                    'youtube_links.channel_url' => ['nullable', 'string', 'max:500', 'url:https'],
                    'youtube_links.live_url' => ['nullable', 'string', 'max:500', 'url:https'],
                ],
                'social_links' => [
                    'social_links' => ['present', 'array', 'max:'.self::MAX_SOCIAL_LINKS],
                    'social_links.*' => ['required', 'array'],
                    'social_links.*.network' => ['required', 'string', 'max:30'],
                    'social_links.*.url' => ['required', 'string', 'max:500', 'url:https'],
                ],
                'notification_recipients' => self::recipientRules(),
                default => [],
            };
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        $messages = [
            'schedule.max' => 'Informe até '.self::MAX_SCHEDULE_ITEMS.' horários.',
            'schedule.*.time.regex' => 'Informe o horário no formato HH:MM, por exemplo 10:10.',
            'social_links.max' => 'Informe até '.self::MAX_SOCIAL_LINKS.' redes sociais.',
            'address.state.regex' => 'Informe a sigla do estado, com 2 letras.',
            'address.zip.regex' => 'Informe o CEP com 8 dígitos.',
            'whatsapp.phone.required' => __('business.BR-004.1'),
        ];

        foreach ([
            'map_links.google_maps_url', 'map_links.waze_url', 'map_links.embed_url', 'youtube_links.channel_url',
            'youtube_links.live_url', 'social_links.*.url',
        ] as $field) {
            $messages["{$field}.url"] = 'Informe um endereço que comece com https://.';
        }

        foreach (self::LEAD_TYPES as $type) {
            $messages["notification_recipients.{$type}.max"] = __('business.BR-051');
            $messages["notification_recipients.{$type}.array"] = __('business.BR-051');
        }

        return $messages;
    }

    /**
     * O valor de uma chave como vai para o banco. Recebe o que passou nas regras de `rules()`.
     */
    public static function normalize(string $key, mixed $value): mixed
    {
        /** @var array<mixed> $value */
        return match ($key) {
            'schedule' => array_values(array_map(fn (array $item) => [
                'day' => self::text($item['day']),
                'recurrence' => self::nullableText($item['recurrence'] ?? null),
                'activity' => self::text($item['activity']),
                'time' => $item['time'],
                'mode' => self::nullableText($item['mode'] ?? null),
            ], $value)),
            'campaign_notice' => [
                'active' => (bool) $value['active'],
                'title' => self::nullableText($value['title'] ?? null),
                'text' => self::text($value['text'] ?? ''),
            ],
            'lords_supper_notice' => [
                'active' => (bool) $value['active'],
                'text' => self::text($value['text'] ?? ''),
            ],
            'address' => [
                'street' => self::text($value['street']),
                'number' => self::text($value['number']),
                'complement' => self::nullableText($value['complement'] ?? null),
                'neighborhood' => self::text($value['neighborhood']),
                'city' => self::text($value['city']),
                'state' => strtoupper(self::text($value['state'])),
                'zip' => preg_replace('/\D/', '', $value['zip']),
            ],
            'map_links' => [
                'google_maps_url' => self::nullableText($value['google_maps_url'] ?? null),
                'waze_url' => self::nullableText($value['waze_url'] ?? null),
                'embed_url' => self::nullableText($value['embed_url'] ?? null),
            ],
            'whatsapp' => [
                'phone' => PhoneNumber::from($value['phone'])->e164(),
                'default_text' => self::nullableText($value['default_text'] ?? null),
            ],
            'youtube_links' => [
                'channel_url' => self::nullableText($value['channel_url'] ?? null),
                'live_url' => self::nullableText($value['live_url'] ?? null),
            ],
            'social_links' => array_values(array_map(fn (array $link) => [
                'network' => strtolower(self::text($link['network'])),
                'url' => self::text($link['url']),
            ], $value)),
            'notification_recipients' => self::normalizeRecipients($value),
            default => $value,
        };
    }

    /**
     * Os tipos de contato que ficam sem nenhum destinatário válido (BR-011).
     *
     * @param  array<mixed>  $recipients
     * @return list<string>
     */
    public static function typesWithoutRecipients(array $recipients): array
    {
        return array_values(array_filter(
            self::LEAD_TYPES,
            fn (string $type) => ! is_array($recipients[$type] ?? null) || $recipients[$type] === [],
        ));
    }

    /**
     * @return array<string, list<mixed>>
     */
    private static function recipientRules(): array
    {
        $rules = ['notification_recipients' => ['required', 'array']];

        foreach (self::LEAD_TYPES as $type) {
            $rules["notification_recipients.{$type}"] = ['nullable', 'array', 'max:'.self::MAX_RECIPIENTS];
            $rules["notification_recipients.{$type}.*"] = ['required', 'string', self::validEmail()];
        }

        return $rules;
    }

    private static function validEmail(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || EmailAddress::tryFrom($value) === null) {
                $fail(__('business.BR-051'));
            }
        };
    }

    /**
     * @param  array<mixed>  $value
     * @return array<string, list<string>>
     */
    private static function normalizeRecipients(array $value): array
    {
        $result = [];

        foreach (self::LEAD_TYPES as $type) {
            $list = is_array($value[$type] ?? null) ? $value[$type] : [];
            $addresses = [];

            foreach ($list as $candidate) {
                $address = is_string($candidate) ? EmailAddress::tryFrom($candidate) : null;
                if ($address !== null) {
                    $addresses[$address->value()] = true;
                }
            }

            $result[$type] = array_keys($addresses);
        }

        return $result;
    }

    private static function text(mixed $value): string
    {
        return trim((string) $value);
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
