<?php

namespace FutoZs\ServerOrganizer;

use Pterodactyl\Extensions\ExtensionProvider;

class ServerOrganizerProvider extends ExtensionProvider
{
    public function boot(): void
    {
        // routes/client.php -> /api/client/extensions/serverorganizer, ugyanaz az
        // URL, mint 1.x-en a Blueprint client routere: a frontend kodja kozos.
        $this->registerApiRoutes();
    }
}
