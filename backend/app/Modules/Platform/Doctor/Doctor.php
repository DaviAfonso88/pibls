<?php

declare(strict_types=1);

namespace App\Modules\Platform\Doctor;

use Throwable;

/**
 * Checagem profunda do ambiente (architecture.md → Infrastructure → `pibls:doctor`). Roda sob demanda e, sobretudo,
 * antes de cada ativação de release (`finalize.php`): se alguma checagem der `Error`, a release anterior continua
 * ativa. Substitui a "infraestrutura como código" que a hospedagem compartilhada não permite (DevOps).
 */
final class Doctor
{
    public const MIN_PHP = '8.4.0';

    /** Primeira versão do MySQL com coluna JSON e coluna gerada *stored* (ADR-007). */
    public const MIN_MYSQL = '5.7.8';

    /** Extensões que o projeto usa (Technology Stack) mais as que o sanitizador de HTML precisa. */
    private const EXTENSIONS = [
        'pdo_mysql', 'mbstring', 'openssl', 'sodium', 'gd', 'fileinfo', 'curl', 'zip', 'intl', 'bcmath',
        'ctype', 'dom', 'libxml', 'tokenizer', 'xml', 'zlib',
    ];

    /** Mínimos desejados de Infrastructure → Dimensionamento (MultiPHP INI), em bytes ou segundos. */
    private const MIN_MEMORY_BYTES = 256 * 1024 * 1024;

    private const MIN_UPLOAD_BYTES = 12 * 1024 * 1024;

    private const MIN_POST_BYTES = 13 * 1024 * 1024;

    private const MIN_EXECUTION_SECONDS = 60;

    private const DISK_ERROR_BYTES = 100 * 1024 * 1024;

    private const DISK_WARNING_BYTES = 500 * 1024 * 1024;

    public function __construct(private readonly SystemProbe $system) {}

    /**
     * @return list<CheckResult>
     */
    public function run(): array
    {
        return [
            $this->phpVersion(),
            $this->extensions(),
            ...$this->iniLimits(),
            $this->webp(),
            ...$this->writableDirectories(),
            $this->database(),
            $this->applicationKey(),
            $this->debugMode(),
            $this->pixAlertRecipients(),
            $this->diskSpace(),
            $this->opcache(),
        ];
    }

    /**
     * @param  list<CheckResult>  $results
     */
    public static function overall(array $results): CheckStatus
    {
        $statuses = array_map(fn (CheckResult $result) => $result->status, $results);

        return match (true) {
            in_array(CheckStatus::Error, $statuses, true) => CheckStatus::Error,
            in_array(CheckStatus::Warning, $statuses, true) => CheckStatus::Warning,
            default => CheckStatus::Ok,
        };
    }

    /** Converte `256M`, `12M`, `1G`, `512K` ou `1048576` em bytes. `-1` (sem limite) vira `PHP_INT_MAX`. */
    public static function bytes(string $value): int
    {
        $value = trim($value);
        if ($value === '-1') {
            return PHP_INT_MAX;
        }

        $number = (int) $value;

        return match (strtoupper(substr($value, -1))) {
            'G' => $number * 1024 ** 3,
            'M' => $number * 1024 ** 2,
            'K' => $number * 1024,
            default => $number,
        };
    }

    private function phpVersion(): CheckResult
    {
        $version = $this->system->phpVersion();

        return version_compare($version, self::MIN_PHP, '>=')
            ? CheckResult::ok('PHP', "Versão {$version}.")
            : CheckResult::error('PHP', "Versão {$version}: o portal exige PHP ".self::MIN_PHP.' ou superior. Escolha o PHP 8.4 no "Selecionar versão do PHP" do cPanel.');
    }

    private function extensions(): CheckResult
    {
        $missing = array_values(array_filter(
            self::EXTENSIONS,
            fn (string $extension) => ! $this->system->extensionLoaded($extension),
        ));

        return $missing === []
            ? CheckResult::ok('Extensões do PHP', 'Todas presentes ('.count(self::EXTENSIONS).').')
            : CheckResult::error('Extensões do PHP', 'Faltam: '.implode(', ', $missing).'. Ative no "Selecionar versão do PHP" do cPanel.');
    }

    /**
     * @return list<CheckResult>
     */
    private function iniLimits(): array
    {
        return [
            $this->bytesLimit('memory_limit', self::MIN_MEMORY_BYTES, '256M'),
            $this->bytesLimit('upload_max_filesize', self::MIN_UPLOAD_BYTES, '12M'),
            $this->bytesLimit('post_max_size', self::MIN_POST_BYTES, '13M'),
            $this->executionTime(),
        ];
    }

    private function bytesLimit(string $key, int $minimum, string $wanted): CheckResult
    {
        $value = $this->system->iniValue($key);

        if ($value === null || $value === '') {
            return CheckResult::warning($key, 'Não foi possível ler o valor.');
        }

        return self::bytes($value) >= $minimum
            ? CheckResult::ok($key, "Valor {$value} (mínimo {$wanted}).")
            : CheckResult::error($key, "Valor {$value}, abaixo do mínimo de {$wanted}. Ajuste no \"MultiPHP INI Editor\" do cPanel.");
    }

