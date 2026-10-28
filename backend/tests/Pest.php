<?php

declare(strict_types=1);

use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Models\User;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Assert;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Feature tests: MySQL real (banco `pibls_test`), nunca mockado
|--------------------------------------------------------------------------
*/
pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Unit tests: sem framework e sem banco
|--------------------------------------------------------------------------
*/
pest()->in('Unit');

/*
|--------------------------------------------------------------------------
| Arch tests: regras de dependência entre módulos (T038). O plugin `arch()`
| já vem com o Pest 4.
|--------------------------------------------------------------------------
*/
pest()->in('Arch');

/*
|--------------------------------------------------------------------------
| Helpers de acesso (fase 5): usuários por papel, como o runbook de provisionamento os cria
|--------------------------------------------------------------------------
*/

/** Os 7 papéis de referência (`role_templates`). */
const ROLE_CODES = ['COMUNICACAO', 'SECRETARIA', 'TESOURARIA', 'ORACAO', 'PASTORAL', 'LIDER_MINISTERIO', 'ADMIN_TECNICO'];

/**
 * Cria um usuário ativo com as permissões do papel, copiadas de `role_templates` (a mesma instrução do runbook; a
 * aplicação em si nunca grava em `user_permissions`, BR-077). O líder de ministério ganha ministério vinculado, salvo
 * se `ministry_id` vier nos atributos.
 *
 * @param  array<string, mixed>  $attributes
 */
function userWithRole(string $role, array $attributes = []): User
{
    if ($role === 'LIDER_MINISTERIO' && ! array_key_exists('ministry_id', $attributes)) {
        $attributes['ministry_id'] = MinistryGroup::factory()->create()->getKey();
    }

    $user = User::factory()->create($attributes);

    DB::statement(
        'INSERT IGNORE INTO user_permissions (user_id, role_code, permission_key)
         SELECT ?, role_code, permission_key FROM role_templates WHERE role_code = ?',
        [$user->getKey(), $role],
    );

    return $user;
}

/**
 * Entra no painel como o usuário do papel (sessão com o instante do login, como o `Login` grava) e o devolve. Os testes
 * seguintes de `$this->getJson(...)` já saem autenticados.
 *
 * @param  array<string, mixed>  $attributes
 */
function asStaff(string $role, array $attributes = []): User
{
    $user = userWithRole($role, $attributes);

    test()->actingAs($user)->withSession([EnforceSessionLimits::LOGIN_AT => time()]);

    return $user;
}

/*
|--------------------------------------------------------------------------
| Helpers de conteúdo (fase 7): PDF de teste para os boletins
|--------------------------------------------------------------------------
*/

/**
 * Um PDF mínimo e verdadeiro (assinatura `%PDF-` e MIME real), com `$paddingBytes` de enchimento num comentário para
 * chegar ao tamanho pedido (o limite do boletim é 10 MB, BR-041).
 */
function bulletinPdfUpload(string $name = 'boletim.pdf', int $paddingBytes = 0): UploadedFile
{
    $padding = $paddingBytes > 0 ? '% '.str_repeat('x', $paddingBytes)."\n" : '';
    $bytes = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n{$padding}trailer\n<< /Root 1 0 R >>\n%%EOF\n";

    return UploadedFile::fake()->createWithContent($name, $bytes)->mimeType('application/pdf');
}

/*
|--------------------------------------------------------------------------
| Asserts do envelope de validação (422): `error.details` é uma lista de {field, code, message}
|--------------------------------------------------------------------------
*/

TestResponse::macro('assertFieldErrors', function (array $fields): TestResponse {
    /** @var TestResponse $this */
    $sent = array_column((array) $this->json('error.details'), 'field');

    foreach ($fields as $field) {
        Assert::assertContains($field, $sent, "Sem erro no campo {$field}; vieram: ".implode(', ', $sent));
    }

    return $this;
});

TestResponse::macro('assertFieldError', function (string $field, string $message): TestResponse {
    /** @var TestResponse $this */
    $messages = array_column(array_filter((array) $this->json('error.details'), fn (array $detail) => $detail['field'] === $field), 'message');

    Assert::assertContains($message, $messages, "Campo {$field}: esperava \"{$message}\"; veio: ".implode(' | ', $messages));

    return $this;
});
