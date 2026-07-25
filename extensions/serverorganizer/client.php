<?php

use Illuminate\Support\Facades\Route;
use Pterodactyl\BlueprintFramework\Extensions\serverorganizer\ServerOrganizerController;

/*
| Endpoint elotag: /api/client/extensions/serverorganizer
|
| A Blueprint 'blueprint/client-api' middleware-e kezeli a hitelesitest, igy a
| panel frontendje a sajat session sutijevel eri el ezeket a vegpontokat.
*/

Route::get('/prefs', [ServerOrganizerController::class, 'index']);
Route::put('/prefs', [ServerOrganizerController::class, 'update']);
