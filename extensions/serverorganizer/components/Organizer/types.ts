import type { Lang } from './i18n';
import { ChainConfig, DEFAULT_CHAIN_CONFIG } from './Redundancy/types';

export type { ChainConfig };

export type ServerRole = 'primary' | 'backup' | null;

export type SortMode = 'manual' | 'name' | 'status' | 'role';

export interface OrganizerGroup {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    collapsed: boolean;
    order: number;
}

export interface ServerPref {
    group: string | null;
    color: string | null;
    icon: string | null;
    imageUrl: string | null;
    role: ServerRole;
    order: number;
}

export interface OrganizerPrefs {
    version: number;
    enabled: boolean;
    sortMode: SortMode;
    /** null = a bongeszo nyelve alapjan */
    language: Lang | null;
    /** A lancolt ujrainditas beallitasai (minden csoportra kozos). */
    chain: ChainConfig;
    groups: OrganizerGroup[];
    servers: Record<string, ServerPref>;
}

export const PREFS_VERSION = 1;

export const UNGROUPED_ID = '__ungrouped__';

export const defaultServerPref = (order: number): ServerPref => ({
    group: null,
    color: null,
    icon: null,
    imageUrl: null,
    role: null,
    order,
});

export const defaultPrefs = (): OrganizerPrefs => ({
    version: PREFS_VERSION,
    enabled: true,
    sortMode: 'manual',
    language: null,
    chain: { ...DEFAULT_CHAIN_CONFIG },
    groups: [],
    servers: {},
});
