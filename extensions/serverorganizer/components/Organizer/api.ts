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
    };
};

export const getPrefs = async (): Promise<OrganizerPrefs> => {
    const { data } = await http.get(ENDPOINT);

    return normalize(data?.data);
};

export const savePrefs = async (prefs: OrganizerPrefs): Promise<void> => {
    await http.put(ENDPOINT, { data: prefs });
};
