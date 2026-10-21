import type { LineLevel, Milestone } from './startsh';

export interface ConsoleLine {
    text: string;
    level: LineLevel;
    /** Elvalaszto sor ("ujrainditas 12:34:56"), nem a szerver irta. */
    divider?: boolean;
}

export type StepPhase =
    | 'pending' // meg nem kerult sorra
    | 'sending' // restart kuldve a power API-n
    | 'stopping' // leall
    | 'starting' // a .ptero/start.sh dolgozik (frissites, build, inditas)
    | 'warming' // fut ("Ready in"), a start.sh bemelegit es rogziti a commitot
    | 'done'
    | 'failed'
    | 'skipped'; // egy korabbi lepes elbukott, ide el sem jutottunk

export type FailureKind = 'crash' | 'timeout' | 'aborted' | 'api';

export interface StepState {
    uuid: string;
    name: string;
    role: 'primary' | 'backup';
    phase: StepPhase;
    startedAt: number | null;
    finishedAt: number | null;
    failureKind: FailureKind | null;
    /** Az utolso "HIBA:" sor a start.sh-bol, ha volt. */
    failureDetail: string | null;
}

export interface LiveStats {
    state: string;
    cpu: number;
    memory: number;
    memoryLimit: number;
    uptime: number;
}

/** Szerverenkenti elo adat - a lanctol fuggetlenul, a kepernyo megnyitasatol. */
export interface Live {
    connected: boolean;
    stats: LiveStats | null;
    lines: ConsoleLine[];
    /** Amit a start.sh az aktualis futasban mar elert. */
    reached: Milestone[];
    /** Az aktualis tevekenyseg kulcsa (i18n) es a nyers sor. */
    activity: string | null;
    activityDetail: string | null;
    /** "git: 1a2b3c4 uzenet" - melyik kod fut. */
    commit: string | null;
    buildSkipped: boolean;
    lastError: string | null;
}

export interface ChainState {
    running: boolean;
    steps: StepState[];
    activeIndex: number | null;
    finishedAt: number | null;
    aborted: boolean;
}

export const isTerminal = (phase: StepPhase): boolean =>
    phase === 'done' || phase === 'failed' || phase === 'skipped';
