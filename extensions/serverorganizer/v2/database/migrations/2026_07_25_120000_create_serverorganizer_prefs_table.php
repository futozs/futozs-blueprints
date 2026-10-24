<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A Server Organizer sajat tablaja. Felhasznalonkent egy sor, benne a
     * csoportok / sorrend / szinek / ikonok JSON-kent.
     *
     * Szandekosan NEM nyulunk semmilyen Pterodactyl core tablahoz.
     */
    public function up(): void
    {
        if (Schema::hasTable('serverorganizer_prefs')) {
            return;
        }

        Schema::create('serverorganizer_prefs', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->longText('data')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        Schema::table('serverorganizer_prefs', function (Blueprint $table) {
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('serverorganizer_prefs');
    }
};
