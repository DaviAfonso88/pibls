<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Database Strategy → leads_messages. `message` é cifrada pela aplicação (ADR-016), por isso TEXT e nunca pesquisável.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads_messages', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->string('status', 20)->default('NOVO');
            $table->string('name', 120)->nullable();
            $table->string('phone', 16)->nullable();
            $table->string('email', 254)->nullable();
            $table->string('neighborhood', 80)->nullable();
            $table->boolean('wants_visit')->nullable();
            $table->boolean('wants_cell_group')->nullable();
            $table->unsignedBigInteger('group_id')->nullable();
            $table->boolean('from_other_baptist_church')->nullable();
            $table->unsignedBigInteger('ministry_id')->nullable();
            $table->text('message')->nullable(); // 🔒
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->dateTime('consent_at');
            $table->string('consent_version', 20);
            $table->dateTime('status_changed_at'); // base da retenção
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->index(['type', 'status', 'created_at'], 'idx_leads_inbox');
            $table->index(['assigned_to', 'status'], 'idx_leads_assigned');
            $table->index('phone', 'idx_leads_phone');
            $table->index(['status', 'status_changed_at'], 'idx_leads_retention');
            $table->foreign('group_id', 'fk_leads_messages_group')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
            $table->foreign('ministry_id', 'fk_leads_messages_ministry')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
            $table->foreign('assigned_to', 'fk_leads_messages_assigned_to')
                ->references('id')->on('users')->restrictOnDelete();
        });

        DB::statement(
            "ALTER TABLE leads_messages ADD CONSTRAINT ck_leads_messages_type CHECK (type IN ('VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO', 'MINISTERIO'))"
        );
        DB::statement(
            "ALTER TABLE leads_messages ADD CONSTRAINT ck_leads_messages_status CHECK (status IN ('NOVO', 'EM_ATENDIMENTO', 'CONCLUIDO'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('leads_messages');
    }
};
