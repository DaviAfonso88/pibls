<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Front controller do Laravel na hospedagem (ADR-006)
|--------------------------------------------------------------------------
|
| Copie este arquivo UMA vez para o docroot (public_html/index.php e homolog_html/index.php), no setup da hospedagem.
| Ele não muda a cada release: descobre a release ativa pelo ponteiro `private/<app>/current.php` e carrega o Laravel
| dela. O `.htaccess` só manda para cá o que é do Laravel (/api, /sanctum, /palavra-viva/<slug>, /sitemap.xml…).
|
| Layout esperado (home da conta = /home/USUARIO):
|
|     public_html/index.php                      ← este arquivo        (app = pibls)
|     homolog_html/index.php                     ← este arquivo        (app = pibls-homolog)
|     private/<app>/current.php                  ← ponteiro da release ativa
|     private/<app>/releases/<id>/backend/       ← Laravel completo, com vendor/
|     private/<app>/shared/{.env,storage/}       ← segredos e storage, fora das releases
|
*/

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

// Troque para 'pibls-homolog' na cópia que vai para homolog_html/
$app = 'pibls';

$base = dirname(__DIR__).'/private/'.$app;
$shared = $base.'/shared';

$pointer = is_file($base.'/current.php') ? require $base.'/current.php' : null;

if (! is_string($pointer) || preg_match('#^releases/\d{4}\.(0[1-9]|1[0-2])\.\d{1,5}$#', $pointer) !== 1) {
    // Nenhuma release ativa (instalação em andamento) ou ponteiro corrompido: não expõe caminho nenhum
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    header('Retry-After: 300');
    echo "O site está em manutenção. Volte em alguns minutos.\n";

    exit;
}

$backend = $base.'/'.$pointer.'/backend';

define('LARAVEL_START', microtime(true));

// O .env e o storage ficam fora da release (veja bootstrap/app.php do backend)
$_SERVER['PIBLS_SHARED_PATH'] = $shared;

// Modo de manutenção, se o `artisan down` tiver sido rodado pelo wrapper
if (file_exists($maintenance = $shared.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $backend.'/vendor/autoload.php';

/** @var Application $laravel */
$laravel = require_once $backend.'/bootstrap/app.php';

// Este arquivo está no docroot: é ele o `public_path()` (uploads/ e data/ ficam ao lado)
$laravel->usePublicPath(__DIR__);

$laravel->handleRequest(Request::capture());
