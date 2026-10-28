<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ADR-020, BR-083: momento do consentimento específico para dados de saúde. Migration *expand*: coluna nula, sem preencher
// o histórico (NULL = o formulário não tinha campo `sensitive` na hora da inscrição).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_registrations', function (Blueprint $table) {
            $table->dateTime('health_consent_at')->nullable()->after('consent_version');
        });
    }

    public function down(): void
    {
        Schema::table('event_registrations', function (Blueprint $table) {
            $table->dropColumn('health_consent_at');
        });
    }
};
