import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faPen, faRedo } from '@fortawesome/free-solid-svg-icons';
import { Server, ServerLink, bytesToString, ip, mbToBytes } from './platform';
import { ServerPref } from './types';
import { resolveIcon } from './icons';
import { C, MONO, bigBtn } from './ui';
import { useT } from './i18n';
import { LiveInfo, Unit, repoLabel } from './pairs';

interface Props {
    unit: Unit;
    pref: ServerPref;
    states: Record<string, LiveInfo>;
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

export const stateColour = (state: string | undefined): string =>
    state === 'running' ? C.ok : state === 'starting' || state === 'stopping' ? C.warn : state === 'offline' ? C.danger : C.faint;

const address = (server: Server): string => {
    const alloc = (server.allocations || []).find((entry) => entry.isDefault);
    return alloc ? `${alloc.alias || ip(alloc.ip)}:${alloc.port}` : '';
};

const Metric = ({ value, limit, className }: { value: string; limit: string | null; className?: string }) => (
    <span className={className} style={{ whiteSpace: 'nowrap', fontFamily: MONO, fontSize: '0.82rem', color: C.text }}>
        {value}
        {limit && <span style={{ color: C.faint }}> / {limit}</span>}
    </span>
);

/** Egy szerver egyetlen sorban: szerep, nev + cim, CPU, RAM, disk. */
const ServerLine = ({ server, role, info }: { server: Server; role: 'primary' | 'backup'; info: LiveInfo | undefined }) => {
    const live = info && info.state !== 'offline' && info.state !== 'unknown';
    const limits = server.limits;

    return (
        <ServerLink server={server} className={'so-pair-row'}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', color: role === 'primary' ? C.primary : C.backup }}>
                {role === 'primary' ? 'PRIMARY' : 'BACKUP'}
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColour(info?.state), flexShrink: 0 }} />
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
                    {server.name}
                </span>
                <span className={'so-hide-sm'} style={{ fontFamily: MONO, fontSize: '0.78rem', color: C.faint, whiteSpace: 'nowrap' }}>
                    {address(server)}
                </span>
            </span>

            <Metric value={live ? `${info!.cpu.toFixed(1)}%` : '–'} limit={limits.cpu ? `${limits.cpu}%` : null} />
            <Metric
                value={live ? bytesToString(info!.memory) : '–'}
                limit={limits.memory ? bytesToString(mbToBytes(limits.memory)) : null}
            />
            <Metric
                className={'so-hide-sm'}
                value={info && info.state !== 'unknown' ? bytesToString(info.disk) : '–'}
                limit={limits.disk ? bytesToString(mbToBytes(limits.disk)) : null}
            />
        </ServerLink>
    );
};

/**
 * Egy oldal = egy kartya: fejlec ujrainditas gombbal, alatta a primary es a
 * backup egy-egy sorban. A par a szerverek ROLE + GIT_ADDRESS valtozojabol all ossze.
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
    const title = repoLabel(unit.repo) || unit.anchor.name;

    const members = [unit.primary, unit.backup].filter((server): server is Server => !!server);
    const running = members.filter((server) => states[server.uuid]?.state === 'running').length;
    const known = members.every((server) => states[server.uuid] && states[server.uuid].state !== 'unknown');
    const healthColour = running === members.length ? C.ok : running === 0 ? C.danger : C.warn;

    const classes = ['so-pair'];
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
            style={{ borderLeft: `3px solid ${pref.color || C.border}` }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 0.9rem' }}>
                {editMode && (
                    <span className={'so-draggable'} title={t('dragToReorder')} style={{ color: C.faint }}>
                        <FontAwesomeIcon icon={faGripVertical} />
                    </span>
                )}

                {(showImage || icon) && (
                    <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pref.color || C.muted, flexShrink: 0 }}>
                        {showImage ? (
                            <img
                                src={pref.imageUrl as string}
                                alt={''}
                                onError={() => setImageFailed(true)}
                                style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: '0.25rem' }}
                            />
                        ) : (
                            icon && <FontAwesomeIcon icon={icon} />
                        )}
                    </span>
                )}

                <span style={{ fontSize: '1rem', fontWeight: 600, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                </span>

                {known && (
                    <span style={{ fontSize: '0.8rem', color: healthColour, whiteSpace: 'nowrap' }}>
                        {`${running}/${members.length} ${t('runningShort')}`}
                    </span>
                )}

                <span style={{ flex: 1 }} />

                {editMode ? (
                    <button type={'button'} onClick={onEdit} style={bigBtn('plain')}>
                        <FontAwesomeIcon icon={faPen} /> {t('edit')}
                    </button>
                ) : (
                    <button type={'button'} onClick={onRestart} style={bigBtn('go')}>
                        <FontAwesomeIcon icon={faRedo} /> {t('restart')}
                    </button>
                )}
            </div>

            {unit.primary && <ServerLine server={unit.primary} role={'primary'} info={states[unit.primary.uuid]} />}
            {unit.backup && <ServerLine server={unit.backup} role={'backup'} info={states[unit.backup.uuid]} />}
        </div>
    );
};
