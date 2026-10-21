import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBan, faTrash } from '@fortawesome/free-solid-svg-icons';
import { OrganizerGroup, ServerPref } from './types';
import { ICONS, ICON_KEYS, PRESET_COLORS, resolveIcon } from './icons';
import { C, btn, inputStyle } from './ui';
import { useT } from './i18n';

/* ------------------------------------------------------------------ shell */

export const Modal = ({
    title,
    onClose,
    children,
    footer,
    maxWidth = 720,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Szeles tartalomhoz (pl. konzol) nagyobb ertek adhato meg. */
    maxWidth?: number;
}) => (
    <div
        onClick={onClose}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
        }}
    >
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                width: '100%',
                maxWidth,
                maxHeight: '92vh',
                overflowY: 'auto',
                background: C.panel,
                border: `1px solid ${C.border}`,
                borderRadius: '0.9rem',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                color: C.text,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.1rem 1.5rem',
                    borderBottom: `1px solid ${C.border}`,
                }}
            >
                <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{title}</span>
                <button
                    type={'button'}
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: C.faint, cursor: 'pointer', fontSize: '1.5rem' }}
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>{children}</div>

            {footer && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.75rem',
                        padding: '1.1rem 1.5rem',
                        borderTop: `1px solid ${C.border}`,
                    }}
                >
                    {footer}
                </div>
            )}
        </div>
    </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
    <div
        style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: C.faint,
            marginBottom: '0.5rem',
            marginTop: '1.25rem',
        }}
    >
        {children}
    </div>
);

/* ----------------------------------------------------------------- pickers */

export const ColorPicker = ({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) => {
    const t = useT();

    return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        <button
            type={'button'}
            onClick={() => onChange(null)}
            title={t('noColour')}
            style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `1px solid ${value === null ? C.accent : C.border}`,
                background: 'transparent',
                color: C.faint,
                cursor: 'pointer',
                fontSize: '0.6rem',
            }}
        >
            <FontAwesomeIcon icon={faBan} />
        </button>

        {PRESET_COLORS.map((color) => (
            <button
                key={color}
                type={'button'}
                onClick={() => onChange(color)}
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: color,
                    border: value === color ? `2px solid ${C.text}` : '1px solid transparent',
                    cursor: 'pointer',
                }}
            />
        ))}

        <input
            type={'color'}
            value={value || '#38bdf8'}
            onChange={(e) => onChange(e.target.value)}
            title={t('customColour')}
            style={{
                width: 40,
                height: 34,
                padding: 0,
                border: `1px solid ${C.border}`,
                borderRadius: '0.2rem',
                background: 'transparent',
                cursor: 'pointer',
            }}
        />
    </div>
    );
};

export const IconPicker = ({
    value,
    color,
    onChange,
}: {
    value: string | null;
    color: string | null;
    onChange: (v: string | null) => void;
}) => {
    const t = useT();
    const [query, setQuery] = useState('');

    const keys = query.trim()
        ? ICON_KEYS.filter((k) => k.toLowerCase().includes(query.trim().toLowerCase()))
        : ICON_KEYS;

    return (
        <div>
            <input
                type={'text'}
                value={query}
                placeholder={t('iconSearch')}
                onChange={(e) => setQuery(e.target.value)}
                style={{ ...inputStyle, marginBottom: '0.5rem' }}
            />
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
                    gap: '0.25rem',
                    maxHeight: 220,
                    overflowY: 'auto',
                    padding: '0.25rem',
                    background: C.deep,
                    borderRadius: '0.25rem',
                    border: `1px solid ${C.border}`,
                }}
            >
                <button
                    type={'button'}
                    onClick={() => onChange(null)}
                    title={t('noIcon')}
                    style={{
                        height: 40,
                        borderRadius: '0.2rem',
                        border: value === null ? `1px solid ${C.accent}` : '1px solid transparent',
                        background: 'transparent',
                        color: C.faint,
                        cursor: 'pointer',
                    }}
                >
                    <FontAwesomeIcon icon={faBan} />
                </button>

                {keys.map((key) => (
                    <button
                        key={key}
                        type={'button'}
                        title={key}
                        onClick={() => onChange(key)}
                        style={{
                            height: 40,
                            borderRadius: '0.2rem',
                            border: value === key ? `1px solid ${C.accent}` : '1px solid transparent',
                            background: value === key ? 'rgba(56,189,248,0.12)' : 'transparent',
                            color: value === key ? color || C.accent : C.muted,
                            cursor: 'pointer',
                        }}
                    >
                        <FontAwesomeIcon icon={ICONS[key]} />
                    </button>
                ))}

                {keys.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '0.5rem', fontSize: '0.75rem', color: C.faint }}>
                        {t('noResults')}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ------------------------------------------------------- server beallitasok */

