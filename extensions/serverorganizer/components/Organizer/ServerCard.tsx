import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical, faPen } from '@fortawesome/free-solid-svg-icons';
import ServerRow from '@/components/dashboard/ServerRow';
import { Server } from '@/api/server/getServer';
import { ServerPref } from './types';
import { resolveIcon } from './icons';
import { C } from './ui';
import { useT } from './i18n';

interface Props {
    server: Server;
    pref: ServerPref;
    editMode: boolean;
    isDragging: boolean;
    dropPosition: 'before' | 'after' | null;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragOver: (position: 'before' | 'after') => void;
    onDrop: () => void;
    onEdit: () => void;
}

export default ({
    server,
    pref,
    editMode,
    isDragging,
    dropPosition,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onEdit,
}: Props) => {
    const t = useT();
    const [imageFailed, setImageFailed] = useState(false);

    const accent = pref.color || 'transparent';
    const icon = resolveIcon(pref.icon);
    const showImage = !!pref.imageUrl && !imageFailed;

    const classes = ['so-row-wrapper'];
    if (isDragging) classes.push('so-dragging');
    if (dropPosition === 'before') classes.push('so-drop-before');
    if (dropPosition === 'after') classes.push('so-drop-after');

    return (
        <div
            className={classes.join(' ')}
            draggable={editMode}
            onDragStart={(e) => {
                // A drag adat beallitasa nelkul Firefoxban el sem indul a huzas.
                e.dataTransfer.setData('text/plain', server.uuid);
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
                display: 'flex',
                alignItems: 'stretch',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                borderRadius: '0.25rem',
                transition: 'box-shadow 120ms ease',
            }}
        >
            {editMode && (
                <div
                    className={'so-draggable'}
                    title={t('dragToReorder')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: C.faint,
                        paddingLeft: 2,
                        fontSize: '0.9rem',
                    }}
                >
                    <FontAwesomeIcon icon={faGripVertical} />
                </div>
            )}

            {(pref.color || icon || showImage) && (
                <div
                    className={'so-accent'}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}
                >
                    <span
                        style={{
                            width: 4,
                            alignSelf: 'stretch',
                            borderRadius: 2,
                            background: accent,
                        }}
                    />
                    {(icon || showImage) && (
                        <span
                            style={{
                                position: 'relative',
                                width: 26,
                                height: 26,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: pref.color || C.muted,
                                fontSize: '1rem',
                                flexShrink: 0,
                            }}
                        >
                            {showImage ? (
                                <img
                                    src={pref.imageUrl as string}
                                    alt={''}
                                    onError={() => setImageFailed(true)}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        objectFit: 'cover',
                                        borderRadius: '0.2rem',
                                    }}
                                />
                            ) : icon ? (
                                <FontAwesomeIcon icon={icon} />
                            ) : null}
                        </span>
                    )}
                </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
                <ServerRow server={server} />
            </div>

            {editMode && (
                <button
                    type={'button'}
                    onClick={onEdit}
                    title={t('serverSettings')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 0.4rem',
                        background: 'transparent',
                        border: 'none',
                        color: C.faint,
                        cursor: 'pointer',
                    }}
                >
                    <FontAwesomeIcon icon={faPen} />
                </button>
            )}
        </div>
    );
};
