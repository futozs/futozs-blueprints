<?php

namespace FutoZs\DatabaseTools;

use Pterodactyl\Extensions\ExtensionProvider;

class DatabaseToolsProvider extends ExtensionProvider
{
    public function boot(): void
    {
        // routes/server.php -> /api/client/servers/{server}/extensions/databasetools
        $this->registerApiRoutes();
    }
}
