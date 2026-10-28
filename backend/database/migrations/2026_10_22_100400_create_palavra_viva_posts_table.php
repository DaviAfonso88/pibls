<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → palavra_viva_posts. Mesma técnica do boletim para a unicidade do slug (BR-032).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('palavra_viva_posts', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->string('slug', 160);
            $table->string('slug_active', 160)->nullable()
                ->storedAs('IF(deleted_at IS NULL, slug, NULL)');
            $table->mediumText('body'); // SanitizedHtml, até 50.000 caracteres
            $table->string('excerpt', 300); // texto puro gerado do body (Open Graph)
            $table->string('author_display', 120)->nullable();
            $table->string('youtube_url', 255)->nullable();
            $table->string('youtube_video_id', 20)->nullable();
            $table->dateTime('published_at');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('created_at')->nullable();
            $table->dateTime('updated_at')->nullable();
            $table->dateTime('deleted_at')->nullable();

            $table->unique('slug_active', 'uq_palavra_viva_slug_active');
            $table->index(['deleted_at', 'published_at'], 'idx_palavra_viva_public');
            $table->foreign('created_by', 'fk_palavra_viva_created_by')
                ->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by', 'fk_palavra_viva_updated_by')
                ->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('palavra_viva_posts');
    }
};
