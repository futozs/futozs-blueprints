import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faPen, faRedo } from '@fortawesome/free-solid-svg-icons';
import ServerRow from '@/components/dashboard/ServerRow';
import { Server } from '@/api/server/getServer';
import { ServerPref } from './types';
import { resolveIcon } from './icons';
import { C, bigBtn } from './ui';
import { useT } from './i18n';
import { LiveState, Unit, repoLabel } from './pairs';

interface Props {
    unit: Unit;
    pref: ServerPref;
    states: Record<string, LiveState>;
    editMode: boolean;
    isDragging: boolean;
    dropPosition: 'before' | 'after' | null;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: (position: 'before' | 'after') => void;
    onDrop: () => void;
    onEdit: () => void;
    onRestart: () => void;
}

const RoleColumn = ({ server, role }: { server: Server; role: 'primary' | 'backup' }) => (
    <div style={{ minWidth: 0 }}>
        <div
            style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: role === 'primary' ? C.primary : C.backup,
                margin: '0 0 0.35rem 0.15rem',
            }}
        >
            {role === 'primary' ? 'PRIMARY' : 'BACKUP'}
        </div>
        <div className={'so-row-wrapper'}>
            <ServerRow server={server} />
        </div>
    </div>
);

/**
 * Egy oldal = egy kartya: a primary es a backup egymas mellett, egy nagy
 * ujrainditas gombbal. A par a szerverek ROLE + GIT_ADDRESS valtozojabol all ossze.
 */
export default ({
    unit,
    pref,
    states,
    editMode,
    isDragging,
    dropPosition,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onEdit,
    onRestart,
}: Props) => {
    const t = useT();
    const [imageFailed, setImageFailed] = useState(false);

    const icon = resolveIcon(pref.icon);
    const showImage = !!pref.imageUrl && !imageFailed;
    const accent = pref.color || C.border;
    const title = repoLabel(unit.repo) || unit.anchor.name;

    const members = [unit.primary, unit.backup].filter((server): server is Server => !!server);
    const running = members.filter((server) => states[server.uuid] === 'running').length;
    const known = members.every((server) => !!states[server.uuid] && states[server.uuid] !== 'unknown');
    const health = !known ? null : running === members.length ? 'ok' : running === 0 ? 'down' : 'half';
    const healthColour = health === 'ok' ? C.ok : health === 'down' ? C.danger : C.warn;

    const classes = [];
    if (isDragging) classes.push('so-dragging');
    if (dropPosition === 'before') classes.push('so-drop-before');
    if (dropPosition === 'after') classes.push('so-drop-after');

    return (
        <div
            className={classes.join(' ')}
            draggable={editMode}
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', unit.anchor.uuid);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart();
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
                if (!editMode) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const box = e.currentTarget.getBoundingClientRect();
                onDragOver(e.clientY < box.top + box.height / 2 ? 'before' : 'after');
            }}
            onDrop={(e) => {
                if (!editMode) return;
                e.preventDefault();
                e.stopPropagation();
                onDrop();
            }}
            style={{
                marginBottom: '1rem',
                borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${C.border}`,
                borderLeft: `5px solid ${accent}`,
                padding: '1rem 1.1rem 1.1rem',
                transition: 'box-shadow 120ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                {editMode && (
                    <span className={'so-draggable'} title={t('dragToReorder')} style={{ color: C.faint, fontSize: '1.1rem' }}>
                        <FontAwesomeIcon icon={faGripVertical} />
                    </span>
                )}

                {(showImage || icon) && (
                    <span
                        style={{
                            width: 36,
                            height: 36,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: pref.color || C.muted,
                            fontSize: '1.4rem',
                            flexShrink: 0,
                        }}
                    >
                        {showImage ? (
                            <img
                                src={pref.imageUrl as string}
                                alt={''}
                                onError={() => setImageFailed(true)}
                                style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: '0.4rem' }}
                            />
                        ) : (
                            icon && <FontAwesomeIcon icon={icon} />
                        )}
                    </span>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span
                        style={{
                            fontSize: '1.35rem',
                            fontWeight: 800,
                            color: C.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {title}
                    </span>
                    {health && (
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: 999,
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: healthColour,
                                background: `${healthColour}1f`,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: healthColour }} />
                            {`${running}/${members.length} ${t('runningShort')}`}
                        </span>
                    )}
                </div>

                {editMode ? (
                    <button type={'button'} onClick={onEdit} style={{ ...bigBtn('plain'), minHeight: 48, fontSize: '1rem', padding: '0 1.1rem' }}>
                        <FontAwesomeIcon icon={faPen} /> {t('edit')}
                    </button>
                ) : (
                    <button
                        type={'button'}
                        onClick={onRestart}
                        style={{ ...bigBtn('go'), minHeight: 52, fontSize: '1.1rem', padding: '0 1.5rem' }}
                    >
                        <FontAwesomeIcon icon={faRedo} /> {t('restart')}
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '0.9rem' }}>
                {unit.primary && <RoleColumn server={unit.primary} role={'primary'} />}
                {unit.backup && <RoleColumn server={unit.backup} role={'backup'} />}
            </div>
        </div>
    );
};
