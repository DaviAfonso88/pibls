<?php

declare(strict_types=1);

namespace App\Modules\Platform\Doctor;

final readonly class CheckResult
{
    public function __construct(
        public string $name,
        public CheckStatus $status,
        public string $message,
    ) {}

    public static function ok(string $name, string $message): self
    {
        return new self($name, CheckStatus::Ok, $message);
    }

    public static function warning(string $name, string $message): self
    {
        return new self($name, CheckStatus::Warning, $message);
    }

    public static function error(string $name, string $message): self
    {
        return new self($name, CheckStatus::Error, $message);
    }

    /**
     * @return array{name: string, status: string, message: string}
     */
    public function toArray(): array
    {
        return ['name' => $this->name, 'status' => $this->status->value, 'message' => $this->message];
    }
}
