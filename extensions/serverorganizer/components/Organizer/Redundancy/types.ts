import { FailureKind } from './patterns';

export type StepPhase =
    | 'pending' // meg nem kerult sorra
    | 'connecting' // websocket nyitasa
    | 'sending' // restart jel kikuldve
    | 'stopping' // leall
    | 'starting' // indul
    | 'stabilising' // fut, a stabilitasi ablakot varjuk ki
    | 'done'
    | 'failed'
    | 'skipped'; // egy korabbi lepes elbukott, ezert ide el sem jutottunk

export interface StepState {
    uuid: string;
    identifier: string;
    name: string;
    role: 'primary' | 'backup';
    phase: StepPhase;
    /** Hany masodperce fut folyamatosan. */
    stableFor: number;
    /** Mennyi ideje tart az egesz lepes. */
    elapsed: number;
    /** A konzol utolso sorai - ezt latja a felhasznalo elesben. */
    lines: string[];
    /** Latta-e mar az app sajat "elindultam" uzenetet. */
    appReady: boolean;
    failureKind: FailureKind | 'timeout' | 'offline' | 'aborted' | 'api' | null;
    /** A konkret sor vagy hibauzenet, ami miatt elbukott. */
    failureDetail: string | null;
}

export interface ChainState {
    running: boolean;
    startedAt: number | null;
    steps: StepState[];
    /** Az eppen futo lepes indexe, vagy null. */
    activeIndex: number | null;
    finishedAt: number | null;
    aborted: boolean;
}

export interface ChainConfig {
    /** Hany masodpercig kell folyamatosan futnia, hogy sikeresnek szamitson. */
    stabilitySeconds: number;
    /** Ennyi ido utan feladjuk az adott lepest. */
    timeoutSeconds: number;
    /**
     * A package.json "start" scriptje, ha automatikusan javitjuk.
     * A %PORT% helyere a Pterodactyl altal kiosztott port kerul.
     */
    startScript: string;
}

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
    stabilitySeconds: 30,
    timeoutSeconds: 300,
    startScript: 'next start -p %PORT%',
};

export const isTerminal = (phase: StepPhase): boolean =>
    phase === 'done' || phase === 'failed' || phase === 'skipped';
