<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Cadastra um evento (CAP-12; BR-025, BR-026, BR-031, BR-032, BR-046). A descrição é sanitizada e o resumo gerado aqui, no
 * servidor. Nasce como rascunho, a não ser que o pedido já mande publicar.
 */
final class CreateEvent
{
    public function __construct(
        private readonly PrepareEventFields $prepare,
        private readonly EnsureEventSlugIsFree $ensureSlugIsFree,
        private readonly AssertEventDates $assertDates,
        private readonly PublishEvent $publish,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{title: string, slug: string, ministry_id: int, description: string, starts_at: CarbonImmutable, ends_at: CarbonImmutable|null, location: string, max_spots: int|null, registration_deadline: CarbonImmutable|null, has_minors: bool, form_schema: FormSchema}  $data
     */
    public function __invoke(array $data, bool $publish, User $actor): SavedEvent
    {
        ($this->ensureSlugIsFree)($data['slug']);
        ($this->assertDates)($data['starts_at'], $data['ends_at'], $data['registration_deadline']);
        $derived = ($this->prepare)($data['description']);

        return $this->ensureSlugIsFree->guard(function () use ($data, $publish, $derived, $actor): SavedEvent {
            return DB::transaction(function () use ($data, $publish, $derived, $actor): SavedEvent {
                $event = Event::query()->create([
                    'title' => $data['title'],
                    'slug' => $data['slug'],
                    'ministry_id' => $data['ministry_id'],
                    'starts_at' => $data['starts_at'],
                    'ends_at' => $data['ends_at'],
                    'location' => $data['location'],
                    'max_spots' => $data['max_spots'],
                    'registration_deadline' => $data['registration_deadline'],
                    'has_minors' => $data['has_minors'],
                    'form_schema' => $data['form_schema']->toArray(),
                    'is_published' => false,
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                    ...$derived['fields'],
                ]);

                $this->audit->record(AuditAction::EventCreated, 'event', $event->getKey(), [
                    'after' => ['slug' => $event->slug, 'title' => $event->title, 'ministry_id' => $event->ministry_id],
                ]);

                if ($publish) {
                    ($this->publish)($event, $actor, refreshSnapshots: false);
                    event(new PublicContentChanged(['home']));
                }

                return new SavedEvent($event, $derived['sanitizationWarning']);
            });
        });
    }
}
