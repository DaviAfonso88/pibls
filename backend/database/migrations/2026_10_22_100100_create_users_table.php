<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → users, sessions, password_reset_tokens.
// A aplicação só escreve `password`, `password_changed_at` e `last_login_at` (BR-077);
// o resto é provisionado pelo phpMyAdmin.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('email', 254);
            $table->string('password', 255);
            $table->unsignedBigInteger('ministry_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->rememberToken(); // não usado ("lembrar-me" não existe); mantido por compatibilidade
            $table->dateTime('password_changed_at')->nullable();
            $table->dateTime('last_login_at')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->unique('email', 'uq_users_email');
            $table->index('ministry_id', 'idx_users_ministry');
            $table->foreign('ministry_id', 'fk_users_ministry')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
        });

        Schema::table('ministries_groups', function (Blueprint $table) {
            $table->foreign('created_by', 'fk_ministries_groups_created_by')
                ->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by', 'fk_ministries_groups_updated_by')
                ->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email', 254)->primary();
            $table->string('token', 255); // hash
            $table->dateTime('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id', 255)->primary();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity');

            $table->index('user_id', 'idx_sessions_user');
            $table->index('last_activity', 'idx_sessions_last_activity');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');

        Schema::table('ministries_groups', function (Blueprint $table) {
            $table->dropForeign('fk_ministries_groups_created_by');
            $table->dropForeign('fk_ministries_groups_updated_by');
        });

        Schema::dropIfExists('users');
    }
};
