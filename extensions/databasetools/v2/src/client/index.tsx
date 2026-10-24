import { definePterodactylExtension } from '@pterodactyl/sdk';
import Databases from './Databases';

export default definePterodactylExtension({
    setup({ views }) {
        views.override('server.databases', Databases);
    },
});
