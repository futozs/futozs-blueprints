/*
 * Platform reteg - Pterodactyl 2.x (natív extension).
 *
 * Ugyanazt az exportlistat adja, mint az 1.x-es components/Organizer/platform.tsx,
 * csak az SDK-ra epitve. A build (scripts/sync-shared.mjs) a kozos kod
 * './platform' importjat erre a fajlra koti.
 */
import { useEffect, type ReactNode } from 'react';
import { ListRow, PanelLink, Spinner, http, useCurrentUser } from '@pterodactyl/sdk';
import { View } from '@pterodactyl/sdk/theme';

export { http, Spinner };

export type ServerPowerState = 'offline' | 'starting' | 'running' | 'stopping';

/** Az 1.x-es '@/api/server/getServer' Server tipusanak az a resze, amit a szervezo hasznal. */
export interface Server {
    id: string;
    internalId: number;
    uuid: string;
    name: string;
    status: string | null;
    isTransferring: boolean;
    invocation: string;
    limits: { memory: number; swap: number; disk: number; io: number; cpu: number; threads: string | null };
    allocations: { id: number; ip: string; alias: string | null; port: number; notes: string | null; isDefault: boolean }[];
    variables: {
        name: string;
        description: string;
        envVariable: string;
        defaultValue: string;
        serverValue: string | null;
        isEditable: boolean;
        rules: string[];
    }[];
    /** Az API eredeti objektuma - a panel sajat nezetei (szerverkartya) ezt kerik. */
    raw: any;
}

const list = (relationship: any): any[] => (relationship && Array.isArray(relationship.data) ? relationship.data : []);

const toServer = (raw: any): Server => {
    const a = raw.attributes;

    return {
        id: a.identifier,
        internalId: a.internal_id,
        uuid: a.uuid,
        name: a.name,
        status: a.status,
        isTransferring: !!a.is_transferring,
        invocation: a.invocation || '',
        limits: { ...a.limits },
        allocations: list(a.relationships?.allocations).map(({ attributes: x }: any) => ({
            id: x.id,
            ip: x.ip,
            alias: x.ip_alias,
            port: x.port,
            notes: x.notes,
            isDefault: x.is_default,
        })),
        variables: list(a.relationships?.variables).map(({ attributes: x }: any) => ({
            name: x.name,
            description: x.description,
            envVariable: x.env_variable,
            defaultValue: x.default_value,
            serverValue: x.server_value,
            isEditable: x.is_editable,
            rules: typeof x.rules === 'string' ? x.rules.split('|') : x.rules || [],
        })),
        raw,
    };
};

export const getServers = async ({ page, type }: { page?: number; type?: string }) => {
    const { data } = await http.get('/api/client', { params: { page, type, per_page: 100 } });
    const pagination = data.meta.pagination;

    return {
        items: (data.data as any[]).map(toServer),
        pagination: { currentPage: pagination.current_page, totalPages: pagination.total_pages },
    };
};

export const getServerResourceUsage = async (uuid: string) => {
    const { data } = await http.get(`/api/client/servers/${uuid}/resources`);
    const a = data.attributes;

    return {
        status: a.current_state as ServerPowerState,
        isSuspended: a.is_suspended,
        memoryUsageInBytes: a.resources.memory_bytes,
        cpuUsagePercent: a.resources.cpu_absolute,
        diskUsageInBytes: a.resources.disk_bytes,
        networkRxInBytes: a.resources.network_rx_bytes,
        networkTxInBytes: a.resources.network_tx_bytes,
        uptime: a.resources.uptime,
    };
};

