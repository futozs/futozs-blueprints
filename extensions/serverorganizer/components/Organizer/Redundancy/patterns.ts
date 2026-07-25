import { stripAnsi } from './ansi';

/**
 * Konzol-mintak.
 *
 * A siker eldontese NEM idozitessel tortenik, hanem abbol, amit az alkalmazas
 * kiir magarol. Egy Next.js build percekig tarthat, es a vegen egyertelmuen
 * megmondja, hogy fut-e ("Ready in ..."). Ezt olvassuk.
 *
 * Ket kategoria van, es a kulonbseg szandekos:
 *  - FAILURE: megallitja a lancot. Csak egyertelmuen vegzetes sorok.
 *  - NOTICE:  csak kiemeli a sort. Semmit nem allit meg.
 */

export type FailureKind = 'package' | 'pull' | 'port' | 'crash' | 'build';

export interface FailurePattern {
    kind: FailureKind;
    match: RegExp;
}

export const FAILURE_PATTERNS: FailurePattern[] = [
    /* --- a build maga hasalt el --- */
    { kind: 'build', match: /Failed to compile/i },
    { kind: 'build', match: /Build error occurred/i },
    { kind: 'build', match: /^\s*Type error:/i },
    { kind: 'build', match: /error TS\d+:/i },

    /* --- package.json: konkret, gepi hibakodok --- */
    { kind: 'package', match: /npm ERR!\s+code\s+EJSONPARSE/i },
    { kind: 'package', match: /npm ERR!\s+JSON\.parse/i },
    { kind: 'package', match: /npm ERR!\s+Missing script/i },
    { kind: 'package', match: /Couldn't find a package\.json/i },
    { kind: 'package', match: /ENOENT.*package\.json/i },

    /* --- git pull: a pull tenylegesen megallt --- */
    { kind: 'pull', match: /Your local changes to the following files would be overwritten/i },
    { kind: 'pull', match: /Please commit your changes or stash them/i },
    { kind: 'pull', match: /The following untracked working tree files would be overwritten/i },
    { kind: 'pull', match: /Automatic merge failed/i },
    { kind: 'pull', match: /fatal: Not a git repository/i },
    { kind: 'pull', match: /fatal: could not read Username/i },
    { kind: 'pull', match: /Pulling is not possible because you have unmerged files/i },

    /* --- port: a szerver nem tud elindulni, es van ra gombunk --- */
    { kind: 'port', match: /EADDRINUSE/i },
    { kind: 'port', match: /address already in use/i },

    /* --- osszeomlas: csak a visszafordithatatlan eset --- */
    { kind: 'crash', match: /FATAL ERROR:.*JavaScript heap out of memory/i },
];

export interface NoticePattern {
    match: RegExp;
    level: 'error' | 'notice';
}

/**
 * Kiemeljuk, de NEM allitjuk meg tole a lancot. A 'Cannot find module' azert van
 * itt, mert sok felallasban teljesen normalis uzemi zaj.
 */
export const NOTICE_PATTERNS: NoticePattern[] = [
    { match: /Cannot find module/i, level: 'notice' },
    { match: /UnhandledPromiseRejection/i, level: 'notice' },
    { match: /node:internal\//i, level: 'notice' },
    { match: /^\s*SyntaxError:/i, level: 'error' },
    { match: /^\s*TypeError:/i, level: 'error' },
    { match: /^\s*ReferenceError:/i, level: 'error' },
    { match: /npm ERR!/i, level: 'error' },
    { match: /npm WARN/i, level: 'notice' },
    { match: /Update available/i, level: 'notice' },
    { match: /^\s*at\s+\S+\s+\(/i, level: 'notice' },
];

/**
 * A build/indulas lepesei, ahogy a konzolon megjelennek. Ezt mutatjuk a
 * felhasznalonak elo checklistakent - igy latszik hol tart, ido helyett.
 *
 * A sorrend szamit: a felulet ebben a sorrendben jeleniti meg oket.
 */
export interface ProgressMarker {
    key: string;
    labelKey: string;
    match: RegExp;
}

export const PROGRESS_MARKERS: ProgressMarker[] = [
    { key: 'pull', labelKey: 'stepPull', match: /Already up to date|Fast-forward|Updating [0-9a-f]{7}|files? changed/i },
    { key: 'install', labelKey: 'stepInstall', match: /added \d+ packages|up to date, audited|Installing dependencies/i },
    { key: 'prisma', labelKey: 'stepPrisma', match: /Generated Prisma Client/i },
    { key: 'migrate', labelKey: 'stepMigrate', match: /No pending migrations to apply|migrations? (have been )?applied|Database is now in sync/i },
    { key: 'building', labelKey: 'stepBuilding', match: /Creating an optimized production build/i },
    { key: 'compiled', labelKey: 'stepCompiled', match: /Compiled successfully/i },
    { key: 'types', labelKey: 'stepTypes', match: /Finished TypeScript/i },
    { key: 'pages', labelKey: 'stepPages', match: /Generating static pages/i },
    // Csak a tenyleges inditas: a "Next.js x.y.z" banner a build alatt is megjelenik,
    // ezert az nem jo jelzes arra hogy mar a szerver indul.
    { key: 'starting', labelKey: 'stepStarting', match: /^\s*>\s*next start|^\s*-\s*Local:\s+http/i },
];

/**
 * Alapertelmezett "keszen vagyok" minta. A Next.js a `next start` vegen irja ki,
 * es ez az a pillanat, amikor a szerver tenylegesen fogadja a kereseket.
 */
export const DEFAULT_READY_PATTERN = 'Ready in|ready - started server on|Listening on port|server started';

export const compileReadyPattern = (source: string): RegExp => {
    try {
        return new RegExp(source, 'i');
    } catch (error) {
        // Hibas sajat minta eseten inkabb az alapertelmezettre esunk vissza,
        // mint hogy a lanc soha ne fejezodjon be.
        return new RegExp(DEFAULT_READY_PATTERN, 'i');
    }
};

export type LineLevel = 'normal' | 'notice' | 'error' | 'ready' | 'progress';

export interface LineVerdict {
    level: LineLevel;
    failure: FailurePattern | null;
    ready: boolean;
    progressKey: string | null;
}

export const classifyLine = (raw: string, readyPattern: RegExp): LineVerdict => {
    const text = stripAnsi(raw);

    const failure = FAILURE_PATTERNS.find((pattern) => pattern.match.test(text)) || null;
    if (failure) {
        return { level: 'error', failure, ready: false, progressKey: null };
    }

    if (readyPattern.test(text)) {
        return { level: 'ready', failure: null, ready: true, progressKey: 'ready' };
    }

    const progress = PROGRESS_MARKERS.find((marker) => marker.match.test(text));
    if (progress) {
        return { level: 'progress', failure: null, ready: false, progressKey: progress.key };
    }

    const notice = NOTICE_PATTERNS.find((pattern) => pattern.match.test(text));
    if (notice) {
        return { level: notice.level, failure: null, ready: false, progressKey: null };
    }

    return { level: 'normal', failure: null, ready: false, progressKey: null };
};
