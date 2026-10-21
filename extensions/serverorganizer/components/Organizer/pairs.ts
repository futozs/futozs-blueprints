import { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState } from '@/api/server/getServerResourceUsage';
import { ServerRole } from './types';

/**
 * Szerepek es parok - automatikusan, a szerver sajat beallitasaibol.
 *
 * A szerep a Startup ROLE valtozoja (ROLE=primary|backup bash .ptero/start.sh).
 * A par: ugyanaz a git repo (GIT_ADDRESS) + ag (BRANCH). Mindkettot csak
 * OLVASSUK - a Startup parancshoz es a valtozokhoz a kiegeszito nem nyul.
 */

const variable = (server: Server, env: string): string | null => {
    const found = (server.variables || []).find((entry) => entry.envVariable === env);
    if (!found) return null;

    const value = found.serverValue ?? found.defaultValue;
    return value && value.trim() ? value.trim() : null;
};

export const roleOf = (server: Server): ServerRole => {
    const fromVariable = (variable(server, 'ROLE') || '').toLowerCase();
    if (fromVariable === 'primary' || fromVariable === 'backup') return fromVariable;

    // A valtozo rejtett is lehet - ilyenkor a kifejtett Startup parancsbol olvassuk.
    const match = /(?:^|\s)ROLE=["']?(primary|backup)\b/i.exec(server.invocation || '');
    return match ? (match[1].toLowerCase() as ServerRole) : null;
};

/** 'https://user:token@github.com/futozs/racehub.hu.git' -> 'github.com/futozs/racehub.hu' */
const normalizeRepo = (url: string): string =>
    url
        .toLowerCase()
        .replace(/^[a-z]+:\/\//, '')
        .replace(/^[^@/]*@/, '')
        .replace(/\.git$/, '')
        .replace(/\/+$/, '');

export const repoOf = (server: Server): string | null => {
    const url = variable(server, 'GIT_ADDRESS');
    return url ? normalizeRepo(url) : null;
};

/** A kartya cime: a repo neve (pl. racehub.hu), kulonben a szerver neve. */
export const repoLabel = (repo: string | null): string | null => (repo ? repo.split('/').pop() || repo : null);

/**
 * Egy megjelenitesi egyseg: vagy egy par (primary + backup egy kartyan), vagy
 * egyetlen szerver. Az egyseg "horgonya" hordozza a csoportot es a sorrendet.
 */
export interface Unit {
    anchor: Server;
    primary: Server | null;
    backup: Server | null;
    /** Szerver, aminek nincs szerepe (nem lancolhato). */
    plain: Server | null;
    repo: string | null;
}

export const unitServers = (unit: Unit): Server[] =>
    [unit.primary, unit.backup, unit.plain].filter((server): server is Server => !!server);

export const isChainable = (unit: Unit): boolean => !!(unit.primary || unit.backup);

export const buildUnits = (servers: Server[]): Unit[] => {
    const byRepo = new Map<string, { primary: Server[]; backup: Server[] }>();
    const units: Unit[] = [];

    servers.forEach((server) => {
        const role = roleOf(server);
        const repo = repoOf(server);

        if (!role) {
            units.push({ anchor: server, primary: null, backup: null, plain: server, repo });
            return;
        }

        const key = (repo || 'uuid:' + server.uuid) + '#' + (variable(server, 'BRANCH') || '');
        const slot = byRepo.get(key) || { primary: [], backup: [] };
        slot[role].push(server);
        byRepo.set(key, slot);
    });

    byRepo.forEach((slot) => {
        // Egy reponal tobb azonos szerepu szerver is lehet: sorban parositjuk oket.
        const count = Math.max(slot.primary.length, slot.backup.length);
        for (let i = 0; i < count; i++) {
            const primary = slot.primary[i] || null;
            const backup = slot.backup[i] || null;
            const anchor = (primary || backup) as Server;
            units.push({ anchor, primary, backup, plain: null, repo: repoOf(anchor) });
        }
    });

    return units;
};

/* ------------------------------------------------------------ elo allapot */

export type LiveState = ServerPowerState | 'unknown';

const POLL_MS = 15000;

/**
 * Az osszes szerver elo allapota (fut / indul / all). A panel sajat soraival
 * azonos vegpont; a rendezeshez es a kartyak fejlecehez kell.
 */
export const useLiveStates = (servers: Server[] | null): Record<string, LiveState> => {
    const [states, setStates] = useState<Record<string, LiveState>>({});
    const key = (servers || []).map((server) => server.uuid).join(',');

    useEffect(() => {
        if (!servers || servers.length === 0) return;

        let cancelled = false;

        const poll = () =>
            Promise.all(
                servers.map((server) =>
                    server.status === 'suspended' || server.isTransferring || server.status === 'installing'
                        ? Promise.resolve<[string, LiveState]>([server.uuid, 'offline'])
                        : getServerResourceUsage(server.uuid)
                              .then((stats): [string, LiveState] => [server.uuid, stats.status])
                              .catch((): [string, LiveState] => [server.uuid, 'unknown'])
                )
            ).then((entries) => {
                if (cancelled) return;
                const next: Record<string, LiveState> = {};
                entries.forEach(([uuid, state]) => (next[uuid] = state));
                setStates(next);
            });

        poll();
        const timer = setInterval(poll, POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [key]);

    return states;
};

/** Kisebb = elobbre kerul: ami all vagy kapcsolodik, az kell elsonek. */
export const stateRank = (state: LiveState | undefined): number => {
    switch (state) {
        case 'offline':
            return 0;
        case 'stopping':
        case 'starting':
            return 1;
        case 'unknown':
        case undefined:
            return 2;
        default:
            return 3;
    }
};
