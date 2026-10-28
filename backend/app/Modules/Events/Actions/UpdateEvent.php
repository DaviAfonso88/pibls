<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Support\Facades\DB;

/**
 * Altera um evento (CAP-12). Só os campos enviados mudam; a descrição, quando vem, é sanitizada de novo e o resumo refeito.
 *
 * - Datas: o resultado final precisa ser coerente (BR-025, BR-026), mesmo mudando só uma delas.
 * - Vagas: nunca abaixo do número de inscritos (BR-027).
 * - Formulário: remover campo ou trocar o tipo de um campo com inscrições existentes exige `confirm_schema_change` (BR-029).
 * - `is_published` publica ou despublica; "Encerrar inscrições" é `registration_deadline` = agora.
 * - A página inicial é regenerada uma vez só, e só se o evento está ou estava publicado.
 */
final class UpdateEvent
{
    public function __construct(
        private readonly PrepareEventFields $prepare,
        private readonly EnsureEventSlugIsFree $ensureSlugIsFree,
        private readonly AssertEventDates $assertDates,
        private readonly PublishEvent $publish,
        private readonly UnpublishEvent $unpublish,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $changes  `title`, `slug`, `ministry_id`, `description`, `starts_at`, `ends_at`, `location`,
     *                                         `max_spots`, `registration_deadline`, `has_minors`, `is_published` e `form_schema`
     *                                         (um `FormSchema`); datas em UTC
     */
    public function __invoke(Event $event, array $changes, bool $confirmSchemaChange, User $actor): SavedEvent
    {
        if (isset($changes['slug'])) {
            ($this->ensureSlugIsFree)((string) $changes['slug'], (int) $event->getKey());
        }

        $this->assertCoherentDates($event, $changes);
        $this->assertRegistrationRules($event, $changes, $confirmSchemaChange);

        $derived = array_key_exists('description', $changes)
            ? ($this->prepare)((string) $changes['description'])
            : ['fields' => [], 'sanitizationWarning' => false];

        $plain = array_diff_key($changes, ['description' => true, 'form_schema' => true, 'is_published' => true]);

        return $this->ensureSlugIsFree->guard(function () use ($event, $changes, $plain, $derived, $actor): SavedEvent {
            return DB::transaction(function () use ($event, $changes, $plain, $derived, $actor): SavedEvent {
                $wasPublished = $event->is_published;
                $before = ['slug' => $event->slug, 'title' => $event->title, 'ministry_id' => $event->ministry_id];

                $event->fill([...$plain, ...$derived['fields']]);
                if (isset($changes['form_schema']) && $changes['form_schema'] instanceof FormSchema) {
                    $event->form_schema = $changes['form_schema']->toArray();
                }

                $changed = array_values(array_diff(array_keys($event->getDirty()), ['excerpt']));

                if ($changed !== []) {
                    $event->updated_by = $actor->getKey();
                    $event->save();

                    $this->audit->record(AuditAction::EventUpdated, 'event', $event->getKey(), [
                        'fields' => $changed,
                        'before' => $before,
                        'after' => ['slug' => $event->slug, 'title' => $event->title, 'ministry_id' => $event->ministry_id],
                    ]);
                }

                $publicationChanged = $this->applyPublication($event, $changes, $actor);

                if (($changed !== [] || $publicationChanged) && ($wasPublished || $event->is_published)) {
                    event(new PublicContentChanged(['home']));
                }

                return new SavedEvent($event, $derived['sanitizationWarning']);
            });
        });
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    private function applyPublication(Event $event, array $changes, User $actor): bool
    {
        if (! array_key_exists('is_published', $changes)) {
            return false;
        }

        return $changes['is_published'] === true
            ? ($this->publish)($event, $actor, refreshSnapshots: false)
            : ($this->unpublish)($event, $actor, refreshSnapshots: false);
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    private function assertCoherentDates(Event $event, array $changes): void
    {
        if (array_intersect_key($changes, ['starts_at' => true, 'ends_at' => true, 'registration_deadline' => true]) === []) {
            return;
        }

        ($this->assertDates)(
            $changes['starts_at'] ?? $event->starts_at,
            array_key_exists('ends_at', $changes) ? $changes['ends_at'] : $event->ends_at,
            array_key_exists('registration_deadline', $changes) ? $changes['registration_deadline'] : $event->registration_deadline,
        );
    }

    /**
     * @param  array<string, mixed>  $changes
     */
    private function assertRegistrationRules(Event $event, array $changes, bool $confirmSchemaChange): void
    {
        $touchesSpots = isset($changes['max_spots']);
        $touchesSchema = isset($changes['form_schema']) && $changes['form_schema'] instanceof FormSchema;

        if (! $touchesSpots && ! $touchesSchema) {
            return;
        }

        $registrations = $event->registrations()->count();

        if ($touchesSpots && $changes['max_spots'] < $registrations) {
            throw new BusinessRuleException(
                'SPOTS_BELOW_REGISTRATIONS',
                $registrations === 1
                    ? 'Já existe 1 inscrito; o número de vagas não pode ser menor.'
                    : str_replace('N inscritos', "{$registrations} inscritos", __('business.BR-027')),
            );
        }

        if ($touchesSchema && $registrations > 0 && ! $confirmSchemaChange) {
            $broken = $changes['form_schema']->breakingChangesFrom(FormSchema::from($event->form_schema));

            if ($broken !== []) {
                throw new BusinessRuleException(
                    'SCHEMA_CHANGE_NEEDS_CONFIRMATION',
                    __('business.BR-029'),
                    array_map(fn (string $key): array => ['field' => 'form_schema', 'code' => $key, 'message' => __('business.BR-029')], $broken),
                );
            }
        }
    }
}
