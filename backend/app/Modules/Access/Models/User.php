<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use App\Modules\Ministries\Models\MinistryGroup;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;

/**
 * Usuário do painel. Criado, alterado e desativado só pelo phpMyAdmin (BR-077): a aplicação grava apenas
 * `password`, `password_changed_at` e `last_login_at`.
 *
 * @property int $id
 * @property string $name
 * @property string $email
 * @property int|null $ministry_id
 * @property bool $is_active
 * @property string $password
 * @property Carbon|null $password_changed_at
 * @property Carbon|null $last_login_at
 * @property-read MinistryGroup|null $ministry
 * @property-read Collection<int, UserPermission> $permissions
 */
#[UseFactory(UserFactory::class)]
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'password_changed_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<MinistryGroup, $this> */
    public function ministry(): BelongsTo
    {
        return $this->belongsTo(MinistryGroup::class, 'ministry_id');
    }

    /** @return HasMany<UserPermission, $this> */
    public function permissions(): HasMany
    {
        return $this->hasMany(UserPermission::class, 'user_id');
    }
}
