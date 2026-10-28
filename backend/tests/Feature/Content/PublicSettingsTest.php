<?php

declare(strict_types=1);

use App\Modules\Content\Models\SiteSetting;

use function Pest\Laravel\getJson;

/*
| GET /api/public/settings (contracts/openapi.yaml → PublicSettings; contracts/snapshots.md).
| O seed das migrations já carrega as configurações iniciais; cada teste altera só o que precisa.
*/

it('responde 200 com {data} e cache público de 60 s', function () {
    getJson('/api/public/settings')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=60, public')
        ->assertJsonStructure([
            'data' => [
                'schedule' => [['day', 'recurrence', 'activity', 'time', 'mode']],
                'campaign_notice' => ['active', 'title', 'text'],
                'lords_supper_notice' => ['active', 'text'],
                'address' => ['street', 'number', 'complement', 'neighborhood', 'city', 'state', 'zip'],
                'map_links' => ['google_maps_url', 'waze_url', 'embed_url'],
                'whatsapp' => ['phone', 'default_text'],
                'youtube_links' => ['channel_url', 'live_url'],
                'social_links',
                'pix' => ['pix_key', 'beneficiary_name', 'qr_image_url', 'copy_paste_code'],
                'features' => ['events'],
            ],
        ]);
});

it('BR-050 nunca expõe notification_recipients, nem as chaves privadas nem o caminho interno do QR', function () {
    SiteSetting::query()->where('key', 'notification_recipients')->update([
        'value' => json_encode(['VISITANTE' => ['secretaria@example.com'], 'MEMBRO' => [], 'ORACAO' => [], 'CONTATO' => [], 'MINISTERIO' => []]),
    ]);

    $body = getJson('/api/public/settings')->assertOk()->getContent();

    expect($body)->not->toContain('notification_recipients')
        ->not->toContain('secretaria@example.com')
        ->not->toContain('qr_image_path');
});

it('BR-050 ignora uma chave marcada como privada, mesmo que o resource a conheça', function () {
    SiteSetting::query()->where('key', 'youtube_links')->update(['is_public' => false]);

    $data = getJson('/api/public/settings')->assertOk()->json('data');

    expect($data)->not->toHaveKey('youtube_links')
        ->and($data)->toHaveKey('whatsapp');
});

it('features.events segue a flag FEATURE_EVENTS', function (bool $enabled) {
    config(['features.events' => $enabled]);

    getJson('/api/public/settings')->assertOk()->assertJsonPath('data.features.events', $enabled);
})->with([true, false]);

it('mostra o horário alterado no banco na hora, sem cache de aplicação', function () {
    SiteSetting::query()->where('key', 'schedule')->update(['value' => json_encode([
        ['day' => 'Domingo', 'recurrence' => 'semanal', 'activity' => 'Culto Matinal', 'time' => '10:30', 'mode' => 'Presencial'],
    ])]);

    getJson('/api/public/settings')->assertOk()
        ->assertJsonCount(1, 'data.schedule')
        ->assertJsonPath('data.schedule.0.time', '10:30');
});

it('transforma o caminho do QR Code em URL pública e entrega o código Copia e Cola', function () {
    $pix = SiteSetting::query()->findOrFail('pix');
    $pix->forceFill(['value' => [...$pix->value, 'qr_image_path' => 'pix/2026/abc.png', 'copy_paste_code' => '00020126…6304ABCD']])->save();

    getJson('/api/public/settings')->assertOk()
        ->assertJsonPath('data.pix.pix_key', '20969119000184')
        ->assertJsonPath('data.pix.qr_image_url', '/uploads/pix/2026/abc.png')
        ->assertJsonPath('data.pix.copy_paste_code', '00020126…6304ABCD');
});
