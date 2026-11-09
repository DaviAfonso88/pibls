<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ADR-025: o painel escolhe se o formulário de inscrição pede o nome, o telefone e o e-mail. Migration *expand*: as três
// colunas nascem ligadas, então os eventos que já existem continuam pedindo os três campos, como antes.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->boolean('asks_participant_name')->default(true)->after('has_minors');
            $table->boolean('asks_phone')->default(true)->after('asks_participant_name');
            $table->boolean('asks_email')->default(true)->after('asks_phone');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['asks_participant_name', 'asks_phone', 'asks_email']);
        });
    }
};
