<?php

declare(strict_types=1);

use App\Modules\Events\Models\EventRegistration;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/*
| FR-064 e ADR-016: todo campo marcado com 🔒 em data-model.md é cifrado pela aplicação (cast `encrypted`).
| Cada caso lê o valor direto do banco (`DB::table`), sem passar pelo model, e confere que ele difere do texto gravado.
*/

dataset('campos cifrados', [
    'ministries_groups.private_address' => [
        'ministries_groups',
        'private_address',
        fn (): Model => MinistryGroup::factory()->create(['private_address' => 'Rua das Flores, 123, Bairro Segredo']),
        'Rua das Flores, 123, Bairro Segredo',
    ],
    'leads_messages.message' => [
        'leads_messages',
        'message',
        fn (): Model => Lead::factory()->oracao()->create(['message' => 'Peço oração pela saúde da minha mãe.']),
        'Peço oração pela saúde da minha mãe.',
    ],
    'lead_activities.note' => [
        'lead_activities',
        'note',
        fn (): Model => LeadActivity::factory()->create(['note' => 'Família enlutada, ligar à noite.']),
        'Família enlutada, ligar à noite.',
    ],
]);

it('FR-064 cifra o campo sensível no banco e o devolve em texto pelo model', function (string $table, string $column, Closure $make, string $plain) {
    $model = $make();

    $raw = DB::table($table)->where('id', $model->getKey())->value($column);

    expect($raw)->toBeString()
        ->and($raw)->not->toBe($plain)
        ->and($raw)->not->toContain($plain)
        ->and($model->newQuery()->findOrFail($model->getKey())->getAttribute($column))->toBe($plain);
})->with('campos cifrados');

it('FR-064 cifra as respostas da inscrição (JSON) e as devolve como lista', function () {
    $answers = [['key' => 'alergia', 'label' => 'Alergia?', 'type' => 'TEXT', 'value' => 'amendoim']];
    $registration = EventRegistration::factory()->create(['answers' => $answers]);

    $raw = DB::table('event_registrations')->where('id', $registration->getKey())->value('answers');

    expect($raw)->toBeString()
        ->and($raw)->not->toContain('amendoim')
        ->and($raw)->not->toContain('alergia')
        ->and(EventRegistration::query()->findOrFail($registration->getKey())->answers)->toBe($answers);
});

it('BR-048 não serializa private_address nem contact_email do ministério', function () {
    $cell = MinistryGroup::factory()->cell()->create(['contact_email' => 'celula@pibls.test']);

    $serialized = MinistryGroup::query()->findOrFail($cell->getKey())->toArray();

    expect($serialized)->not->toHaveKeys(['private_address', 'contact_email']);
});