    private function executionTime(): CheckResult
    {
        $value = $this->system->iniValue('max_execution_time');

        if ($value === null || $value === '') {
            return CheckResult::warning('max_execution_time', 'Não foi possível ler o valor.');
        }

        // 0 = sem limite (é o que o PHP em linha de comando usa, e o ativador roda por ele)
        return ((int) $value === 0 || (int) $value >= self::MIN_EXECUTION_SECONDS)
            ? CheckResult::ok('max_execution_time', "Valor {$value} s (mínimo ".self::MIN_EXECUTION_SECONDS.' s).')
            : CheckResult::error('max_execution_time', "Valor {$value} s, abaixo do mínimo de ".self::MIN_EXECUTION_SECONDS.' s. Ajuste no "MultiPHP INI Editor" do cPanel.');
    }

    private function webp(): CheckResult
    {
        return $this->system->gdSupportsWebp()
            ? CheckResult::ok('WebP no GD', 'Suportado.')
            : CheckResult::error('WebP no GD', 'O GD não tem suporte a WebP, necessário para os banners dos eventos. Peça ao suporte da hospedagem.');
    }

    /**
     * @return list<CheckResult>
     */
    private function writableDirectories(): array
    {
        $directories = [
            'uploads/' => (string) config('filesystems.disks.uploads.root'),
            'data/ (snapshots)' => (string) config('pibls.snapshots_path'),
            'storage/' => storage_path(),
            'storage/logs' => storage_path('logs'),
            'storage/app' => storage_path('app'),
            'storage/framework/cache' => storage_path('framework/cache'),
            'storage/framework/sessions' => storage_path('framework/sessions'),
            // O `optimize` do ativador compila as views aqui, antes de a release entrar no ar
            'storage/framework/views' => storage_path('framework/views'),
            'bootstrap/cache' => base_path('bootstrap/cache'),
        ];

        $results = [];
        foreach ($directories as $label => $path) {
            $results[] = $this->system->canWriteTo($path)
                ? CheckResult::ok("Escrita em {$label}", $path)
                : CheckResult::error("Escrita em {$label}", "Sem permissão de escrita em {$path}.");
        }

        return $results;
    }

    private function database(): CheckResult
    {
        try {
            $version = $this->system->databaseVersion();
        } catch (Throwable) {
            // A mensagem da exceção traz host e usuário; fica só o aviso
            return CheckResult::error('Banco de dados', 'Não foi possível conectar. Confira as credenciais DB_* no .env.');
        }

        if (stripos($version, 'mariadb') !== false) {
            return CheckResult::warning('Banco de dados', "{$version}: o CI testa MySQL 5.7 e 8.0, não MariaDB.");
        }

        if (preg_match('/^\d+\.\d+\.\d+/', $version, $match) !== 1) {
            return CheckResult::warning('Banco de dados', 'Conectou, mas não reconheci a versão informada.');
        }

        return version_compare($match[0], self::MIN_MYSQL, '>=')
            ? CheckResult::ok('Banco de dados', "MySQL {$version}.")
            : CheckResult::error('Banco de dados', "MySQL {$version}: o schema exige ".self::MIN_MYSQL.' ou superior (colunas JSON e geradas).');
    }

    private function applicationKey(): CheckResult
    {
        return (string) config('app.key') !== ''
            ? CheckResult::ok('APP_KEY', 'Definida.')
            : CheckResult::error('APP_KEY', 'Não definida. Os campos cifrados e as sessões dependem dela.');
    }

    private function debugMode(): CheckResult
    {
        return app()->isProduction() && config('app.debug') === true
            ? CheckResult::error('APP_DEBUG', 'Ligado em produção/homologação: vazaria detalhes internos. Use APP_DEBUG=false.')
            : CheckResult::ok('APP_DEBUG', config('app.debug') === true ? 'Ligado (ambiente de desenvolvimento).' : 'Desligado.');
    }

    private function pixAlertRecipients(): CheckResult
    {
        /** @var list<string> $recipients */
        $recipients = (array) config('pibls.pix_alert_recipients', []);
        $invalid = array_filter($recipients, fn (string $email) => filter_var($email, FILTER_VALIDATE_EMAIL) === false);

        if ($recipients !== [] && $invalid === []) {
            return CheckResult::ok('PIX_ALERT_RECIPIENTS', count($recipients).' destinatário(s) configurado(s).');
        }

        $message = $recipients === []
            ? 'Não configurado: sem isso, nenhuma alteração do PIX é aceita (BR-063).'
            : 'Há endereço inválido na lista.';

        // Em produção e homologação isso é requisito de funcionamento; no desenvolvimento, só um lembrete
        return app()->isProduction()
            ? CheckResult::error('PIX_ALERT_RECIPIENTS', $message)
            : CheckResult::warning('PIX_ALERT_RECIPIENTS', $message);
    }

    private function diskSpace(): CheckResult
    {
        $free = $this->system->freeDiskBytes(storage_path());

        if ($free === null) {
            return CheckResult::warning('Espaço em disco', 'Não foi possível medir.');
        }

        $megabytes = (int) floor($free / (1024 * 1024));

        return match (true) {
            $free < self::DISK_ERROR_BYTES => CheckResult::error('Espaço em disco', "Só {$megabytes} MB livres: risco de falhar ao extrair a release."),
            $free < self::DISK_WARNING_BYTES => CheckResult::warning('Espaço em disco', "{$megabytes} MB livres: pouco."),
            default => CheckResult::ok('Espaço em disco', "{$megabytes} MB livres."),
        };
    }

    private function opcache(): CheckResult
    {
        return $this->system->opcacheEnabled()
            ? CheckResult::ok('OPcache', 'Ligado. A hospedagem prevista não o tem (ADR-005): o desempenho aqui sai melhor que o de produção.')
            : CheckResult::ok('OPcache', 'Desligado, como na hospedagem prevista (ADR-005).');
    }
}
