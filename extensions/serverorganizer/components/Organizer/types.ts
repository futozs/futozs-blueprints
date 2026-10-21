import type { Lang } from './i18n';

export type ServerRole = 'primary' | 'backup' | null;

/** 'status' = elo allapot (a hibas / leallt szerverek elore kerulnek). */
export type SortMode = 'manual' | 'name' | 'status';

export interface OrganizerGroup {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    collapsed: boolean;
    order: number;
}

/**
 * Szerverenkenti megjelenes. A szerep (primary / backup) NINCS itt: azt a
 * szerver Startup ROLE valtozojabol olvassuk, igy sosem csuszhat el.
 */
export interface ServerPref {
    group: string | null;
    color: string | null;
    icon: string | null;
    imageUrl: string | null;
    order: number;
}

export interface OrganizerPrefs {
    version: number;
    enabled: boolean;
    sortMode: SortMode;
    /** null = a bongeszo nyelve alapjan */
    language: Lang | null;
    groups: OrganizerGroup[];
    servers: Record<string, ServerPref>;
}

export const PREFS_VERSION = 2;

export const UNGROUPED_ID = '__ungrouped__';

export const defaultServerPref = (order: number): ServerPref => ({
    group: null,
    color: null,
    icon: null,
    imageUrl: null,
    order,
});

export const defaultPrefs = (): OrganizerPrefs => ({
    version: PREFS_VERSION,
    enabled: true,
    sortMode: 'manual',
    language: null,
    groups: [],
    servers: {},
});
