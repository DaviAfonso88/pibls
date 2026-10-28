<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → audit_logs. Só inclusão; `changes` guarda apenas dados não pessoais.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->dateTime('occurred_at', 3);
            $table->unsignedBigInteger('actor_user_id')->nullable(); // NULL = sistema ou anônimo
            $table->string('action', 60);
            $table->string('resource_type', 40)->nullable();
            $table->string('resource_id', 60)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->char('correlation_id', 26)->nullable(); // ULID da requisição
            $table->json('changes')->nullable();

            $table->index(['resource_type', 'resource_id'], 'idx_audit_logs_resource');
            $table->index(['actor_user_id', 'occurred_at'], 'idx_audit_logs_actor');
            $table->index('occurred_at', 'idx_audit_logs_occurred');
            $table->foreign('actor_user_id', 'fk_audit_logs_actor')
                ->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
