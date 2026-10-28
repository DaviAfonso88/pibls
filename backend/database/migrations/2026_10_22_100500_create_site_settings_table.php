<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Database Strategy → site_settings: uma linha por chave (`SettingKey`), valor em JSON validado pelo schema da chave.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->json('value');
            $table->boolean('is_public')->default(false); // lista de permissão pública (BR-050)
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->foreign('updated_by', 'fk_site_settings_updated_by')
                ->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
