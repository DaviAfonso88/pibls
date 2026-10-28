<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → lead_activities. Só inclusão; apagada em cascata com o contato (BR-081).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id');
            $table->unsignedBigInteger('actor_user_id');
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20)->nullable();
            $table->unsignedBigInteger('assigned_to')->nullable(); // responsável depois da ação (sem FK, como no schema)
            $table->text('note')->nullable(); // 🔒 até 1.000 caracteres (BR-013)
            $table->dateTime('created_at');

            $table->index(['lead_id', 'created_at'], 'idx_lead_activities_lead');
            $table->foreign('lead_id', 'fk_lead_activities_lead')
                ->references('id')->on('leads_messages')->cascadeOnDelete();
            $table->foreign('actor_user_id', 'fk_lead_activities_actor')
                ->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_activities');
    }
};
