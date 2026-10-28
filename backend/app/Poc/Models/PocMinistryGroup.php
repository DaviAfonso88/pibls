<?php

declare(strict_types=1);

namespace App\Poc\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * PoC F0-03 (T013). REMOVER na T015.
 */
final class PocMinistryGroup extends Model
{
    protected $table = 'poc_ministry_groups';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
