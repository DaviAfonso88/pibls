<?php

declare(strict_types=1);

use App\Modules\Content\Models\SiteSetting;
use App\Modules\Content\Snapshots\SettingsSnapshot;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;

/*
| GET e PATCH /api/admin/settings (T133; CAP-17, contracts/openapi.yaml). BR-011 (tipo sem destinatário), BR-050 (o que é
| privado), BR-051 (até 10 e-mails válidos) e a regra de que a chave `pix` só muda na rota do PIX (BR-060).
*/

beforeEach(function () {
    $this->operator = asStaff('SECRETARIA', ['name' => 'Sara Secretária']);
});

function patchSettings(array $body): TestResponse
{
    return patchJson('/api/admin/settings', $body);
}

/** @return array<string, string> */
function scheduleItem(array $overrides = []): array
{
    return $overrides + ['day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'Culto Matinal', 'time' => '10:10', 'mode' => 'Presencial e YouTube'];
}

describe('GET /api/admin/settings', function () {
    it('devolve as chaves editáveis com os destinatários, e nunca a chave pix', function () {
        $response = getJson('/api/admin/settings')->assertOk();

        $response->assertJsonStructure(['data' => ['schedule', 'campaign_notice', 'lords_supper_notice', 'address', 'map_links', 'whatsapp', 'youtube_links', 'social_links', 'notification_recipients'], 'warnings'])
            ->assertJsonMissingPath('data.pix');
        expect(array_keys($response->json('data.notification_recipients')))->toEqualCanonicalizing(['VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO', 'MINISTERIO']);
    });

    it('BR-011 avisa cada tipo de contato sem destinatário', function () {
        SiteSetting::query()->whereKey('notification_recipients')->update(['value' => json_encode([
            'VISITANTE' => ['visitas@example.com'], 'MEMBRO' => [], 'ORACAO' => ['oracao@example.com'], 'CONTATO' => [], 'MINISTERIO' => [],
        ])]);

        $warnings = getJson('/api/admin/settings')->assertOk()->json('warnings');

        expect(collect($warnings)->pluck('lead_type')->all())->toEqual(['MEMBRO', 'CONTATO', 'MINISTERIO'])
            ->and($warnings[0])->toEqual([
                'code' => 'NO_RECIPIENTS',
                'lead_type' => 'MEMBRO',
                'message' => 'O tipo MEMBRO não tem destinatário de e-mail. Os contatos chegam só pelo painel.',
            ]);
    });

    it('BR-011 não avisa quando todos os tipos têm destinatário', function () {
        $all = array_fill_keys(['VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO', 'MINISTERIO'], ['alguem@example.com']);
        SiteSetting::query()->whereKey('notification_recipients')->update(['value' => json_encode($all)]);

        getJson('/api/admin/settings')->assertOk()->assertJsonPath('warnings', []);
    });
});

describe('PATCH /api/admin/settings', function () {
    it('substitui só as chaves enviadas e deixa as outras como estavam', function () {
        $address = SiteSetting::query()->whereKey('address')->firstOrFail()->value;

        patchSettings(['schedule' => [scheduleItem(['activity' => 'Culto de Domingo'])]])
            ->assertOk()
            ->assertJsonPath('data.schedule.0.activity', 'Culto de Domingo')
            ->assertJsonCount(1, 'data.schedule');

        expect(SiteSetting::query()->whereKey('address')->firstOrFail()->value)->toBe($address);
    });

    it('grava quem alterou e quando', function () {
        patchSettings(['lords_supper_notice' => ['active' => true, 'text' => 'Ceia neste domingo.']])->assertOk();

        $row = SiteSetting::query()->whereKey('lords_supper_notice')->firstOrFail();
        expect($row->updated_by)->toBe($this->operator->getKey())
            ->and($row->value)->toEqual(['active' => true, 'text' => 'Ceia neste domingo.']);
    });

    it('a Secretaria altera cada chave pública e o snapshot passa a mostrar o novo valor', function (string $key, array $value) {
        patchSettings([$key => $value])->assertOk();

        expect(app(SettingsSnapshot::class)->build()[$key])->toEqual($value);
    })->with([
        'horários' => ['schedule', [['day' => 'Quarta-feira', 'recurrence' => null, 'activity' => 'Estudo bíblico', 'time' => '19:30', 'mode' => null]]],
        'campanha' => ['campaign_notice', ['active' => true, 'title' => 'Estamos Construindo', 'text' => 'Ajude na obra.']],
        'ceia' => ['lords_supper_notice', ['active' => false, 'text' => 'Ceia no primeiro domingo.']],
        'endereço' => ['address', ['street' => 'Rua das Flores', 'number' => '100', 'complement' => null, 'neighborhood' => 'Centro', 'city' => 'Lagoa Santa', 'state' => 'MG', 'zip' => '33400000']],
        'mapas' => ['map_links', ['google_maps_url' => 'https://maps.google.com/?q=pibls', 'waze_url' => null, 'embed_url' => null]],
        'whatsapp' => ['whatsapp', ['phone' => '+5531991234567', 'default_text' => 'Olá!']],
        'youtube' => ['youtube_links', ['channel_url' => 'https://www.youtube.com/@pibls', 'live_url' => null]],
        'redes' => ['social_links', [['network' => 'instagram', 'url' => 'https://www.instagram.com/pib_ls/']]],
    ]);

    it('limpa o valor: CEP só com dígitos, UF em maiúsculas, telefone em E.164 e espaços aparados', function () {
        patchSettings([
            'address' => ['street' => ' Rua A ', 'number' => '1', 'complement' => '  ', 'neighborhood' => 'Centro', 'city' => 'Lagoa Santa', 'state' => 'mg', 'zip' => '33400-000'],
            'whatsapp' => ['phone' => '(31) 99123-4567', 'default_text' => ''],
        ])->assertOk();

        expect(SiteSetting::query()->whereKey('address')->firstOrFail()->value)->toEqual([
            'street' => 'Rua A', 'number' => '1', 'complement' => null, 'neighborhood' => 'Centro', 'city' => 'Lagoa Santa', 'state' => 'MG', 'zip' => '33400000',
        ])->and(SiteSetting::query()->whereKey('whatsapp')->firstOrFail()->value)->toEqual(['phone' => '+5531991234567', 'default_text' => null]);
    });

    describe('validação por chave', function () {
        it('aceita até 20 horários e recusa 21', function () {
            patchSettings(['schedule' => array_fill(0, 20, scheduleItem())])->assertOk();

            patchSettings(['schedule' => array_fill(0, 21, scheduleItem())])
                ->assertUnprocessable()
                ->assertFieldError('schedule', 'Informe até 20 horários.');
        });

        it('exige o horário no formato HH:MM', function (string $time) {
            patchSettings(['schedule' => [scheduleItem(['time' => $time])]])
                ->assertUnprocessable()
                ->assertFieldErrors(['schedule.0.time']);
        })->with(['10h', '25:00', '9:30', '10:60', '']);

        it('exige dia e atividade em cada horário', function () {
            patchSettings(['schedule' => [scheduleItem(['day' => '', 'activity' => ''])]])
                ->assertUnprocessable()
                ->assertFieldErrors(['schedule.0.day', 'schedule.0.activity']);
        });

        it('limita título (80) e texto (500) da campanha e o texto da Ceia (300)', function () {
            patchSettings(['campaign_notice' => ['active' => false, 'title' => str_repeat('a', 81), 'text' => str_repeat('b', 501)]])
                ->assertUnprocessable()
                ->assertFieldErrors(['campaign_notice.title', 'campaign_notice.text']);

            patchSettings(['lords_supper_notice' => ['active' => false, 'text' => str_repeat('c', 301)]])
                ->assertUnprocessable()
                ->assertFieldErrors(['lords_supper_notice.text']);

            patchSettings(['campaign_notice' => ['active' => false, 'title' => str_repeat('a', 80), 'text' => str_repeat('b', 500)]])->assertOk();
        });

        it('não deixa ligar um aviso sem texto', function (string $key) {
            patchSettings([$key => ['active' => true, 'text' => '']])
                ->assertUnprocessable()
                ->assertFieldError("{$key}.text", 'Escreva o texto do aviso ou desligue-o.');

            patchSettings([$key => ['active' => false, 'text' => '']])->assertOk();
        })->with(['campaign_notice', 'lords_supper_notice']);

        it('exige CEP de 8 dígitos e UF de 2 letras', function (array $override, string $field) {
            $address = ['street' => 'Rua A', 'number' => '1', 'complement' => null, 'neighborhood' => 'Centro', 'city' => 'Lagoa Santa', 'state' => 'MG', 'zip' => '33400000'];

            patchSettings(['address' => $override + $address])
                ->assertUnprocessable()
                ->assertFieldErrors(["address.{$field}"]);
        })->with([
            'CEP curto' => [['zip' => '3340000'], 'zip'],
            'CEP com letras' => [['zip' => '3340A000'], 'zip'],
            'UF com 3 letras' => [['state' => 'MGS'], 'state'],
            'UF numérica' => [['state' => '31'], 'state'],
        ]);

        it('só aceita links https', function (string $key, string $field) {
            patchSettings([$key => [$field => 'http://exemplo.com/mapa']])
                ->assertUnprocessable()
                ->assertFieldError("{$key}.{$field}", 'Informe um endereço que comece com https://.');
        })->with([
            ['map_links', 'google_maps_url'],
            ['map_links', 'waze_url'],
            ['map_links', 'embed_url'],
            ['youtube_links', 'channel_url'],
            ['youtube_links', 'live_url'],
        ]);

        it('recusa rede social sem https e telefone do WhatsApp inválido', function () {
            patchSettings(['social_links' => [['network' => 'instagram', 'url' => 'javascript:alert(1)']]])
                ->assertUnprocessable()
                ->assertFieldErrors(['social_links.0.url']);

            patchSettings(['whatsapp' => ['phone' => '123', 'default_text' => null]])
                ->assertUnprocessable()
                ->assertFieldErrors(['whatsapp.phone']);
        });
    });

    describe('destinatários de notificação', function () {
        it('BR-051 aceita até 10 e-mails por tipo e recusa 11', function () {
            $ten = array_map(fn (int $n) => "pessoa{$n}@example.com", range(1, 10));

            patchSettings(['notification_recipients' => ['VISITANTE' => $ten]])->assertOk();

            patchSettings(['notification_recipients' => ['VISITANTE' => [...$ten, 'pessoa11@example.com']]])
                ->assertUnprocessable()
                ->assertFieldError('notification_recipients.VISITANTE', 'Informe até 10 e-mails válidos.');
        });

        it('BR-051 recusa e-mail inválido com a frase da regra', function (string $address) {
            patchSettings(['notification_recipients' => ['CONTATO' => ['valido@example.com', $address]]])
                ->assertUnprocessable()
                ->assertFieldError('notification_recipients.CONTATO.1', 'Informe até 10 e-mails válidos.');
        })->with(['sem-arroba', 'a@b', 'dois@@example.com', 'com espaço@example.com']);

        it('guarda os e-mails em minúsculas, sem repetição, e completa os tipos que faltaram', function () {
            patchSettings(['notification_recipients' => ['VISITANTE' => ['Visitas@Example.com', 'visitas@example.com', ' outra@example.com ']]])->assertOk();

            expect(SiteSetting::query()->whereKey('notification_recipients')->firstOrFail()->value)->toEqual([
                'VISITANTE' => ['visitas@example.com', 'outra@example.com'],
                'MEMBRO' => [],
                'ORACAO' => [],
                'CONTATO' => [],
                'MINISTERIO' => [],
            ]);
        });

        it('BR-050 os destinatários nunca saem no snapshot nem na API pública', function () {
            patchSettings(['notification_recipients' => ['VISITANTE' => ['segredo@example.com']]])->assertOk();

            expect(json_encode(app(SettingsSnapshot::class)->build()))->not->toContain('segredo@example.com')->not->toContain('notification_recipients');
            getJson('/api/public/settings')->assertOk()->assertJsonMissingPath('data.notification_recipients');
        });

        it('BR-011 o aviso some quando o tipo ganha destinatário', function () {
            patchSettings(['notification_recipients' => ['VISITANTE' => ['visitas@example.com']]])
                ->assertOk()
                ->assertJsonMissing(['lead_type' => 'VISITANTE']);
        });
    });

    describe('o que a rota recusa', function () {
        it('BR-060 recusa a chave pix, que só muda na tela do PIX', function () {
            $before = SiteSetting::query()->whereKey('pix')->firstOrFail()->value;

            patchSettings(['pix' => ['pix_key' => '11222333000181', 'beneficiary_name' => 'Invasor']])
                ->assertUnprocessable()
                ->assertFieldError('pix', 'Os dados PIX mudam só na tela do PIX, com a confirmação da sua senha.');

            expect(SiteSetting::query()->whereKey('pix')->firstOrFail()->value)->toBe($before);
        });

        it('recusa uma chave que não existe e um corpo vazio', function () {
            patchSettings(['features' => ['events' => true]])->assertUnprocessable()->assertFieldError('features', 'Esta configuração não existe.');
            patchSettings([])->assertUnprocessable()->assertFieldError('settings', 'Envie ao menos uma configuração.');
        });

        it('não grava nada quando uma das chaves enviadas é inválida', function () {
            $before = SiteSetting::query()->whereKey('lords_supper_notice')->firstOrFail()->value;

            patchSettings([
                'lords_supper_notice' => ['active' => true, 'text' => 'Ceia neste domingo.'],
                'address' => ['street' => ''],
            ])->assertUnprocessable();

            expect(SiteSetting::query()->whereKey('lords_supper_notice')->firstOrFail()->value)->toBe($before);
        });
    });

    describe('auditoria e snapshot', function () {
        it('audita setting.updated com as chaves alteradas e o autor', function () {
            patchSettings(['campaign_notice' => ['active' => false, 'title' => null, 'text' => 'Texto novo.']])->assertOk();

            $audit = AuditLog::query()->where('action', 'setting.updated')->latest('id')->firstOrFail();
            expect($audit->actor_user_id)->toBe($this->operator->getKey())
                ->and($audit->changes['fields'])->toEqual(['campaign_notice']);
        });

        it('a auditoria dos destinatários guarda só a contagem por tipo, nunca os endereços', function () {
            patchSettings(['notification_recipients' => ['VISITANTE' => ['segredo@example.com', 'outro@example.com']]])->assertOk();

            $audit = AuditLog::query()->where('action', 'setting.updated')->latest('id')->firstOrFail();
            expect($audit->changes['recipient_counts']['VISITANTE'])->toBe(2)
                ->and(json_encode($audit->changes))->not->toContain('example.com');
        });

        it('uma chave pública pede a regeneração do snapshot das configurações', function () {
            Event::fake([PublicContentChanged::class]);

            patchSettings(['lords_supper_notice' => ['active' => true, 'text' => 'Ceia neste domingo.']])->assertOk();

            Event::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $event) => $event->snapshots === ['settings']);
        });

        it('só os destinatários (privados) não regeneram o snapshot', function () {
            Event::fake([PublicContentChanged::class]);

            patchSettings(['notification_recipients' => ['VISITANTE' => ['visitas@example.com']]])->assertOk();

            Event::assertNotDispatched(PublicContentChanged::class);
        });

        it('o mesmo valor não grava, não audita e não regenera', function () {
            $current = SiteSetting::query()->whereKey('schedule')->firstOrFail()->value;
            $audits = AuditLog::query()->where('action', 'setting.updated')->count();
            Event::fake([PublicContentChanged::class]);

            patchSettings(['schedule' => $current])->assertOk();

            expect(AuditLog::query()->where('action', 'setting.updated')->count())->toBe($audits);
            Event::assertNotDispatched(PublicContentChanged::class);
        });
    });
});
