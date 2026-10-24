<?php

use FutoZs\DatabaseTools\Http\Controllers\DatabaseToolsController;
use Illuminate\Support\Facades\Route;

// Vegleges URL-ek: /api/client/servers/{server}/extensions/databasetools/...
Route::get('/sizes', [DatabaseToolsController::class, 'sizes'])->name('sizes');
Route::get('/{database}/export', [DatabaseToolsController::class, 'export'])->name('export');
Route::post('/{database}/import', [DatabaseToolsController::class, 'import'])->name('import');
Route::post('/{database}/import-remote', [DatabaseToolsController::class, 'importRemote'])->name('import-remote');
Route::post('/{database}/clear', [DatabaseToolsController::class, 'clear'])->name('clear');
