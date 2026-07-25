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
            readyPattern:
                typeof raw.chain?.readyPattern === 'string' && raw.chain.readyPattern.trim()
                    ? raw.chain.readyPattern.slice(0, 256)
                    : DEFAULT_CHAIN_CONFIG.readyPattern,
            timeoutSeconds: clampNumber(raw.chain?.timeoutSeconds, 60, 7200, DEFAULT_CHAIN_CONFIG.timeoutSeconds),
            startScript:
                typeof raw.chain?.startScript === 'string' && raw.chain.startScript.trim()
                    ? raw.chain.startScript.slice(0, 256)
                    : DEFAULT_CHAIN_CONFIG.startScript,
        },
        groups: Array.isArray(raw.groups)
            ? raw.groups
                  .filter((group: any) => group && typeof group.id === 'string' && typeof group.name === 'string')
                  .map((group: any, index: number) => ({
                      id: group.id,
                      name: group.name,
                      color: typeof group.color === 'string' ? group.color : '#38bdf8',
                      icon: typeof group.icon === 'string' ? group.icon : null,
                      collapsed: group.collapsed === true,
                      order: typeof group.order === 'number' ? group.order : index,
                  }))
            : base.groups,
        servers:
            raw.servers && typeof raw.servers === 'object' && !Array.isArray(raw.servers)
                ? Object.keys(raw.servers).reduce((acc: Record<string, any>, key) => {
                      const pref = raw.servers[key];
                      if (!pref || typeof pref !== 'object') return acc;

                      acc[key] = {
                          group: typeof pref.group === 'string' ? pref.group : null,
                          color: typeof pref.color === 'string' ? pref.color : null,
                          icon: typeof pref.icon === 'string' ? pref.icon : null,
                          imageUrl: typeof pref.imageUrl === 'string' ? pref.imageUrl : null,
                          role: pref.role === 'primary' || pref.role === 'backup' ? pref.role : null,
                          order: typeof pref.order === 'number' ? pref.order : 0,
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
