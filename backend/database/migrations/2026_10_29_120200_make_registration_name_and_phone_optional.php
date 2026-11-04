<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ADR-025: num evento que não pede o nome ou o telefone, a inscrição fica sem eles. Migration *expand*: as colunas aceitam
// NULL e as inscrições que já existem não mudam. A constraint única de BR-022 fica: com NULL ela não compara, então a
// duplicidade só é barrada quando o formulário pede os dois campos.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_registrations', function (Blueprint $table) {
            $table->string('participant_name', 120)->nullable()->change();
            $table->string('participant_name_normalized', 120)->nullable()->change();
            $table->string('phone', 16)->nullable()->change();
        });
    }

    // Só volta se nenhuma inscrição tiver ficado sem nome ou sem telefone
    public function down(): void
    {
        Schema::table('event_registrations', function (Blueprint $table) {
            $table->string('participant_name', 120)->nullable(false)->change();
            $table->string('participant_name_normalized', 120)->nullable(false)->change();
            $table->string('phone', 16)->nullable(false)->change();
        });
    }
};
