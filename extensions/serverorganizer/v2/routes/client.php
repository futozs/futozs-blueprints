<?php

use FutoZs\ServerOrganizer\Http\Controllers\PreferenceController;
use Illuminate\Support\Facades\Route;

// Vegleges URL: /api/client/extensions/serverorganizer/prefs
Route::get('/prefs', [PreferenceController::class, 'index'])->name('prefs.index');
Route::put('/prefs', [PreferenceController::class, 'update'])->name('prefs.update');
