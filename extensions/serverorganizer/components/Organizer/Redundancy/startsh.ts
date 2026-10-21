import { stripAnsi } from './ansi';

/**
 * A .ptero/start.sh sorainak ertelmezese.
 *
 * Mindent a start.sh intez (git, build-zar, bun install, prisma, build,
 * inditas a Pterodactyl portjan). A kiegeszito NEM dont semmirol a sorok
 * alapjan - a sikert a Wings allapota adja (az egg "done" jele: "Ready in").
 * Ezek a mintak csak azt mutatjak meg nagyban, hol tart a szerver.
 */

export type Milestone = 'update' | 'build' | 'launch' | 'ready' | 'warm';

export const MILESTONES: Milestone[] = ['update', 'build', 'launch', 'ready', 'warm'];

export type LineLevel = 'normal' | 'start' | 'progress' | 'ready' | 'warning' | 'error';

interface Rule {
    match: RegExp;
    level: LineLevel;
    /** Elert merfoldko. */
    milestone?: Milestone;
    /** i18n kulcs: ezt irjuk ki nagyban, mint aktualis tevekenyseget. */
    activity?: string;
    buildSkipped?: boolean;
    commit?: boolean;
    error?: boolean;
}

/* A sorrend szamit: az elso illeszkedo szabaly nyer. */
const RULES: Rule[] = [
    { match: /HIBA:/, level: 'error', activity: 'actError', error: true },
    { match: /FIGYELEM:/, level: 'warning' },

    { match: /\bgit: [0-9a-f]{7}/, level: 'start', milestone: 'update', activity: 'actUpdate', commit: true },
    { match: /tartalék.*commitj/, level: 'start', milestone: 'update', activity: 'actFollow', commit: true },
    { match: /git pull nem sikerült/, level: 'warning', milestone: 'update' },
    { match: /bun .* telepítése a volume-ba/, level: 'start', activity: 'actBun' },

    { match: /build szükséges/, level: 'start', activity: 'actBuildNeeded' },
    { match: /build vár: a párja/, level: 'warning', activity: 'actWaitPeer' },
    { match: /build vár: egy másik build/, level: 'warning', activity: 'actWaitLock' },
    { match: /várakozás a buildhez/, level: 'warning', activity: 'actWaitMemory' },
    { match: /build-zár megszerezve/, level: 'start', activity: 'actInstall' },
    { match: /Generated Prisma Client/i, level: 'progress', activity: 'actPrisma' },
    { match: /DB: prisma/, level: 'start', activity: 'actMigrate' },
    { match: /első indítás:/, level: 'start', activity: 'actFirstRun' },
    { match: /Creating an optimized production build/i, level: 'progress', activity: 'actBuild' },
    { match: /Compiled successfully|✓ Compiled/i, level: 'progress', activity: 'actBuild' },
    { match: /Generating static pages/i, level: 'progress', activity: 'actPages' },
    { match: /build kész/, level: 'start', milestone: 'build', activity: 'actBuildDone' },
    { match: /nincs változás .*build kihagyva/, level: 'start', milestone: 'build', activity: 'actBuildSkipped', buildSkipped: true },

    { match: /indítás \((primary|backup), port/, level: 'start', milestone: 'launch', activity: 'actLaunch' },
    { match: /Ready in/, level: 'ready', milestone: 'ready', activity: 'actReady' },
    { match: /bemelegítve/, level: 'ready', milestone: 'warm', activity: 'actWarm' },

    { match: /\[start \d/, level: 'start' },
    { match: /\berror\b|Failed to compile|Type error:|EADDRINUSE/i, level: 'error' },
    { match: /\bwarn(ing)?\b/i, level: 'warning' },
];

export interface Verdict {
    level: LineLevel;
    rule: Rule | null;
    clean: string;
}

export const classify = (raw: string): Verdict => {
    const clean = stripAnsi(raw);
    const rule = RULES.find((entry) => entry.match.test(clean)) || null;

    return { level: rule ? rule.level : 'normal', rule, clean };
};

/** A "[start 12:34:56] " elotag nelkul - nagy kiirasnal az felesleges. */
export const messageOf = (clean: string): string => clean.replace(/^.*?\[start [0-9:]+\]\s*/, '').trim();
