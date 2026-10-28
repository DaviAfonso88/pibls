<?php

declare(strict_types=1);

/*
| Funções comuns dos testes do deploy. O Pest carrega todos os arquivos *Test.php no mesmo processo, então uma função
| declarada em dois deles quebra a suíte inteira; por isso as compartilhadas moram aqui e cada teste faz require_once.
*/

if (! function_exists('put')) {
    /** Grava um arquivo, criando as pastas que faltarem. */
    function put(string $path, string $content): void
    {
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        file_put_contents($path, $content);
    }
}

if (! function_exists('removeTree')) {
    /** Apaga um arquivo ou uma árvore de pastas (sem seguir links). */
    function removeTree(string $path): void
    {
        if (is_link($path) || is_file($path)) {
            @unlink($path);

            return;
        }
        if (! is_dir($path)) {
            return;
        }
        foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $name) {
            removeTree("{$path}/{$name}");
        }
        @rmdir($path);
    }
}

if (! function_exists('scratchDir')) {
    /** Cria uma pasta temporária nova. */
    function scratchDir(string $prefix = 'pibls-deploy'): string
    {
        $path = sys_get_temp_dir().'/'.$prefix.'-'.bin2hex(random_bytes(4));
        mkdir($path, 0755, true);

        return $path;
    }
}
