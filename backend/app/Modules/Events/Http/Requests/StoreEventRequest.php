<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\Event;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Shared\Support\PublicationInstant;
use App\Shared\ValueObjects\InvalidValueObject;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * `POST /api/admin/events`: o evento inteiro (contracts/openapi.yaml → EventInput). Quem só tem `eventos.write.own` cria
 * apenas no próprio ministério (403 nos outros). As datas sem fuso valem em Brasília. A coerência das datas (BR-025,
 * BR-026) e as regras do formulário (BR-031) vêm depois: as primeiras, da Action; as do formulário, daqui.
 */
final class StoreEventRequest extends FormRequest
{
    public const SLUG_PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

    private FormSchema $schema;

    public function authorize(): bool
    {
        $ministryId = is_numeric($this->input('ministry_id')) ? (int) $this->input('ministry_id') : null;

        Gate::authorize('create', [Event::class, $ministryId]);

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'slug' => ['required', 'string', 'max:160', 'regex:'.self::SLUG_PATTERN],
            'ministry_id' => ['required', 'integer', Rule::exists('ministries_groups', 'id')->where('is_active', true)],
            'description' => ['required', 'string', 'max:20000'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date'],
            'location' => ['required', 'string', 'max:200'],
            'max_spots' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'registration_deadline' => ['nullable', 'date'],
            'has_minors' => ['nullable', 'boolean'],
            'is_published' => ['nullable', 'boolean'],
            'form_schema' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['slug.regex' => 'Use só letras minúsculas, números e hífens, sem acento.'];
    }

    protected function passedValidation(): void
    {
        $this->schema = self::parseSchema($this->input('form_schema', []));
    }

    /**
     * @return array{title: string, slug: string, ministry_id: int, description: string, starts_at: CarbonImmutable, ends_at: CarbonImmutable|null, location: string, max_spots: int|null, registration_deadline: CarbonImmutable|null, has_minors: bool, form_schema: FormSchema}
     */
    public function fields(): array
    {
        return [
            'title' => trim((string) $this->input('title')),
            'slug' => (string) $this->input('slug'),
            'ministry_id' => $this->integer('ministry_id'),
            'description' => (string) $this->input('description'),
            'starts_at' => PublicationInstant::parse((string) $this->input('starts_at')) ?? CarbonImmutable::now('UTC'),
            'ends_at' => PublicationInstant::parse($this->filled('ends_at') ? (string) $this->input('ends_at') : null),
            'location' => trim((string) $this->input('location')),
            'max_spots' => $this->filled('max_spots') ? $this->integer('max_spots') : null,
            'registration_deadline' => PublicationInstant::parse($this->filled('registration_deadline') ? (string) $this->input('registration_deadline') : null),
            'has_minors' => $this->boolean('has_minors'),
            'form_schema' => $this->schema,
        ];
    }

    public function publish(): bool
    {
        return $this->boolean('is_published');
    }

    /**
     * Monta o formulário; a regra violada (BR-031) vira erro do campo `form_schema`.
     *
     * @throws ValidationException
     */
    public static function parseSchema(mixed $rows): FormSchema
    {
        try {
            return FormSchema::from(is_array($rows) ? $rows : []);
        } catch (InvalidValueObject $e) {
            throw ValidationException::withMessages(['form_schema' => [$e->getMessage()]]);
        }
    }
}