export const ServerSettingsModal = ({
    serverName,
    pref,
    groups,
    onSave,
    onClose,
}: {
    // Nem lehet 'name' a neve: a Blueprint telepitoje a kapcsos zarojeles 'name' tokent lecserelne.
    serverName: string;
    pref: ServerPref;
    groups: OrganizerGroup[];
    onSave: (pref: ServerPref) => void;
    onClose: () => void;
}) => {
    const t = useT();
    const [draft, setDraft] = useState<ServerPref>({ ...pref });
    const [urlError, setUrlError] = useState<string | null>(null);

    const commit = () => {
        const url = (draft.imageUrl || '').trim();

        if (url && !/^https?:\/\//i.test(url)) {
            setUrlError(t('imageUrlInvalid'));
            return;
        }

        onSave({ ...draft, imageUrl: url || null });
    };

    const previewIcon = resolveIcon(draft.icon);

    return (
        <Modal
            title={serverName}
            onClose={onClose}
            footer={
                <>
                    <button type={'button'} style={btn()} onClick={onClose}>
                        {t('cancel')}
                    </button>
                    <button type={'button'} style={btn(true)} onClick={commit}>
                        {t('save')}
                    </button>
                </>
            }
        >
            <Label>{t('group')}</Label>
            <select
                value={draft.group || ''}
                onChange={(e) => setDraft({ ...draft, group: e.target.value || null })}
                style={inputStyle}
            >
                <option value={''}>{t('ungrouped')}</option>
                {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                        {g.name}
                    </option>
                ))}
            </select>

            <Label>{t('colour')}</Label>
            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />

            <Label>{t('icon')}</Label>
            <IconPicker
                value={draft.icon}
                color={draft.color}
                onChange={(icon) => setDraft({ ...draft, icon })}
            />

            <Label>{t('orCustomImage')}</Label>
            <input
                type={'text'}
                value={draft.imageUrl || ''}
                placeholder={'https://pelda.hu/ikon.png'}
                onChange={(e) => {
                    setUrlError(null);
                    setDraft({ ...draft, imageUrl: e.target.value });
                }}
                style={inputStyle}
            />
            {urlError && (
                <div style={{ color: C.danger, fontSize: '0.7rem', marginTop: '0.3rem' }}>{urlError}</div>
            )}

            <Label>{t('preview')}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 4, height: 26, borderRadius: 2, background: draft.color || 'transparent' }} />
                <span
                    style={{
                        width: 26,
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: draft.color || C.muted,
                    }}
                >
                    {draft.imageUrl && /^https?:\/\//i.test(draft.imageUrl) ? (
                        <img
                            src={draft.imageUrl}
                            alt={''}
                            style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: '0.2rem' }}
                        />
                    ) : previewIcon ? (
                        <FontAwesomeIcon icon={previewIcon} />
                    ) : (
                        <span style={{ color: C.faint, fontSize: '0.7rem' }}>-</span>
                    )}
                </span>
                <span style={{ fontSize: '0.85rem' }}>{serverName}</span>
            </div>
        </Modal>
    );
};

/* -------------------------------------------------------- csoport szerkeszto */

export const GroupEditModal = ({
    group,
    onSave,
    onDelete,
    onClose,
}: {
    group: OrganizerGroup;
    onSave: (group: OrganizerGroup) => void;
    onDelete: () => void;
    onClose: () => void;
}) => {
    const t = useT();
    const [draft, setDraft] = useState<OrganizerGroup>({ ...group });

    return (
        <Modal
            title={t('editGroup')}
            onClose={onClose}
            footer={
                <>
                    <button
                        type={'button'}
                        style={{ ...btn(), borderColor: C.danger, color: C.danger, marginRight: 'auto' }}
                        onClick={onDelete}
                    >
                        <FontAwesomeIcon icon={faTrash} /> {t('delete')}
                    </button>
                    <button type={'button'} style={btn()} onClick={onClose}>
                        {t('cancel')}
                    </button>
                    <button
                        type={'button'}
                        style={btn(true)}
                        onClick={() => onSave({ ...draft, name: draft.name.trim() || t('untitledGroup') })}
                    >
                        {t('save')}
                    </button>
                </>
            }
        >
            <Label>{t('name')}</Label>
            <input
                type={'text'}
                value={draft.name}
                maxLength={64}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                style={inputStyle}
            />

            <Label>{t('colour')}</Label>
            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color: color || '#38bdf8' })} />

            <Label>{t('icon')}</Label>
            <IconPicker value={draft.icon} color={draft.color} onChange={(icon) => setDraft({ ...draft, icon })} />
        </Modal>
    );
};
