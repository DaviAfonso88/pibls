<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PoC F0-03 (T013): tabelas só para a consulta com join. REMOVER na T015.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('poc_categories', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 40)->unique();
            $table->string('name', 80);
            $table->unsignedSmallInteger('display_order');
        });

        Schema::create('poc_ministry_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('poc_categories');
            $table->string('name', 120);
            $table->string('neighborhood', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('display_order');
            $table->timestamps();

            $table->index(['is_active', 'display_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('poc_ministry_groups');
        Schema::dropIfExists('poc_categories');
    }
};
