<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Wrapper do artisan para o cron (Infrastructure → Cron)
|--------------------------------------------------------------------------
|
| Copie para private/bin/artisan.php, no setup. O cron não sabe qual release está ativa; este script descobre pelo
| ponteiro e roda o artisan dela, com o .env e o storage compartilhados:
|
|     php /home/USUARIO/private/bin/artisan.php pibls schedule:run
|     php /home/USUARIO/private/bin/artisan.php pibls-homolog schedule:run
|
| Serve também para rodar qualquer comando à mão, pelo "Tarefas Cron" do cPanel, quando o runbook pedir.
|
*/

if (PHP_SAPI !== 'cli') {
    exit(1);
}

const APPS = ['pibls', 'pibls-homolog'];

$app = $argv[1] ?? '';
if (! in_array($app, APPS, true) || ! isset($argv[2])) {
    fwrite(STDERR, 'Uso: php artisan.php <'.implode('|', APPS)."> <comando do artisan> [argumentos]\n");

    exit(2);
}

$base = dirname(__DIR__).'/'.$app;
$pointer = is_file($base.'/current.php') ? require $base.'/current.php' : null;

if (! is_string($pointer) || preg_match('#^releases/\d{4}\.(0[1-9]|1[0-2])\.\d{1,5}$#', $pointer) !== 1) {
    fwrite(STDERR, "Nenhuma release ativa em {$base}/current.php.\n");

    exit(1);
}

$backend = $base.'/'.$pointer.'/backend';
if (! is_file($backend.'/artisan')) {
    fwrite(STDERR, "A release ativa não tem {$backend}/artisan.\n");

    exit(1);
}

$_SERVER['PIBLS_SHARED_PATH'] = $base.'/shared';
putenv('PIBLS_SHARED_PATH='.$_SERVER['PIBLS_SHARED_PATH']);

chdir($backend);

// O artisan da release lê $_SERVER['argv']: ele passa a ver só o comando e os argumentos
$_SERVER['argv'] = array_merge(['artisan'], array_slice($argv, 2));
$_SERVER['argc'] = count($_SERVER['argv']);

require $backend.'/artisan';
