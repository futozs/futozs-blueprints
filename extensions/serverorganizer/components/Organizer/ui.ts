import type { CSSProperties } from 'react';

/**
 * A Pterodactyl sajat tailwind palettajabol atvett szinek, hogy a szervezo
 * ne logjon ki a panel megjelenesebol.
 */
export const C = {
    row: 'hsl(209, 18%, 30%)', // neutral-700 - a sorok hattere
    panel: 'hsl(209, 20%, 25%)', // neutral-800
    deep: 'hsl(210, 24%, 16%)', // neutral-900
    border: 'hsl(209, 14%, 37%)', // neutral-600
    text: 'hsl(214, 15%, 91%)', // neutral-100
    muted: 'hsl(211, 13%, 65%)', // neutral-300
    faint: 'hsl(211, 10%, 53%)', // neutral-400
    accent: '#38bdf8',
    danger: '#ef4444',
    ok: '#34d399',
    warn: '#fbbf24',
    primary: '#fbbf24',
    backup: '#a5b4fc',
    console: '#0b1016',
};

export const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

export const btn = (active = false): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.55rem 0.95rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1.2,
    borderRadius: '0.375rem',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(56, 189, 248, 0.15)' : C.panel,
    color: active ? C.accent : C.muted,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
});

export type BigKind = 'go' | 'danger' | 'ok' | 'plain';

const BIG: Record<BigKind, { bg: string; fg: string; border: string }> = {
    go: { bg: '#0284c7', fg: '#fff', border: '#38bdf8' },
    danger: { bg: 'rgba(239,68,68,0.12)', fg: '#fca5a5', border: '#ef4444' },
    ok: { bg: '#059669', fg: '#fff', border: '#34d399' },
    plain: { bg: C.panel, fg: C.text, border: C.border },
};

/** Nagy, egyertelmu gomb - a lanc fo muveleteihez. */
export const bigBtn = (kind: BigKind, disabled = false): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.7rem',
    minHeight: 64,
    padding: '0 2rem',
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '0.01em',
    borderRadius: '0.6rem',
    border: `2px solid ${BIG[kind].border}`,
    background: BIG[kind].bg,
    color: BIG[kind].fg,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap',
});

export const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    fontSize: '0.95rem',
    borderRadius: '0.375rem',
    border: `1px solid ${C.border}`,
    background: C.deep,
    color: C.text,
    outline: 'none',
};

export const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) return '0 MB';
    const mb = bytes / 1024 / 1024;
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
};

export const formatDuration = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
