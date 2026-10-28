<?php

declare(strict_types=1);

/*
| Processo filho do teste de concorrência da inscrição (RegistrationConcurrencyTest): sobe a aplicação, espera o
| instante combinado (para que todos os processos disparem juntos) e inscreve uma pessoa chamando a Action direto.
| Escreve uma linha: `created` ou o código do erro (`EVENT_FULL`, `DUPLICATE_REGISTRATION`, `REGISTRATION_CLOSED`).
|
| Uso: php register-for-event.php <slug> <nome> <telefone> <instante-unix-com-fração>
*/

require __DIR__.'/../../vendor/autoload.php';

use App\Modules\Events\Actions\RegisterForEvent;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Contracts\Console\Kernel;

$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $slug, $name, $phone, $at] = $argv;

while (microtime(true) < (float) $at) {
    usleep(200);
}

try {
    $app->make(RegisterForEvent::class)($slug, [
        'participant_name' => $name,
        'phone' => $phone,
        'email' => null,
        'guardian_name' => null,
        'guardian_phone' => null,
        'guardian_consent' => null,
        'answers' => [],
        'health_consent' => null,
    ]);
    echo 'created';
} catch (BusinessRuleException $e) {
    echo $e->errorCode;
} catch (Throwable $e) {
    echo 'ERROR '.$e::class.': '.$e->getMessage();
}
