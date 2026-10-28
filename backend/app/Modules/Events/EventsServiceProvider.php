<?php

declare(strict_types=1);

namespace App\Modules\Events;

use App\Modules\Events\Events\RegistrationCreated;
use App\Modules\Events\Listeners\QueueRegistrationConfirmation;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Events\Policies\EventPolicy;
use App\Modules\Events\Policies\EventRegistrationPolicy;
use App\Modules\Events\Snapshots\UpcomingEventsSection;
use App\Modules\Events\Web\EventsSitemapSource;
use App\Modules\Platform\Snapshots\SnapshotSections;
use App\Modules\Platform\Web\SitemapSources;
use Illuminate\Support\Facades\Event as EventFacade;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class EventsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(Event::class, EventPolicy::class);
        Gate::policy(EventRegistration::class, EventRegistrationPolicy::class);

        // Síncrono, de propósito: a confirmação entra na fila na transação da inscrição
        EventFacade::listen(RegistrationCreated::class, [QueueRegistrationConfirmation::class, 'handle']);

        // Registradas sempre; cada uma confere a flag `events` na hora de responder, então ligar ou desligar a flag vale
        // sem recarregar nada (e os testes podem trocá-la)
        $this->app->make(SnapshotSections::class)->register($this->app->make(UpcomingEventsSection::class));
        $this->app->make(SitemapSources::class)->register($this->app->make(EventsSitemapSource::class));
    }
}
