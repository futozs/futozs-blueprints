<?php

namespace FutoZs\ServerOrganizer\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Egy felhasznalo szervezesi beallitasai.
 *
 * A 'data' oszlop egy JSON dokumentum - szandekosan nem normalizalt, mert ez
 * felhasznaloi preferencia (csoportok, sorrend, szinek), nem relacios adat.
 */
class ServerOrganizerPreference extends Model
{
    protected $table = 'serverorganizer_prefs';

    protected $fillable = [
        'user_id',
        'data',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'data' => 'array',
    ];
}
