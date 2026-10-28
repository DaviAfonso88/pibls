<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Database Strategy → ministries_groups. As FKs created_by/updated_by → users entram na migration de
// `users`, porque as duas tabelas se referenciam (users.ministry_id → ministries_groups.id).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ministries_groups', function (Blueprint $table) {
            $table->id();
            $table->string('category', 20);
            $table->string('name', 120);
            $table->mediumText('description')->nullable();
            $table->string('leaders_text', 500)->nullable();
            $table->string('schedule_text', 120)->nullable();
            $table->string('neighborhood', 80)->nullable();
            $table->text('private_address')->nullable(); // 🔒 cifrado pela aplicação (ADR-016); nunca público (BR-048)
            $table->string('contact_phone', 16)->nullable();
            $table->string('contact_email', 254)->nullable(); // interno: destino das notificações de MINISTERIO
            $table->unsignedInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->index(['category', 'is_active', 'display_order'], 'idx_ministries_groups_listing');
        });

        // CHECK só vale a partir do MySQL 8.0.16; no 5.7 é aceito e ignorado. A garantia principal é a aplicação.
        DB::statement(
            "ALTER TABLE ministries_groups ADD CONSTRAINT ck_ministries_groups_category CHECK (category IN ('MINISTERIO', 'GRUPO', 'CELULA'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('ministries_groups');
    }
};
