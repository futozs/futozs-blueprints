import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faGripVertical, faPen } from '@fortawesome/free-solid-svg-icons';
import { OrganizerGroup, ServerPref } from './types';
import { resolveIcon } from './icons';
import { C } from './ui';
import { useT } from './i18n';
import ServerCard from './ServerCard';
import PairCard from './PairCard';
import { LiveState, Unit, isChainable } from './pairs';

interface Props {
    group: OrganizerGroup | null;
    units: Unit[];
    states: Record<string, LiveState>;
    prefFor: (uuid: string) => ServerPref;
    editMode: boolean;
    showHeader: boolean;

    draggingServer: string | null;
    dropTarget: { uuid: string; position: 'before' | 'after' } | null;
    draggingGroup: string | null;

    onToggleCollapse: () => void;
    onEditGroup: () => void;
    onRestartUnit: (unit: Unit) => void;
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
    units,
    states,
    prefFor,
    editMode,
    showHeader,
    draggingServer,
    dropTarget,
    draggingGroup,
    onToggleCollapse,
    onEditGroup,
    onRestartUnit,
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
            style={{ marginBottom: '1.75rem', opacity: isGroupDragging ? 0.4 : 1 }}
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
                        gap: '0.75rem',
                        padding: '0.7rem 1rem',
                        marginBottom: '0.9rem',
                        borderRadius: '0.6rem',
                        background: C.panel,
                        borderLeft: `5px solid ${color}`,
                    }}
                >
                    {editMode && group && (
                        <span className={'so-draggable'} style={{ color: C.faint, fontSize: '1.1rem' }}>
                            <FontAwesomeIcon icon={faGripVertical} />
                        </span>
                    )}

                    <button
                        type={'button'}
                        onClick={onToggleCollapse}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.7rem',
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
                            style={{ color: C.faint, fontSize: '0.95rem', width: 14 }}
                        />
                        {icon && <FontAwesomeIcon icon={icon} style={{ color, fontSize: '1.2rem' }} />}
                        <span
                            style={{
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {group ? group.name : t('ungrouped')}
                        </span>
                        <span style={{ color: C.faint, fontSize: '0.95rem', fontWeight: 700 }}>{units.length}</span>
                    </button>

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
                                padding: '0 0.4rem',
                                fontSize: '1.1rem',
                            }}
                        >
                            <FontAwesomeIcon icon={faPen} />
                        </button>
                    )}
                </div>
            )}

            {!collapsed && (
                <div>
                    {units.map((unit) => {
                        const anchor = unit.anchor.uuid;
                        const common = {
                            pref: prefFor(anchor),
                            editMode,
                            isDragging: draggingServer === anchor,
                            dropPosition: dropTarget?.uuid === anchor ? dropTarget.position : null,
                            onDragStart: () => onServerDragStart(anchor),
                            onDragEnd: onServerDragEnd,
                            onDragOver: (position: 'before' | 'after') => onServerDragOver(anchor, position),
                            onDrop: onServerDrop,
                            onEdit: () => onEditServer(anchor),
                        };

                        return isChainable(unit) ? (
                            <PairCard key={anchor} unit={unit} states={states} onRestart={() => onRestartUnit(unit)} {...common} />
                        ) : (
                            <ServerCard key={anchor} server={unit.anchor} {...common} />
                        );
                    })}

                    {units.length === 0 && (
                        <div
                            style={{
                                padding: '1.25rem',
                                textAlign: 'center',
                                fontSize: '1rem',
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
