<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Database Strategy → bulletins. Exclusão lógica (ADR-009): a unicidade da edição vale só entre os não excluídos,
// por coluna gerada *stored* (o MySQL não tem índice parcial).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bulletins', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('edition_number');
            $table->unsignedInteger('edition_number_active')->nullable()
                ->storedAs('IF(deleted_at IS NULL, edition_number, NULL)');
            $table->date('reference_date');
            $table->string('title', 150);
            $table->text('summary_text')->nullable();
            $table->string('pdf_path', 255);
            $table->unsignedInteger('pdf_size_bytes');
            $table->dateTime('published_at');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();
            $table->dateTime('deleted_at')->nullable();

            $table->unique('edition_number_active', 'uq_bulletins_edition_active');
            $table->index(['deleted_at', 'published_at'], 'idx_bulletins_public');
            $table->index('reference_date', 'idx_bulletins_reference_date');
            $table->foreign('created_by', 'fk_bulletins_created_by')
                ->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by', 'fk_bulletins_updated_by')
                ->references('id')->on('users')->nullOnDelete();
        });

        DB::statement('ALTER TABLE bulletins ADD CONSTRAINT ck_bulletins_edition_positive CHECK (edition_number > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('bulletins');
    }
};
