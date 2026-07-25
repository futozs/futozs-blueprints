import { stripAnsi } from './ansi';

/**
 * Konzol-mintak.
 *
 * KET KATEGORIA VAN, es a kulonbseg szandekos:
 *
 *  - FAILURE: megallitja a lancot. Csak olyan sorok kerulhetnek ide, amelyek
 *    egyertelmuen vegzetesek ES amelyekre van ertelmes valaszunk. Egy tul tag
 *    minta itt sokkal rosszabb, mint egy hianyzo: hamisan leallitja az egesz
 *    folyamatot egy artalmatlan sor miatt.
 *
 *  - NOTICE: csak kiemeli a sort a konzolon. Semmit nem allit meg.
 *
 * Ha egy alkalmazas tenyleg osszeomlik, azt NEM a mintaillesztes fogja meg,
 * hanem a stabilitasi ablak: a szerver kiesik 'running' allapotbol, es a lepes
 * elbukik. A mintak csak arra valok, hogy MEGMONDJAK MIERT - nem arra hogy
 * eldontsek, tortent-e baj.
 */

export type FailureKind = 'package' | 'pull' | 'port' | 'crash';

export interface FailurePattern {
    kind: FailureKind;
    match: RegExp;
}

export const FAILURE_PATTERNS: FailurePattern[] = [
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

/**
 * Kiemeljuk, de NEM allitjuk meg tole a lancot.
 *
 * A 'Cannot find module' szandekosan itt van: sok felallasban teljesen normalis
 * uzemi zaj (pl. opcionalis modul betoltesi kiserlete), es korabban emiatt allt
 * meg feleslegesen az egesz folyamat.
 */
export interface NoticePattern {
    match: RegExp;
    /** 'error' = piros kiemeles, 'notice' = borostyan */
    level: 'error' | 'notice';
}

export const NOTICE_PATTERNS: NoticePattern[] = [
    { match: /Cannot find module/i, level: 'notice' },
    { match: /UnhandledPromiseRejection/i, level: 'notice' },
    { match: /node:internal\//i, level: 'notice' },
    { match: /^\s*SyntaxError:/i, level: 'error' },
    { match: /^\s*TypeError:/i, level: 'error' },
    { match: /^\s*ReferenceError:/i, level: 'error' },
    { match: /npm ERR!/i, level: 'error' },
    { match: /npm WARN/i, level: 'notice' },
    { match: /\bwarn(ing)?\b/i, level: 'notice' },
    { match: /^\s*at\s+\S+\s+\(/i, level: 'notice' }, // stack trace sorok
];

export const READY_PATTERNS: RegExp[] = [
    /ready\s+-\s+started server on/i,
    /Ready in \d+/i,
    /started server on .*, url:/i,
    /Listening on port/i,
    /server started/i,
];

export type LineLevel = 'normal' | 'notice' | 'error' | 'ready';

/**
 * Egy nyers konzolsor besorolasa. Mindig a csupasz szovegen dolgozunk, hogy a
 * szinkodok ne torjek szet a keresett kifejezeseket.
 */
export const classifyLine = (
    raw: string
): { level: LineLevel; failure: FailurePattern | null; ready: boolean } => {
    const text = stripAnsi(raw);

    const failure = FAILURE_PATTERNS.find((pattern) => pattern.match.test(text)) || null;
    if (failure) {
        return { level: 'error', failure, ready: false };
    }

    if (READY_PATTERNS.some((pattern) => pattern.test(text))) {
        return { level: 'ready', failure: null, ready: true };
    }

    const notice = NOTICE_PATTERNS.find((pattern) => pattern.match.test(text));
    if (notice) {
        return { level: notice.level, failure: null, ready: false };
    }

    return { level: 'normal', failure: null, ready: false };
};
