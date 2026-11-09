<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// ADR-025: o ministério responsável do evento passa a ser opcional. Migration *expand*: a coluna aceita NULL e os eventos
// que já existem continuam com o ministério que têm. A FK sai e volta porque o MySQL não altera coluna presa a uma
// constraint; o índice `idx_events_ministry` fica.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign('fk_events_ministry');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->unsignedBigInteger('ministry_id')->nullable()->change();
            $table->foreign('ministry_id', 'fk_events_ministry')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
        });
    }

    // Só volta se nenhum evento tiver ficado sem ministério
    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropForeign('fk_events_ministry');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->unsignedBigInteger('ministry_id')->nullable(false)->change();
            $table->foreign('ministry_id', 'fk_events_ministry')
                ->references('id')->on('ministries_groups')->restrictOnDelete();
        });
    }
};
