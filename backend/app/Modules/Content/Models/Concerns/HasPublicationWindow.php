<?php

declare(strict_types=1);

namespace App\Modules\Content\Models\Concerns;

use App\Modules\Access\Models\User;
use App\Modules\Content\Enums\PublicationStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * O que boletim e mensagem têm em comum: a janela de publicação (BR-042) e quem alterou por último.
 *
 * @property Carbon $published_at
 * @property-read User|null $updater
 */
trait HasPublicationWindow
{
    /**
     * Só o que já está no ar: `published_at` no passado ou agora. O excluído sai sozinho (exclusão lógica).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('published_at', '<=', now());
    }

    public function status(): PublicationStatus
    {
        return $this->published_at->isFuture() ? PublicationStatus::Agendado : PublicationStatus::Publicado;
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
