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
};

export const btn = (active = false): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.35rem 0.7rem',
    fontSize: '0.75rem',
    lineHeight: 1.2,
    borderRadius: '0.25rem',
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(56, 189, 248, 0.15)' : C.panel,
    color: active ? C.accent : C.muted,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
});

export const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.45rem 0.6rem',
    fontSize: '0.85rem',
    borderRadius: '0.25rem',
    border: `1px solid ${C.border}`,
    background: C.deep,
    color: C.text,
    outline: 'none',
};
