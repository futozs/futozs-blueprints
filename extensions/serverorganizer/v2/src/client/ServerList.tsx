import { useSyncExternalStore } from 'react';
import type { ViewProps } from '@pterodactyl/sdk';
import Organizer from '../../.shared/Organizer/index';
import { nativeListStore } from './platform';

/**
 * A dashboard szerverlistaja: elol a szervezo, alatta a panel sajat listaja
 * (Default) csak akkor, ha a szervezo ki van kapcsolva vagy hibara futott.
 */
function ServerList({ Default, ...props }: ViewProps<'dashboard.serverList'>) {
    const hidden = useSyncExternalStore(nativeListStore.subscribe, nativeListStore.hidden);

    return (
        <>
            <div className={props.className}>
                <Organizer />
            </div>
            {!hidden && <Default {...props} />}
        </>
    );
}

export default ServerList;
