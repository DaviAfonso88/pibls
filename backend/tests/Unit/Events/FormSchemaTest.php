<?php

declare(strict_types=1);

use App\Modules\Events\Enums\FormFieldType;
use App\Modules\Events\ValueObjects\FormField;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Shared\ValueObjects\InvalidValueObject;

/*
| FormField e FormSchema (T169): o formulário de inscrição que o líder monta (BR-031) e o marcador `sensitive` (ADR-020, BR-083).
*/

/** @return array<string, mixed> */
function formTextField(array $overrides = []): array
{
    return ['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false, ...$overrides];
}

/** @return array<string, mixed> */
function formSelectField(array $overrides = []): array
{
    return ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M', 'G'], ...$overrides];
}

it('BR-031 aceita um formulário vazio', function () {
    $schema = FormSchema::from([]);

    expect($schema->fields)->toBe([])
        ->and($schema->toArray())->toBe([])
        ->and($schema->hasSensitiveField())->toBeFalse();
});

it('BR-031 monta os campos dos 7 tipos e devolve o mesmo array que recebeu, com os padrões preenchidos', function () {
    $schema = FormSchema::from([
        formTextField(),
        ['key' => 'sobre', 'label' => 'Sobre você', 'type' => 'TEXTAREA', 'required' => false, 'max' => 500],
        ['key' => 'idade', 'label' => 'Idade', 'type' => 'NUMBER', 'required' => true, 'min' => 0, 'max' => 120],
        ['key' => 'nascimento', 'label' => 'Nascimento', 'type' => 'DATE', 'required' => false],
        formSelectField(),
        ['key' => 'oficinas', 'label' => 'Oficinas', 'type' => 'MULTISELECT', 'required' => false, 'options' => ['Violão', 'Canto']],
        ['key' => 'carona', 'label' => 'Precisa de carona?', 'type' => 'BOOLEAN', 'required' => false, 'help_text' => 'Saímos às 7h'],
    ]);

    expect($schema->fields)->toHaveCount(7)
        ->and(array_map(fn (FormField $field) => $field->type, $schema->fields))->toBe(FormFieldType::cases())
        ->and($schema->toArray()[0])->toBe([
            'key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false, 'help_text' => null,
            'sensitive' => false, 'min' => null, 'max' => null, 'options' => null,
        ])
        ->and($schema->toArray()[6]['help_text'])->toBe('Saímos às 7h');
});

it('BR-031 aceita no máximo 30 campos', function () {
    $thirty = array_map(fn (int $n) => formTextField(['key' => "campo_{$n}", 'label' => "Campo {$n}"]), range(1, 30));

    expect(FormSchema::from($thirty)->fields)->toHaveCount(30);

    $thirtyOne = [...$thirty, formTextField(['key' => 'campo_31', 'label' => 'Campo 31'])];

    expect(fn () => FormSchema::from($thirtyOne))
        ->toThrow(InvalidValueObject::class, 'O formulário pode ter no máximo 30 campos.');
});

it('BR-031 a chave é única no formulário', function () {
    expect(fn () => FormSchema::from([formTextField(), formTextField(['label' => 'Outra'])]))
        ->toThrow(InvalidValueObject::class, 'Já existe um campo com a chave alergias.');
});

it('BR-031 a chave segue o padrão ^[a-z][a-z0-9_]{0,39}$', function (string $key) {
    expect(fn () => FormField::from(formTextField(['key' => $key])))
        ->toThrow(InvalidValueObject::class, 'A chave do campo');
})->with(['começa com número' => '1campo', 'maiúscula' => 'Campo', 'hífen' => 'meu-campo', 'espaço' => 'meu campo', 'acento' => 'não', 'vazia' => '', '41 caracteres' => str_repeat('a', 41)]);

it('BR-031 a chave de 40 caracteres e a de 1 caractere valem', function () {
    expect(FormField::from(formTextField(['key' => str_repeat('a', 40)]))->key)->toHaveLength(40)
        ->and(FormField::from(formTextField(['key' => 'a']))->key)->toBe('a')
        ->and(FormField::from(formTextField(['key' => 'a_1_b']))->key)->toBe('a_1_b');
});

it('BR-031 SELECT e MULTISELECT pedem de 2 a 30 opções diferentes', function (string $type) {
    $valid = fn (array $options) => FormField::from(formSelectField(['type' => $type, 'options' => $options]));

    expect($valid(['A', 'B'])->options)->toBe(['A', 'B'])
        ->and($valid(array_map(fn (int $n) => "Opção {$n}", range(1, 30)))->options)->toHaveCount(30);

    foreach ([[], ['A'], ['A', 'A'], ['A', ' a '], array_map(fn (int $n) => "Opção {$n}", range(1, 31)), ['A', ''], ['A', '   ']] as $options) {
        expect(fn () => $valid($options))->toThrow(InvalidValueObject::class, 'Informe de 2 a 30 opções diferentes.');
    }

    expect(fn () => FormField::from(formSelectField(['type' => $type, 'options' => null])))
        ->toThrow(InvalidValueObject::class, 'Informe de 2 a 30 opções diferentes.');
})->with(['SELECT', 'MULTISELECT']);

it('BR-031 apara as opções e rejeita as que só diferem em maiúsculas ou espaços', function () {
    expect(FormField::from(formSelectField(['options' => [' P ', 'M']]))->options)->toBe(['P', 'M']);
});

it('BR-031 os outros tipos não guardam opções, mesmo que venham no pedido', function () {
    expect(FormField::from(formTextField(['options' => ['x', 'y']]))->options)->toBeNull();
});

it('BR-031 o tipo precisa ser um dos sete', function () {
    expect(fn () => FormField::from(formTextField(['type' => 'RADIO'])))
        ->toThrow(InvalidValueObject::class, 'Escolha o tipo do campo.');
});

it('BR-031 o rótulo é obrigatório e vai até 150 caracteres; a dica, até 300', function () {
    expect(FormField::from(formTextField(['label' => str_repeat('a', 150)]))->label)->toHaveLength(150);

    foreach (['', '   ', str_repeat('a', 151)] as $label) {
        expect(fn () => FormField::from(formTextField(['label' => $label])))
            ->toThrow(InvalidValueObject::class, 'Informe o rótulo do campo (até 150 caracteres).');
    }

    expect(FormField::from(formTextField(['help_text' => str_repeat('a', 300)]))->helpText)->toHaveLength(300)
        ->and(FormField::from(formTextField(['help_text' => '   ']))->helpText)->toBeNull();

    expect(fn () => FormField::from(formTextField(['help_text' => str_repeat('a', 301)])))
        ->toThrow(InvalidValueObject::class, 'A dica do campo pode ter até 300 caracteres.');
});

it('BR-031 min e max valem para número e para tamanho de texto, e min não passa de max', function () {
    expect(FormField::from(formTextField(['min' => 3, 'max' => 40]))->max)->toBe(40.0)
        ->and(FormField::from(['key' => 'n', 'label' => 'N', 'type' => 'NUMBER', 'required' => false, 'min' => -5.5, 'max' => 10])->min)->toBe(-5.5);

    expect(fn () => FormField::from(formTextField(['min' => 10, 'max' => 3])))
        ->toThrow(InvalidValueObject::class, 'O mínimo não pode ser maior que o máximo.');

    // Para tipos sem limite (data, sim/não, listas) o limite é descartado
    expect(FormField::from(['key' => 'b', 'label' => 'B', 'type' => 'BOOLEAN', 'required' => false, 'min' => 1, 'max' => 2])->max)->toBeNull();
});

it('BR-083 o marcador sensitive é opcional, booleano e começa falso', function () {
    expect(FormField::from(formTextField())->sensitive)->toBeFalse()
        ->and(FormField::from(formTextField(['sensitive' => true]))->sensitive)->toBeTrue()
        ->and(FormField::from(formTextField(['sensitive' => false]))->sensitive)->toBeFalse();

    expect(fn () => FormField::from(formTextField(['sensitive' => 'sim'])))
        ->toThrow(InvalidValueObject::class, 'O marcador de dado de saúde precisa ser verdadeiro ou falso.');
});

it('BR-083 o formulário avisa quando algum campo é sensível', function () {
    $schema = FormSchema::from([formTextField(), formSelectField(), formTextField(['key' => 'remedios', 'label' => 'Remédios', 'sensitive' => true])]);

    expect($schema->hasSensitiveField())->toBeTrue()
        ->and(FormSchema::from([formTextField(), formSelectField()])->hasSensitiveField())->toBeFalse();
});

it('BR-031 required precisa ser booleano', function () {
    expect(fn () => FormField::from(formTextField(['required' => 'talvez'])))
        ->toThrow(InvalidValueObject::class, 'Diga se o campo é obrigatório.');
});

it('BR-029 diz quais campos foram removidos ou tiveram o tipo trocado em relação ao formulário anterior', function () {
    $before = FormSchema::from([formTextField(), formSelectField(), ['key' => 'idade', 'label' => 'Idade', 'type' => 'NUMBER', 'required' => false]]);

    $after = FormSchema::from([
        formTextField(['label' => 'Alergias e remédios']), // só o rótulo mudou: tudo bem
        formSelectField(['type' => 'MULTISELECT']),          // tipo trocado
        // `idade` removido
        ['key' => 'novo', 'label' => 'Novo', 'type' => 'TEXT', 'required' => false], // campo novo: tudo bem
    ]);

    expect($after->breakingChangesFrom($before))->toBe(['camiseta', 'idade'])
        ->and($before->breakingChangesFrom($before))->toBe([])
        ->and(FormSchema::from([])->breakingChangesFrom($before))->toBe(['alergias', 'camiseta', 'idade']);
});

it('BR-029 a lista de opções pode mudar sem pedir confirmação', function () {
    $before = FormSchema::from([formSelectField()]);
    $after = FormSchema::from([formSelectField(['options' => ['P', 'M', 'G', 'GG']])]);

    expect($after->breakingChangesFrom($before))->toBe([]);
});

it('guarda os campos na ordem em que vieram', function () {
    $schema = FormSchema::from([formSelectField(), formTextField()]);

    expect(array_map(fn (FormField $field) => $field->key, $schema->fields))->toBe(['camiseta', 'alergias']);
});