export const getWebsocketToken = async (uuid: string): Promise<{ token: string; socket: string }> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/websocket`);

    return { token: data.data.token, socket: data.data.socket };
};

type Handler = (...args: any[]) => void;

/**
 * A Wings konzol-websocket kliense, az 1.x-es '@/plugins/Websocket' feluletevel:
 * on / send / setToken / connect / close / removeAllListeners es a SOCKET_CLOSE esemeny.
 * Bontas utan ujracsatlakozik, es ujra hitelesit.
 */
export class Websocket {
    private socket: WebSocket | null = null;
    private url: string | null = null;
    private token = '';
    private listeners = new Map<string, Set<Handler>>();
    private attempts = 0;
    private closed = false;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    on(event: string, handler: Handler): this {
        (this.listeners.get(event) || this.listeners.set(event, new Set()).get(event)!).add(handler);
        return this;
    }

    removeAllListeners(): this {
        this.listeners.clear();
        return this;
    }

    private emit(event: string, ...args: any[]) {
        this.listeners.get(event)?.forEach((handler) => handler(...args));
    }

    connect(url: string): this {
        this.url = url;
        this.closed = false;
        this.open();
        return this;
    }

    private open() {
        if (!this.url || this.closed) return;

        const socket = new WebSocket(this.url);
        this.socket = socket;

        socket.onopen = () => {
            this.attempts = 0;
            this.emit('SOCKET_OPEN');
            this.authenticate();
        };
        socket.onmessage = (message) => {
            try {
                const { event, args } = JSON.parse(String(message.data));
                this.emit(event, ...(Array.isArray(args) ? args : []));
            } catch (error) {
                /* hibas csomag - eldobjuk */
            }
        };
        socket.onerror = () => this.emit('SOCKET_ERROR');
        socket.onclose = () => {
            this.emit('SOCKET_CLOSE');
            if (this.closed || this.attempts >= 20) return;
            this.attempts += 1;
            this.retryTimer = setTimeout(() => this.open(), 2000);
        };
    }

    private authenticate() {
        if (this.token) this.send('auth', this.token);
    }

    setToken(token: string, isUpdate = false): this {
        this.token = token;
        if (isUpdate) this.authenticate();
        return this;
    }

    send(event: string, payload?: string | string[]) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(
            JSON.stringify({ event, args: Array.isArray(payload) ? payload : payload === undefined ? [] : [payload] })
        );
    }

    close() {
        this.closed = true;
        if (this.retryTimer) clearTimeout(this.retryTimer);
        this.socket?.close();
        this.socket = null;
    }
}

/* ------------------------------------------------------------ formazok */

const UNITS = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];

export const mbToBytes = (megabytes: number): number => Math.floor(megabytes * 1024 * 1024);

export function bytesToString(bytes: number, decimals = 2): string {
    if (bytes < 1) return '0 Bytes';

    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
    const value = Number((bytes / Math.pow(1024, i)).toFixed(Math.max(0, Math.floor(decimals))));

    return `${value} ${UNITS[i]}`;
}

/** IPv6 cimet szogletes zarojelbe tesz, hogy a ':port' egyertelmu legyen. */
export const ip = (value: string): string => (/([a-f0-9:]+:+)+[a-f0-9]+/.test(value) ? `[${value}]` : value);

/* ------------------------------------------------------------ panel */

export const useIsRootAdmin = (): boolean => !!useCurrentUser()?.rootAdmin;

export const ServerLink = ({ server, className, children }: { server: Server; className?: string; children: ReactNode }) => (
    <PanelLink destination={{ to: '/server/$id', params: { id: server.id } }} className={className}>
        {children}
    </PanelLink>
);

/** A panel sajat szerverkartyaja (dashboard.serverCard nezet), linkkent a szerver oldalara. */
export const ServerRow = ({ server }: { server: Server }) => (
    <ListRow destination={{ to: '/server/$id', params: { id: server.id } }} aria-label={server.name}>
        <View name={'dashboard.serverCard'} server={server.raw} />
    </ListRow>
);

/*
 * A panel listaja: 2.x-en a szervezo a 'dashboard.serverList' nezetet irja felul,
 * es ez a tarolo donti el, hogy a nezet a sajat (Default) listat is kirajzolja-e.
 */
let nativeHidden = true;
const subscribers = new Set<() => void>();

const setNativeHidden = (hidden: boolean) => {
    if (nativeHidden === hidden) return;
    nativeHidden = hidden;
    subscribers.forEach((notify) => notify());
};

export const nativeListStore = {
    subscribe: (notify: () => void) => {
        subscribers.add(notify);
        return () => subscribers.delete(notify);
    },
    hidden: () => nativeHidden,
};

export const useHideNativeList = (hidden: boolean) => {
    useEffect(() => {
        setNativeHidden(hidden);

        return () => setNativeHidden(false);
    }, [hidden]);
};

export const restoreNativeList = () => setNativeHidden(false);
