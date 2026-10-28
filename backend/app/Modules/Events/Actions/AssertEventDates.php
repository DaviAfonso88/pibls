<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Shared\ValueObjects\EventPeriod;
use App\Shared\ValueObjects\InvalidValueObject;
use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * Coerência das datas do evento: o término não vem antes do início (BR-025) e o prazo de inscrição não passa do início
 * (BR-026). Vale sobre o resultado final, então ao mudar só uma das datas a outra entra com o valor que já estava gravado.
 */
final class AssertEventDates
{
    public function __invoke(CarbonInterface $startsAt, ?CarbonInterface $endsAt, ?CarbonInterface $registrationDeadline): void
    {
        $errors = [];

        try {
            EventPeriod::of($startsAt, $endsAt);
        } catch (InvalidValueObject) {
            $errors['ends_at'] = [__('business.BR-025')];
        }

        if ($registrationDeadline !== null && $registrationDeadline->greaterThan($startsAt)) {
            $errors['registration_deadline'] = [__('business.BR-026')];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
