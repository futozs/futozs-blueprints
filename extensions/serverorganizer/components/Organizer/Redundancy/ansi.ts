import type { CSSProperties } from 'react';

/**
 * Minimalis ANSI (SGR) ertelmezo.
 *
 * A Wings nyers konzolkimenetet kuld, escape kodokkal egyutt - a panel sajat
 * konzolja ezert xterm.js-t hasznal. Nekunk nem kell teljes terminal, csak az
 * hogy a szinek helyesen jelenjenek meg, es hogy a vezerlokarakterek ne
 * latszodjanak szemetkent.
 */

export interface AnsiSegment {
    text: string;
    style: CSSProperties;
}

const FOREGROUND: Record<number, string> = {
    30: '#6b7280',
    31: '#f87171',
    32: '#4ade80',
    33: '#fbbf24',
    34: '#60a5fa',
    35: '#c084fc',
    36: '#22d3ee',
    37: '#e5e7eb',
    90: '#9ca3af',
    91: '#fca5a5',
    92: '#86efac',
    93: '#fde68a',
    94: '#93c5fd',
    95: '#d8b4fe',
    96: '#67e8f9',
    97: '#f9fafb',
};

const BACKGROUND: Record<number, string> = {
    40: '#111827',
    41: '#7f1d1d',
    42: '#14532d',
    43: '#78350f',
    44: '#1e3a8a',
    45: '#581c87',
    46: '#164e63',
    47: '#374151',
};

/** 256 szinu paletta kozelitese - a 16-231 szinkocka es a 232-255 szurkeskala. */
const xterm256 = (index: number): string => {
    if (index < 16) {
        return FOREGROUND[index < 8 ? 30 + index : 90 + (index - 8)] || '#e5e7eb';
    }

    if (index >= 232) {
        const level = 8 + (index - 232) * 10;
        return 'rgb(' + level + ', ' + level + ', ' + level + ')';
    }

    const base = index - 16;
    const steps = [0, 95, 135, 175, 215, 255];

    return (
        'rgb(' +
        steps[Math.floor(base / 36) % 6] +
        ', ' +
        steps[Math.floor(base / 6) % 6] +
        ', ' +
        steps[base % 6] +
        ')'
    );
};

const applyCodes = (codes: number[], style: CSSProperties): CSSProperties => {
    let next: CSSProperties = { ...style };

    for (let i = 0; i < codes.length; i++) {
        const code = codes[i];

        if (code === 0) {
            next = {};
        } else if (code === 1) {
            next.fontWeight = 600;
        } else if (code === 2) {
            next.opacity = 0.7;
        } else if (code === 3) {
            next.fontStyle = 'italic';
        } else if (code === 4) {
            next.textDecoration = 'underline';
        } else if (code === 22) {
            next.fontWeight = undefined;
            next.opacity = undefined;
        } else if (code === 39) {
            next.color = undefined;
        } else if (code === 49) {
            next.background = undefined;
        } else if (FOREGROUND[code]) {
            next.color = FOREGROUND[code];
        } else if (BACKGROUND[code]) {
            next.background = BACKGROUND[code];
        } else if (code === 38 || code === 48) {
            // Kiterjesztett szin: 5;N (256 szin) vagy 2;R;G;B (24 bites).
            if (codes[i + 1] === 5) {
                const resolved = xterm256(codes[i + 2]);
                if (code === 38) next.color = resolved;
                else next.background = resolved;
                i += 2;
            } else if (codes[i + 1] === 2) {
                const resolved =
                    'rgb(' + (codes[i + 2] || 0) + ', ' + (codes[i + 3] || 0) + ', ' + (codes[i + 4] || 0) + ')';
                if (code === 38) next.color = resolved;
                else next.background = resolved;
                i += 4;
            }
        }
    }

    return next;
};

// Szin- es stilusvezerlo sorozat: ESC [ ... m
const SGR = /\u001b\[([0-9;]*)m/g;

// Minden egyeb escape sorozat (kurzormozgatas, torles, OSC cimsor) es a
// megmaradt vezerlokarakterek. Ezeket eldobjuk.
const OTHER_ESCAPES = /\u001b\[[0-9;?]*[A-Za-ln-z]|\u001b\][^\u0007]*\u0007?|[\u0000-\u0008\u000b-\u001f\u007f]/g;

export const parseAnsi = (input: string): AnsiSegment[] => {
    const line = input.replace(/\r/g, '');
    const segments: AnsiSegment[] = [];

    let style: CSSProperties = {};
    let cursor = 0;
    let match: RegExpExecArray | null;

    SGR.lastIndex = 0;

    while ((match = SGR.exec(line)) !== null) {
        if (match.index > cursor) {
            const text = line.slice(cursor, match.index).replace(OTHER_ESCAPES, '');
            if (text) segments.push({ text, style });
        }

        const codes = match[1] === '' ? [0] : match[1].split(';').map((value) => parseInt(value, 10) || 0);
        style = applyCodes(codes, style);
        cursor = match.index + match[0].length;
    }

    if (cursor < line.length) {
        const text = line.slice(cursor).replace(OTHER_ESCAPES, '');
        if (text) segments.push({ text, style });
    }

    return segments;
};

/**
 * Csupasz szoveg. A mintaillesztes ezen fut, kulonben egy szinezett sorban az
 * escape kodok kozeekelodhetnenek a keresett szoveg darabjai koze.
 */
export const stripAnsi = (input: string): string =>
    input.replace(SGR, '').replace(OTHER_ESCAPES, '').replace(/\r/g, '');
