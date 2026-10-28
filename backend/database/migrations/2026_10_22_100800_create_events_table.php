<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → events (R2). O schema existe desde a F0-06; o módulo fica desligado por `FEATURE_EVENTS`.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->string('slug', 160);
            $table->unsignedBigInteger('ministry_id');
            $table->mediumText('description'); // SanitizedHtml, até 20.000 caracteres
            $table->string('excerpt', 300);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('location', 200);
            $table->string('banner_path', 255)->nullable(); // variante pequena: sufixo -800
            $table->unsignedInteger('max_spots')->nullable(); // NULL = ilimitado
            $table->dateTime('registration_deadline')->nullable();
            $table->boolean('has_minors')->default(false);
            $table->boolean('is_published')->default(false);
            $table->json('form_schema'); // a aplicação grava `[]` quando não há campos
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->unique('slug', 'uq_events_slug');
            $table->index(['is_published', 'starts_at'], 'idx_events_public');
            $table->index('ministry_id', 'idx_events_ministry');
            $table->foreign('ministry_id', 'fk_events_ministry')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
            $table->foreign('created_by', 'fk_events_created_by')
                ->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by', 'fk_events_updated_by')
                ->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
