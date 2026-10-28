<?php

declare(strict_types=1);

namespace App\Providers;

use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadStore;
use App\Modules\Platform\Listeners\RegenerateSnapshots;
use App\Modules\Platform\Mail\Listeners\EnforceMailAllowlist;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use App\Modules\Platform\Snapshots\SnapshotSections;
use App\Modules\Platform\Snapshots\SnapshotWriter;
use App\Modules\Platform\Web\SitemapSources;
use App\Shared\Http\RateLimiters;
use App\Shared\Sanitizer\HtmlSanitizer;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\Server;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\ImageManager;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // O HTMLPurifier compila a definição uma vez e a guarda em disco (shared/storage na hospedagem)
        $this->app->singleton(
            HtmlSanitizer::class,
            fn () => new HtmlSanitizer(storage_path('framework/cache/htmlpurifier')),
        );

        // Snapshots públicos: os módulos de negócio registram as suas definições no registro; a Platform só itera
        $this->app->singleton(SnapshotRegistry::class);
        // Pedaços de um snapshot que são de outro módulo (os próximos eventos na home) e páginas extras do sitemap
        $this->app->singleton(SnapshotSections::class);
        $this->app->singleton(SitemapSources::class);
        $this->app->singleton(
            SnapshotWriter::class,
            fn () => new SnapshotWriter((string) config('pibls.snapshots_path')),
        );

        // Só o GD: a hospedagem compartilhada não tem Imagick garantido
        $this->app->singleton(UploadStore::class, fn () => new UploadStore(new ImageManager(new GdDriver)));

        // Documentação da API só em local e homologação (API_DOCS_ENABLED). Desligada, as rotas nem existem.
        // O export para docs/openapi.json (`scramble:export`) não depende das rotas e funciona sempre.
        if (config('pibls.api_docs_enabled') !== true) {
            Scramble::ignoreDefaultRoutes();
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // N+1 vira erro em local e no CI; em produção/homologação a aplicação segue sem lançar exceção.
        Model::preventLazyLoading(! $this->app->isProduction());

        RateLimiters::register();

        // Homologação: só a allowlist recebe e-mail de verdade (MAIL_ALLOWLIST)
        Event::listen(MessageSending::class, EnforceMailAllowlist::class);

        // Dado público mudou: regenera os snapshots JSON depois do commit (ADR-014)
        Event::listen(PublicContentChanged::class, RegenerateSnapshots::class);

        // Homologação roda com APP_ENV=production; a flag é que libera a documentação (local sempre libera).
        Gate::define('viewApiDocs', fn ($user = null) => config('pibls.api_docs_enabled') === true);

        // Mesma origem do site (ADR-008): um caminho relativo, igual em qualquer ambiente, para o documento versionado
        // em docs/openapi.json ser idêntico em todas as máquinas.
        Scramble::afterOpenApiGenerated(function (OpenApi $openApi): void {
            $openApi->servers = [Server::make('/api')->setDescription('Mesma origem')];
        });
    }
}
