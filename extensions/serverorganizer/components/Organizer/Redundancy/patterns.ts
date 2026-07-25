/**
 * Konzol-mintak a hibak felismeresehez.
 *
 * FONTOS: ezek altalanos, tapasztalati mintak. A megbizhato felismereshez a sajat
 * szervered valodi hibakimenete kell - ha van ilyen, bovitsd a listat. Egy hianyzo
 * minta nem okoz kart (a lanc a stabilitasi ablakon akkor is elbukik, ha az app
 * elszall), egy TULZOTTAN altalanos minta viszont hamis riasztast ad, ezert
 * szandekosan konkret sorokra illesztunk, nem puszta "error" szora.
 */

export type FailureKind = 'package' | 'pull' | 'port' | 'crash';

export interface FailurePattern {
    kind: FailureKind;
    /** Kis-nagybetu fuggetlen reszlet, amit a konzolsorban keresunk. */
    match: RegExp;
}

export const FAILURE_PATTERNS: FailurePattern[] = [
    /* --- package.json / npm --- */
    { kind: 'package', match: /npm ERR!\s+code\s+EJSONPARSE/i },
    { kind: 'package', match: /npm ERR!\s+JSON\.parse/i },
    { kind: 'package', match: /npm ERR!\s+Missing script/i },
    { kind: 'package', match: /Couldn't find a package\.json/i },
    { kind: 'package', match: /ENOENT.*package\.json/i },
    { kind: 'package', match: /Unexpected (token|end of JSON input).*package\.json/i },

    /* --- git pull --- */
    { kind: 'pull', match: /Your local changes to the following files would be overwritten/i },
    { kind: 'pull', match: /Please commit your changes or stash them/i },
    { kind: 'pull', match: /The following untracked working tree files would be overwritten/i },
    { kind: 'pull', match: /Automatic merge failed/i },
    { kind: 'pull', match: /fatal: Not a git repository/i },
    { kind: 'pull', match: /fatal: could not read Username/i },
    { kind: 'pull', match: /error: Pulling is not possible because you have unmerged files/i },

    /* --- port utkozes --- */
    { kind: 'port', match: /EADDRINUSE/i },
    { kind: 'port', match: /address already in use/i },

    /* --- altalanos node / Next.js osszeomlas --- */
    { kind: 'crash', match: /FATAL ERROR:.*JavaScript heap out of memory/i },
    { kind: 'crash', match: /Cannot find module\s+'/i },
    { kind: 'crash', match: /^\s*SyntaxError:/i },
    { kind: 'crash', match: /UnhandledPromiseRejection/i },
    { kind: 'crash', match: /Error: Cannot find module/i },
    { kind: 'crash', match: /node:internal\/process\/promises/i },
];

/**
 * Jelek, hogy az alkalmazas ELINDULT. A lanc nem ezekre var (a felhasznalo a
 * "fut + stabil" feltetelt valasztotta), de ha latjuk, kiirjuk a felulten -
 * igy latszik hogy tenyleg az app jelzett vissza, nem csak a Pterodactyl.
 */
export const READY_PATTERNS: RegExp[] = [
    /ready\s+-\s+started server on/i,
    /✓\s*Ready in/i,
    /Ready in \d+/i,
    /started server on .*, url:/i,
    /Listening on port/i,
];

export const detectFailure = (line: string): FailurePattern | null =>
    FAILURE_PATTERNS.find((pattern) => pattern.match.test(line)) || null;

export const detectReady = (line: string): boolean => READY_PATTERNS.some((pattern) => pattern.test(line));
