<?php

declare(strict_types=1);

/*
| Processo filho do teste de gravação atômica (SnapshotsTest): regrava `home.json` muitas vezes seguidas, com um
| conteúdo grande o bastante para que uma gravação direta (sem arquivo temporário e rename) fosse vista pela metade.
|
| Uso: php snapshot-writer-loop.php <pasta> <iterações>
*/

require __DIR__.'/../../vendor/autoload.php';

use App\Modules\Platform\Snapshots\SnapshotWriter;

[, $directory, $iterations] = $argv;

$writer = new SnapshotWriter($directory);
$items = array_map(fn (int $i) => ['id' => $i, 'text' => str_repeat('Graça e paz, irmãos. ', 30)], range(1, 400));

for ($i = 1; $i <= (int) $iterations; $i++) {
    $writer->write('home', ['iteration' => $i, 'items' => $items]);
}
