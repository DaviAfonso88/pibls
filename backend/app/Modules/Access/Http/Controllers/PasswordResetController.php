<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Actions\RequestPasswordReset;
use App\Modules\Access\Actions\ResetPassword;
use App\Modules\Access\Http\Requests\ForgotPasswordRequest;
use App\Modules\Access\Http\Requests\ResetPasswordRequest;
use Illuminate\Http\JsonResponse;

/** Redefinição de senha (RF-D06): pedir o link e definir a nova senha. */
final class PasswordResetController
{
    /** `POST /api/auth/forgot-password`: 200 sempre, com a mesma frase, exista ou não o e-mail. */
    public function forgot(ForgotPasswordRequest $request, RequestPasswordReset $requestReset): JsonResponse
    {
        $requestReset((string) $request->input('email'));

        return response()->json(['data' => [
            'message' => 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.',
        ]]);
    }

    /** `POST /api/auth/reset-password`: 200; 422 `INVALID_RESET_TOKEN` (BR-072) ou política de senha (BR-073). */
    public function reset(ResetPasswordRequest $request, ResetPassword $reset): JsonResponse
    {
        $reset(
            (string) $request->input('email'),
            (string) $request->input('token'),
            (string) $request->input('password'),
        );

        return response()->json(['data' => ['message' => 'Senha alterada. Entre com a nova senha.']]);
    }
}
