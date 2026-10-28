<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * Configuração do site: uma linha por chave (`SettingKey`). Só as chaves com `is_public` saem pela API pública
 * e pelos snapshots (BR-050).
 *
 * @property string $key
 * @property array<mixed> $value
 * @property bool $is_public
 */
#[Table(name: 'site_settings', key: 'key', keyType: 'string', incrementing: false)]
#[Fillable(['value', 'updated_by'])]
class SiteSetting extends Model
{
    public const CREATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value' => 'array',
            'is_public' => 'boolean',
        ];
    }
}
