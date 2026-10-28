<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → event_registrations (R2). `answers` é cifrada pela aplicação (ADR-016).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_registrations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('event_id');
            $table->string('participant_name', 120);
            $table->string('participant_name_normalized', 120); // minúsculas, sem acentos, espaços colapsados (BR-022)
            $table->string('phone', 16);
            $table->string('email', 254)->nullable();
            $table->string('guardian_name', 120)->nullable();
            $table->string('guardian_phone', 16)->nullable();
            $table->dateTime('guardian_consent_at')->nullable();
            $table->text('answers'); // 🔒 JSON cifrado [{key, label, type, value}]
            $table->dateTime('consent_at');
            $table->string('consent_version', 20);
            $table->dateTime('created_at');

            $table->unique(['event_id', 'phone', 'participant_name_normalized'], 'uq_event_registrations_person');
            $table->index(['event_id', 'created_at'], 'idx_event_registrations_event');
            $table->foreign('event_id', 'fk_event_registrations_event')
                ->references('id')->on('events')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_registrations');
    }
};
