<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// ADR-026: o boletim tem um PDF ou um link externo, nunca os dois e nunca nenhum (BR-084). Migration *expand*: a coluna é
// nova, as do PDF passam a aceitar NULL e os boletins que já existem não mudam. O MySQL 5.7 aceita a CHECK mas a ignora;
// nele, quem garante a regra é só a aplicação.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bulletins', function (Blueprint $table) {
            $table->string('external_url', 500)->nullable()->after('pdf_size_bytes');
            $table->string('pdf_path', 255)->nullable()->change();
            $table->unsignedInteger('pdf_size_bytes')->nullable()->change();
        });

        DB::statement('ALTER TABLE bulletins ADD CONSTRAINT ck_bulletins_pdf_or_link CHECK ((pdf_path IS NULL) <> (external_url IS NULL))');
    }

    // Só volta se nenhum boletim tiver ficado sem PDF. `DROP CHECK` não existe antes do MySQL 8.0.16, e lá a CHECK nem vale
    public function down(): void
    {
        if (version_compare(DB::connection()->getServerVersion(), '8.0.16', '>=')) {
            DB::statement('ALTER TABLE bulletins DROP CHECK ck_bulletins_pdf_or_link');
        }

        Schema::table('bulletins', function (Blueprint $table) {
            $table->dropColumn('external_url');
            $table->string('pdf_path', 255)->nullable(false)->change();
            $table->unsignedInteger('pdf_size_bytes')->nullable(false)->change();
        });
    }
};
