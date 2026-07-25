import { DEFAULT_READY_PATTERN, FailureKind, LineLevel } from './patterns';

export interface ConsoleLine {
    text: string;
    level: LineLevel;
}

export type StepPhase =
    | 'pending' // meg nem kerult sorra
    | 'connecting' // websocket nyitasa
    | 'sending' // restart jel kikuldve
    | 'stopping' // leall
    | 'starting' // indul, fut a build
    | 'done'
    | 'failed'
    | 'skipped'; // egy korabbi lepes elbukott, ezert ide el sem jutottunk

export interface StepState {
    uuid: string;
    identifier: string;
    name: string;
    role: 'primary' | 'backup';
    phase: StepPhase;
    /** Mennyi ideje tart a lepes (csak kijelzesre, nem dont semmirol). */
    elapsed: number;
    /** A konzol sorai - ezt latja a felhasznalo elesben. */
    lines: ConsoleLine[];
    /** A mar elert build-lepesek kulcsai (PROGRESS_MARKERS). */
    progress: string[];
    failureKind: FailureKind | 'timeout' | 'offline' | 'aborted' | 'api' | null;
    /** A konkret sor vagy hibauzenet, ami miatt elbukott. */
    failureDetail: string | null;
}

export interface ChainState {
    running: boolean;
    startedAt: number | null;
    steps: StepState[];
    activeIndex: number | null;
    finishedAt: number | null;
    aborted: boolean;
}

export interface ChainConfig {
    /**
     * Az a konzolsor, ami azt jelenti "elindultam es fogadom a kereseket".
     * Regularis kifejezes. Nincs idozites: ez dont a sikerrol.
     */
    readyPattern: string;
    /**
     * Vegso biztonsagi hatar, hogy egy beragadt build ne varakoztasson orokke.
     * Nem finomhangolasra valo - bo alapertekkel indul.
     */
    timeoutSeconds: number;
    /**
     * A package.json "start" scriptje, ha automatikusan javitjuk.
     * A %PORT% helyere a Pterodactyl altal kiosztott port kerul.
     */
    startScript: string;
}

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
    readyPattern: DEFAULT_READY_PATTERN,
    timeoutSeconds: 1800,
    startScript: 'next start -p %PORT%',
};

export const isTerminal = (phase: StepPhase): boolean =>
    phase === 'done' || phase === 'failed' || phase === 'skipped';
