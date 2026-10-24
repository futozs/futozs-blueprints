/*
 * Platform reteg - Pterodactyl 1.x (Blueprint).
 *
 * A szervezo kozos kodja a panelhez KIZAROLAG ezen a fajlon keresztul nyul.
 * A 2.x-es (natív extension) build ugyanezt az exportlistat a
 * v2/src/client/platform.tsx-bol kapja: a Vite a './platform' importot oda
 * iranyitja at. Ha itt valami uj kerul be, a v2 oldalon is meg kell irni.
 */
import React, { useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { Link } from 'react-router-dom';
import http from '@/api/http';
import getServers from '@/api/getServers';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState } from '@/api/server/getServerResourceUsage';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { Websocket } from '@/plugins/Websocket';
import Spinner from '@/components/elements/Spinner';
import ServerRow from '@/components/dashboard/ServerRow';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';

export type { Server, ServerPowerState };
export {
    http,
    getServers,
    getServerResourceUsage,
    getWebsocketToken,
    Websocket,
    Spinner,
    ServerRow,
    bytesToString,
    ip,
    mbToBytes,
};

export const useIsRootAdmin = (): boolean => useStoreState((state: any) => !!state.user.data?.rootAdmin);

/** Link egy szerver oldalara (a panel sajat routere). */
export const ServerLink = ({ server, className, children }: { server: Server; className?: string; children: React.ReactNode }) => (
    <Link to={`/server/${server.id}`} className={className}>
        {children}
    </Link>
);

/**
 * A panel sajat szerverlistajanak elrejtese, amig a szervezo aktiv.
 * 1.x-en a lista a szervezo testvere, a styles.css ezt a body osztaly alapjan rejti el.
 */
export const useHideNativeList = (hidden: boolean) => {
    useEffect(() => {
        document.body.classList.toggle('so-active', hidden);

        return () => document.body.classList.remove('so-active');
    }, [hidden]);
};

/** Hiba eseten azonnal vissza a panel listajat. */
export const restoreNativeList = () => {
    try {
        document.body.classList.remove('so-active');
    } catch (error) {
        /* ha meg ez sem megy, mar ugysem tudunk mit tenni */
    }
};
