<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → permissions, role_templates, user_permissions.
// `user_permissions` é escrita só pelo phpMyAdmin (BR-077); os dados das duas primeiras vêm da migration de seed.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->string('description', 200);
            $table->boolean('is_own_scope')->default(false);
        });

        Schema::create('role_templates', function (Blueprint $table) {
            $table->string('role_code', 40);
            $table->string('permission_key', 60);

            $table->primary(['role_code', 'permission_key']);
            $table->foreign('permission_key', 'fk_role_templates_permission')
                ->references('key')->on('permissions')->restrictOnDelete();
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('role_code', 40); // papel de origem (rótulo)
            $table->string('permission_key', 60);
            $table->dateTime('created_at')->nullable()->useCurrent();

            $table->unique(['user_id', 'role_code', 'permission_key'], 'uq_user_permissions');
            $table->index('user_id', 'idx_user_permissions_user');
            $table->foreign('user_id', 'fk_user_permissions_user')
                ->references('id')->on('users')->cascadeOnDelete();
            // RESTRICT impede chave digitada errada no phpMyAdmin
            $table->foreign('permission_key', 'fk_user_permissions_permission')
                ->references('key')->on('permissions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('role_templates');
        Schema::dropIfExists('permissions');
    }
};
