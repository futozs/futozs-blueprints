import http from '@/api/http';
import { OrganizerPrefs, defaultPrefs, PREFS_VERSION } from './types';
import { DEFAULT_CHAIN_CONFIG } from './Redundancy/types';

const ENDPOINT = '/api/client/extensions/serverorganizer/prefs';

const clampNumber = (value: any, min: number, max: number, fallback: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
};

/**
 * A szerverrol erkezo dokumentumot osszefesuljuk az alapertelmezessel, hogy egy
 * regebbi verzioban mentett (vagy hianyos) rekord se torje el a felulete.
 */
const normalize = (raw: any): OrganizerPrefs => {
    const base = defaultPrefs();

    if (!raw || typeof raw !== 'object') {
        return base;
    }

    return {
        version: PREFS_VERSION,
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
        sortMode: ['manual', 'name', 'status', 'role'].includes(raw.sortMode) ? raw.sortMode : base.sortMode,
        language: raw.language === 'hu' || raw.language === 'en' ? raw.language : null,
        chain: {
            stabilitySeconds: clampNumber(raw.chain?.stabilitySeconds, 5, 600, DEFAULT_CHAIN_CONFIG.stabilitySeconds),
            timeoutSeconds: clampNumber(raw.chain?.timeoutSeconds, 30, 3600, DEFAULT_CHAIN_CONFIG.timeoutSeconds),
            startScript:
                typeof raw.chain?.startScript === 'string' && raw.chain.startScript.trim()
                    ? raw.chain.startScript.slice(0, 256)
                    : DEFAULT_CHAIN_CONFIG.startScript,
        },
        groups: Array.isArray(raw.groups)
            ? raw.groups
                  .filter((g: any) => g && typeof g.id === 'string' && typeof g.name === 'string')
                  .map((g: any, index: number) => ({
                      id: g.id,
                      name: g.name,
                      color: typeof g.color === 'string' ? g.color : '#38bdf8',
                      icon: typeof g.icon === 'string' ? g.icon : null,
                      collapsed: g.collapsed === true,
                      order: typeof g.order === 'number' ? g.order : index,
                  }))
            : base.groups,
        servers:
            raw.servers && typeof raw.servers === 'object' && !Array.isArray(raw.servers)
                ? Object.keys(raw.servers).reduce((acc: Record<string, any>, key) => {
                      const s = raw.servers[key];
                      if (!s || typeof s !== 'object') return acc;

                      acc[key] = {
                          group: typeof s.group === 'string' ? s.group : null,
                          color: typeof s.color === 'string' ? s.color : null,
                          icon: typeof s.icon === 'string' ? s.icon : null,
                          imageUrl: typeof s.imageUrl === 'string' ? s.imageUrl : null,
                          role: s.role === 'primary' || s.role === 'backup' ? s.role : null,
                          order: typeof s.order === 'number' ? s.order : 0,
                      };
                      return acc;
                  }, {})
                : base.servers,
    };
};

export const getPrefs = async (): Promise<OrganizerPrefs> => {
    const { data } = await http.get(ENDPOINT);

    return normalize(data?.data);
};

export const savePrefs = async (prefs: OrganizerPrefs): Promise<void> => {
    await http.put(ENDPOINT, { data: prefs });
};
