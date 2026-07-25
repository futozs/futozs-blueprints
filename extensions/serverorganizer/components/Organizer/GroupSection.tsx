import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faGripVertical, faPen, faSync } from '@fortawesome/free-solid-svg-icons';
import { Server } from '@/api/server/getServer';
import { OrganizerGroup, ServerPref } from './types';
import { resolveIcon } from './icons';
import { C } from './ui';
import { useT } from './i18n';
import ServerCard from './ServerCard';

interface Props {
    group: OrganizerGroup | null;
    servers: Server[];
    prefFor: (uuid: string) => ServerPref;
    editMode: boolean;
    showHeader: boolean;

    draggingServer: string | null;
    dropTarget: { uuid: string; position: 'before' | 'after' } | null;
    draggingGroup: string | null;

    onToggleCollapse: () => void;
    onEditGroup: () => void;
    /** Van-e a csoportban elsodleges vagy backup szerep kiosztva. */
    canRestartChain: boolean;
    onRestartChain: () => void;
    onEditServer: (uuid: string) => void;

    onServerDragStart: (uuid: string) => void;
    onServerDragEnd: () => void;
    onServerDragOver: (uuid: string, position: 'before' | 'after') => void;
    onServerDrop: () => void;
    onDropIntoGroup: () => void;

    onGroupDragStart: () => void;
    onGroupDragEnd: () => void;
    onGroupDragOver: () => void;
    onGroupDrop: () => void;
}

export default ({
    group,
    servers,
    prefFor,
    editMode,
    showHeader,
    draggingServer,
    dropTarget,
    draggingGroup,
    onToggleCollapse,
    onEditGroup,
    canRestartChain,
    onRestartChain,
    onEditServer,
    onServerDragStart,
    onServerDragEnd,
    onServerDragOver,
    onServerDrop,
    onDropIntoGroup,
    onGroupDragStart,
    onGroupDragEnd,
    onGroupDragOver,
    onGroupDrop,
}: Props) => {
    const t = useT();
    const collapsed = group ? group.collapsed : false;
    const color = group ? group.color : C.faint;
    const icon = resolveIcon(group?.icon);

    const isGroupDragging = !!group && draggingGroup === group.id;

    return (
        <div
            style={{ marginBottom: '1.25rem', opacity: isGroupDragging ? 0.4 : 1 }}
            onDragOver={(e) => {
                // Ures csoportra / a csoport ures teruletere ejtes: ide kerul a szerver.
                if (!editMode || !draggingServer) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
                if (!editMode || !draggingServer) return;
                e.preventDefault();
                onDropIntoGroup();
            }}
        >
            {showHeader && (
                <div
                    draggable={editMode && !!group}
                    onDragStart={(e) => {
                        if (!group) return;
                        e.dataTransfer.setData('text/plain', 'group:' + group.id);
                        e.dataTransfer.effectAllowed = 'move';
                        onGroupDragStart();
                    }}
                    onDragEnd={onGroupDragEnd}
                    onDragOver={(e) => {
                        if (!editMode) return;
                        if (draggingGroup) {
                            e.preventDefault();
                            onGroupDragOver();
                        }
                    }}
                    onDrop={(e) => {
                        if (!editMode) return;
                        if (draggingGroup) {
                            e.preventDefault();
                            e.stopPropagation();
                            onGroupDrop();
                        }
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.6rem',
                        borderRadius: '0.25rem',
                        background: C.panel,
                        borderLeft: `3px solid ${color}`,
                    }}
                >
                    {editMode && group && (
                        <span className={'so-draggable'} style={{ color: C.faint, fontSize: '0.8rem' }}>
                            <FontAwesomeIcon icon={faGripVertical} />
                        </span>
                    )}

                    <button
                        type={'button'}
                        onClick={onToggleCollapse}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            flex: 1,
                            minWidth: 0,
                            background: 'transparent',
                            border: 'none',
                            color: C.text,
                            cursor: 'pointer',
                            textAlign: 'left',
                            padding: 0,
                        }}
                    >
                        <FontAwesomeIcon
                            icon={collapsed ? faChevronRight : faChevronDown}
                            style={{ color: C.faint, fontSize: '0.7rem', width: 10 }}
                        />
                        {icon && <FontAwesomeIcon icon={icon} style={{ color }} />}
                        <span
                            style={{
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {group ? group.name : t('ungrouped')}
                        </span>
                        <span style={{ color: C.faint, fontSize: '0.7rem' }}>{servers.length}</span>
                    </button>

                    {group && canRestartChain && (
                        <button
                            type={'button'}
                            onClick={onRestartChain}
                            title={t('restartGroup')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: C.accent,
                                cursor: 'pointer',
                                padding: '0 0.2rem',
                                fontSize: '0.8rem',
                            }}
                        >
                            <FontAwesomeIcon icon={faSync} />
                        </button>
                    )}

                    {editMode && group && (
                        <button
                            type={'button'}
                            onClick={onEditGroup}
                            title={t('editGroup')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: C.faint,
                                cursor: 'pointer',
                                padding: '0 0.2rem',
                            }}
                        >
                            <FontAwesomeIcon icon={faPen} />
                        </button>
                    )}
                </div>
            )}

            {!collapsed && (
                <div>
                    {servers.map((server) => (
                        <ServerCard
                            key={server.uuid}
                            server={server}
                            pref={prefFor(server.uuid)}
                            editMode={editMode}
                            isDragging={draggingServer === server.uuid}
                            dropPosition={dropTarget?.uuid === server.uuid ? dropTarget.position : null}
                            onDragStart={() => onServerDragStart(server.uuid)}
                            onDragEnd={onServerDragEnd}
                            onDragOver={(position) => onServerDragOver(server.uuid, position)}
                            onDrop={onServerDrop}
                            onEdit={() => onEditServer(server.uuid)}
                        />
                    ))}

                    {servers.length === 0 && (
                        <div
                            style={{
                                padding: '0.75rem',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                color: C.faint,
                                border: `1px dashed ${C.border}`,
                                borderRadius: '0.25rem',
                            }}
                        >
                            {editMode ? t('dropServersHere') : t('emptyGroup')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
