<?php

declare(strict_types=1);

namespace App\Modules\Platform\Backup;

use Druidfi\Mysqldump\Compress\CompressManagerFactory;
use Druidfi\Mysqldump\Mysqldump;
use RuntimeException;

/**
 * Dump do banco em PHP puro (`druidfi/mysqldump-php`): não depende do binário `mysqldump` nem do caminho dele na
 * conta da hospedagem. Grava um `.sql.gz`, com a mesma conexão da aplicação. O arquivo em texto claro é efêmero: quem
 * chama o cifra (`BackupCipher`) e apaga em seguida.
 */
class DatabaseDumper
{
    /**
     * Tabelas sem dados no backup: cache e sessões se refazem sozinhas, e sessão carrega token. A ESTRUTURA fica: numa conta
     * nova, o `migrate` não as recria (a migration já consta como executada), e o restore ficaria sem elas.
     */
    private const STRUCTURE_ONLY_TABLES = ['cache', 'cache_locks', 'sessions'];

    public function dump(string $gzipPath): void
    {
        /** @var array<string, mixed>|null $connection */
        $connection = config('database.connections.'.config('database.default'));

        if (! is_array($connection) || ($connection['driver'] ?? null) !== 'mysql') {
            throw new RuntimeException('O backup só sabe fazer o dump de um banco MySQL.');
        }

        $socket = (string) ($connection['unix_socket'] ?? '');
        $dsn = $socket !== ''
            ? sprintf('mysql:unix_socket=%s;dbname=%s', $socket, $connection['database'])
            : sprintf('mysql:host=%s;port=%s;dbname=%s', $connection['host'], $connection['port'], $connection['database']);

        $dump = new Mysqldump($dsn, (string) $connection['username'], (string) $connection['password'], [
            'compress' => CompressManagerFactory::GZIP,
            'default-character-set' => 'utf8mb4',
            'no-data' => self::STRUCTURE_ONLY_TABLES,
            'add-drop-table' => true,
            // Foto consistente numa transação só; sem LOCK TABLES, que o usuário da aplicação não precisa ter
            'single-transaction' => true,
            'lock-tables' => false,
        ]);

        $dump->start($gzipPath);
    }
}
