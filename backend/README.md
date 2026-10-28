# Backend

Laravel 13 em PHP 8.4, monolito modular (`app/Modules/{Access,Ministries,Content,Leads,Events,Platform}`). Detalhes de arquitetura em [`docs/architecture.md`](../docs/architecture.md); a visão geral e as versões fixadas estão no [`README`](../README.md) da raiz.

## Rodar

PHP e Composer rodam no container `app` (Apache + PHP 8.4 **sem OPcache**), a partir da raiz do repositório:

```bash
docker compose up -d
cp backend/.env.example backend/.env
docker compose exec app composer install
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate
```

A aplicação responde em http://localhost:8080 e o Mailpit em http://localhost:8025. Dentro do Docker o banco é `mysql:3306`; fora dele, `127.0.0.1:3316`.

## Testes e qualidade

```bash
docker compose exec app ./vendor/bin/pint --test           # Pint, preset laravel
docker compose exec app ./vendor/bin/phpstan analyse       # Larastan, nível 6
docker compose exec app ./vendor/bin/pest                  # unit, feature (MySQL real) e arch
docker compose exec app ./vendor/bin/pest --coverage --min=80
```

- Os feature tests usam **MySQL real** (banco `pibls_test`, criado pelo init do Docker Compose). O banco nunca é mockado.
- A cobertura (PCOV, só local e CI) mede apenas `Actions`, `Policies`, `ValueObjects` e `Enums` de `app/Modules/*` e `app/Shared/ValueObjects` (filtro em `phpunit.xml`). Enquanto não existir código nesses diretórios, o PHPUnit avisa que o filtro não casa com arquivo algum e o `--min=80` falha. O CI trata esse caso até os ValueObjects da T034.
- Nos testes, use as funções tipadas do plugin (`use function Pest\Laravel\get;`) em vez de `$this->get()`, que o Larastan não resolve.
- Para rodar a suíte no MySQL 5.7: `docker compose --profile mysql57 up -d mysql57` e `docker compose exec -e DB_HOST=mysql57 app ./vendor/bin/pest`.

## Estado do esqueleto

- As migrations `0001_01_01_*` (users, cache, jobs) vêm do esqueleto do Laravel e **serão substituídas** pelo schema completo na T024.
- Fora do projeto, de propósito: Vite/Node (o servidor não tem Node), `laravel/tinker`, `laravel/pail` e `laravel/pao`. Nenhuma dependência entra sem estar na Technology Stack.
- O `.env` local não é versionado; `.env.example` traz os valores do Docker Compose.
