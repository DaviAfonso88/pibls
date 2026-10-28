<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Models\Event;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Shared\Support\PublicationInstant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * `PATCH /api/admin/events/{id}`: os mesmos campos do cadastro, todos opcionais. Serve também para publicar e despublicar
 * (`is_published`) e para "Encerrar inscrições" (`registration_deadline` = agora). Evento de outro ministério, para quem só
 * tem `.own`, é 404 (BR-030); passar o evento para outro ministério exige poder escrever nos dois.
 */
final class UpdateEventRequest extends FormRequest
{
    private ?FormSchema $schema = null;

    public function authorize(): bool
    {
        Gate::authorize('manage', $this->route('event'));

        // Um ministry_id que não é número cai na validação (422); só o que é número passa pela permissão
        if (is_numeric($this->input('ministry_id'))) {
            Gate::authorize('moveTo', [Event::class, (int) $this->input('ministry_id')]);
        }

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:150'],
            'slug' => ['sometimes', 'required', 'string', 'max:160', 'regex:'.StoreEventRequest::SLUG_PATTERN],
            'ministry_id' => ['sometimes', 'required', 'integer', Rule::exists('ministries_groups', 'id')->where('is_active', true)],
            'description' => ['sometimes', 'required', 'string', 'max:20000'],
            'starts_at' => ['sometimes', 'required', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date'],
            'location' => ['sometimes', 'required', 'string', 'max:200'],
            'max_spots' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000'],
            'registration_deadline' => ['sometimes', 'nullable', 'date'],
            'has_minors' => ['sometimes', 'required', 'boolean'],
            'is_published' => ['sometimes', 'required', 'boolean'],
            'form_schema' => ['sometimes', 'array'],
            'confirm_schema_change' => ['sometimes', 'nullable', 'boolean'],
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
        if ($this->exists('form_schema')) {
            $this->schema = StoreEventRequest::parseSchema($this->input('form_schema'));
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach (['title', 'location'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = trim((string) $this->input($key));
            }
        }

        foreach (['slug', 'description'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = (string) $this->input($key);
            }
        }

        if ($this->exists('ministry_id')) {
            $changes['ministry_id'] = $this->integer('ministry_id');
        }

        if ($this->exists('starts_at')) {
            $changes['starts_at'] = PublicationInstant::parse((string) $this->input('starts_at'));
        }

        foreach (['ends_at', 'registration_deadline'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = PublicationInstant::parse($this->filled($key) ? (string) $this->input($key) : null);
            }
        }

        if ($this->exists('max_spots')) {
            $changes['max_spots'] = $this->filled('max_spots') ? $this->integer('max_spots') : null;
        }

        foreach (['has_minors', 'is_published'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = $this->boolean($key);
            }
        }

        if ($this->schema !== null) {
            $changes['form_schema'] = $this->schema;
        }

        return $changes;
    }

    public function confirmsSchemaChange(): bool
    {
        return $this->boolean('confirm_schema_change');
    }
}
