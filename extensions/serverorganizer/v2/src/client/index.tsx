import { definePterodactylExtension } from '@pterodactyl/sdk';
// A kozos (1.x-szel megosztott) kod masolata - scripts/sync-shared.mjs tolti fel.
import '../../.shared/styles.css';
import ServerList from './ServerList';

export default definePterodactylExtension({
    setup({ views }) {
        views.override('dashboard.serverList', ServerList);
    },
});
