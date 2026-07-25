import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderPlus, faPen, faCheck, faSort, faEye } from '@fortawesome/free-solid-svg-icons';
import { useStoreState } from 'easy-peasy';
import getServers from '@/api/getServers';
import { Server } from '@/api/server/getServer';
import Spinner from '@/components/elements/Spinner';

import { getPrefs, savePrefs } from './api';
import { OrganizerGroup, OrganizerPrefs, ServerPref, SortMode, defaultServerPref } from './types';
import { PRESET_COLORS } from './icons';
import { C, btn } from './ui';
import { Lang, LANGUAGES, LangProvider, STRINGS, StringKey, detectLang } from './i18n';
import GroupSection from './GroupSection';
import { GroupEditModal, ServerSettingsModal } from './Modals';
import { ChainTarget, useRestartChain } from './Redundancy/chain';
import RestartPanel from './Redundancy/RestartPanel';
import { ChainConfig } from './Redundancy/types';

const newId = () => 'g' + Math.random().toString(36).slice(2, 10);

/**
 * A dashboard alapertelmezetten lapoz, nekunk viszont az osszes szerver kell
 * egyszerre, hogy csoportositani es rendezni tudjuk oket.
 */
const loadAllServers = async (admin: boolean): Promise<Server[]> => {
    const collected: Server[] = [];
    let page = 1;

    for (;;) {
        const result = await getServers({ page, type: admin ? 'admin' : undefined });
        collected.push(...result.items);

        if (
            result.items.length === 0 ||
            result.pagination.currentPage >= result.pagination.totalPages ||
            page >= 100 // biztonsagi hatar, hogy egy hibas valasz ne porgesse vegtelenul
        ) {
            break;
        }

        page += 1;
    }

    return collected;
};

const SORT_KEYS: Record<SortMode, StringKey> = {
    manual: 'sortManual',
    name: 'sortName',
    status: 'sortStatus',
    role: 'sortRole',
};

export default () => {
    const rootAdmin = useStoreState((state: any) => state.user.data!.rootAdmin);

    const [servers, setServers] = useState<Server[] | null>(null);
    const [prefs, setPrefs] = useState<OrganizerPrefs | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [showAdmin, setShowAdmin] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editingServer, setEditingServer] = useState<string | null>(null);
    const [editingGroup, setEditingGroup] = useState<string | null>(null);

    const [draggingServer, setDraggingServer] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ uuid: string; position: 'before' | 'after' } | null>(null);
    const [draggingGroup, setDraggingGroup] = useState<string | null>(null);
    const [chainGroupId, setChainGroupId] = useState<string | null>(null);

    const chain = useRestartChain();

    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A mentett nyelv nyer; ha nincs, a bongeszo dont. A gyerekkomponensek a
    // LangProvideren keresztul kapjak meg (useT).
    const lang: Lang = (prefs && prefs.language) || detectLang();
    const t = useCallback(
        (key: StringKey): string => STRINGS[lang][key] || STRINGS.en[key] || key,
        [lang]
    );

    /* ------------------------------------------------------------- betoltes */

    useEffect(() => {
        let cancelled = false;
        setServers(null);

        (async () => {
            try {
                const [loadedPrefs, loadedServers] = await Promise.all([getPrefs(), loadAllServers(showAdmin)]);
                if (cancelled) return;

                setPrefs(loadedPrefs);
                setServers(loadedServers);
                setLoadError(null);
            } catch (error) {
                if (cancelled) return;
                console.error('[ServerOrganizer] betoltesi hiba', error);
                setLoadError('LOAD_FAILED');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [showAdmin]);

    /*
     * Az alapertelmezett lista elrejtese. Rogton a csatolaskor elrejtjuk, hogy ne
     * villanjon fel ket lista, es visszaadjuk, ha hiba van vagy a szervezo ki van
     * kapcsolva.
     */
    const organizerActive = !loadError && (!prefs || prefs.enabled);

    useEffect(() => {
        if (organizerActive) {
            document.body.classList.add('so-active');
        } else {
            document.body.classList.remove('so-active');
        }

        return () => document.body.classList.remove('so-active');
    }, [organizerActive]);

    useEffect(
        () => () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        },
        []
    );

    /* --------------------------------------------------------------- mentes */

    const persist = useCallback((next: OrganizerPrefs) => {
        setPrefs(next);

        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            setSaving(true);
            savePrefs(next)
                .then(() => setSaveError(null))
                .catch((error) => {
                    console.error('[ServerOrganizer] mentesi hiba', error);
                    setSaveError('SAVE_FAILED');
                })
                .finally(() => setSaving(false));
        }, 700);
    }, []);

    /* ------------------------------------------------------------ szamitasok */

    const prefFor = useCallback(
        (uuid: string): ServerPref => (prefs && prefs.servers[uuid]) || defaultServerPref(0),
        [prefs]
    );

    const sections = useMemo(() => {
        if (!servers || !prefs) return [];

        const groups = [...prefs.groups].sort((a, b) => a.order - b.order);
        const validIds = new Set(groups.map((g) => g.id));

        const buckets = new Map<string | null, Server[]>();
        groups.forEach((g) => buckets.set(g.id, []));
        buckets.set(null, []);

        servers.forEach((server) => {
            const pref = prefs.servers[server.uuid];
            const groupId = pref && pref.group && validIds.has(pref.group) ? pref.group : null;
            (buckets.get(groupId) as Server[]).push(server);
        });

        const rank = (server: Server) => {
            if (server.status === 'suspended') return 2;
            if (server.status === null) return 0;
            return 1;
        };

        const roleRank = (uuid: string) => {
            const role = (prefs.servers[uuid] || {}).role;
            return role === 'primary' ? 0 : role === 'backup' ? 1 : 2;
        };

        const compare = (a: Server, b: Server): number => {
            switch (prefs.sortMode) {
                case 'name':
                    return a.name.localeCompare(b.name, 'hu', { sensitivity: 'base' });
                case 'status':
                    return rank(a) - rank(b) || a.name.localeCompare(b.name, 'hu');
                case 'role':
                    return roleRank(a.uuid) - roleRank(b.uuid) || a.name.localeCompare(b.name, 'hu');
                default: {
                    const ao = (prefs.servers[a.uuid] || defaultServerPref(0)).order;
                    const bo = (prefs.servers[b.uuid] || defaultServerPref(0)).order;
                    return ao - bo;
                }
            }
        };

        buckets.forEach((list) => list.sort(compare));

        const result: { group: OrganizerGroup | null; servers: Server[] }[] = groups.map((group) => ({
            group,
            servers: buckets.get(group.id) as Server[],
        }));

        result.push({ group: null, servers: buckets.get(null) as Server[] });

        return result;
    }, [servers, prefs]);

    /**
     * A lanc sorrendje kotott: eloszor a backup, es csak siker utan a primary.
     * Igy sosem fordulhat elo, hogy egyszerre mindketto all.
     */
    const chainTargets = useMemo((): ChainTarget[] => {
        if (!chainGroupId || !prefs) return [];

        const section = sections.find((entry) => entry.group && entry.group.id === chainGroupId);
        if (!section) return [];

        const roleOf = (uuid: string) => (prefs.servers[uuid] || {}).role;
        const backup = section.servers.find((server) => roleOf(server.uuid) === 'backup');
        const primary = section.servers.find((server) => roleOf(server.uuid) === 'primary');

        const targets: ChainTarget[] = [];
        if (backup) targets.push({ server: backup, role: 'backup' });
        if (primary) targets.push({ server: primary, role: 'primary' });

        return targets;
    }, [chainGroupId, sections, prefs]);

    const groupHasRoles = useCallback(
        (groupServers: Server[]): boolean =>
            !!prefs && groupServers.some((server) => !!(prefs.servers[server.uuid] || {}).role),
        [prefs]
    );

    const membersOf = useCallback(
        (groupId: string | null): string[] => {
            const section = sections.find((s) => (s.group ? s.group.id : null) === groupId);
            return section ? section.servers.map((s) => s.uuid) : [];
        },
        [sections]
    );

    /* --------------------------------------------------------- drag and drop */

    const applyMove = useCallback(
        (uuid: string, targetGroupId: string | null, anchorUuid: string | null, position: 'before' | 'after' | null) => {
            if (!prefs) return;

            const list = membersOf(targetGroupId).filter((u) => u !== uuid);

            let index = list.length;
            if (anchorUuid) {
                const anchorIndex = list.indexOf(anchorUuid);
                if (anchorIndex >= 0) {
                    index = position === 'before' ? anchorIndex : anchorIndex + 1;
                }
            }
            list.splice(index, 0, uuid);

            const nextServers: Record<string, ServerPref> = { ...prefs.servers };
            list.forEach((u, i) => {
                const existing = nextServers[u] || defaultServerPref(i);
                nextServers[u] = { ...existing, group: targetGroupId, order: i };
            });

            persist({
                ...prefs,
                // Kezi athelyezesnek csak sajat sorrend mellett van ertelme.
                sortMode: 'manual',
                servers: nextServers,
            });
        },
        [prefs, membersOf, persist]
    );

    const finishServerDrag = useCallback(() => {
        setDraggingServer(null);
        setDropTarget(null);
    }, []);

    const handleServerDrop = useCallback(() => {
        if (!draggingServer || !dropTarget) {
            finishServerDrag();
            return;
        }

        const targetSection = sections.find((s) => s.servers.some((srv) => srv.uuid === dropTarget.uuid));
        const targetGroupId = targetSection && targetSection.group ? targetSection.group.id : null;

        applyMove(draggingServer, targetGroupId, dropTarget.uuid, dropTarget.position);
        finishServerDrag();
    }, [draggingServer, dropTarget, sections, applyMove, finishServerDrag]);

    const handleDropIntoGroup = useCallback(
        (groupId: string | null) => {
            if (!draggingServer) return;

            // Ha kozben egy konkret sor fole ertunk, azt a pontosabb celt hasznaljuk.
            if (dropTarget) {
                handleServerDrop();
                return;
            }

            applyMove(draggingServer, groupId, null, null);
            finishServerDrag();
        },
        [draggingServer, dropTarget, handleServerDrop, applyMove, finishServerDrag]
    );

    const handleGroupDrop = useCallback(
        (targetGroupId: string) => {
            if (!prefs || !draggingGroup || draggingGroup === targetGroupId) {
                setDraggingGroup(null);
                return;
            }

            const ordered = [...prefs.groups].sort((a, b) => a.order - b.order).map((g) => g.id);
            const from = ordered.indexOf(draggingGroup);
            if (from >= 0) ordered.splice(from, 1);

            const to = ordered.indexOf(targetGroupId);
            ordered.splice(to < 0 ? ordered.length : to, 0, draggingGroup);

            persist({
                ...prefs,
                groups: prefs.groups.map((g) => ({ ...g, order: ordered.indexOf(g.id) })),
            });
            setDraggingGroup(null);
        },
        [prefs, draggingGroup, persist]
    );

    /* ------------------------------------------------------------- muveletek */

    const addGroup = () => {
        if (!prefs) return;

        const group: OrganizerGroup = {
            id: newId(),
            name: t('newGroupName'),
            color: PRESET_COLORS[prefs.groups.length % PRESET_COLORS.length],
            icon: null,
            collapsed: false,
            order: prefs.groups.length,
        };

        persist({ ...prefs, groups: [...prefs.groups, group] });
        setEditMode(true);
        setEditingGroup(group.id);
    };

    const toggleCollapse = (groupId: string) => {
        if (!prefs) return;
        persist({
            ...prefs,
            groups: prefs.groups.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)),
        });
    };

    const deleteGroup = (groupId: string) => {
        if (!prefs) return;

        const nextServers: Record<string, ServerPref> = {};
        Object.keys(prefs.servers).forEach((uuid) => {
            const pref = prefs.servers[uuid];
            nextServers[uuid] = pref.group === groupId ? { ...pref, group: null } : pref;
        });

        persist({
            ...prefs,
            groups: prefs.groups.filter((g) => g.id !== groupId).map((g, i) => ({ ...g, order: i })),
            servers: nextServers,
        });
        setEditingGroup(null);
    };

    /* ---------------------------------------------------------------- render */

    if (loadError) {
        return (
            <div data-so-root style={{ marginBottom: '1rem' }}>
                <div
                    style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.25rem',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#fca5a5',
                        fontSize: '0.8rem',
                    }}
                >
                    {t('loadFailed')}
                </div>
            </div>
        );
    }

    if (prefs && !prefs.enabled) {
        return (
            <div data-so-root style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button type={'button'} style={btn()} onClick={() => persist({ ...prefs, enabled: true })}>
                    <FontAwesomeIcon icon={faEye} /> {t('enableOrganiser')}
                </button>
            </div>
        );
    }

    if (!servers || !prefs) {
        return (
            <div data-so-root>
                <Spinner centered size={'large'} />
            </div>
        );
    }

    const editingServerObject = editingServer ? servers.find((s) => s.uuid === editingServer) : null;
    const editingGroupObject = editingGroup ? prefs.groups.find((g) => g.id === editingGroup) : null;

    return (
        <LangProvider value={lang}>
        <div data-so-root>
            {/* eszkoztar */}
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginBottom: '0.9rem',
                }}
            >
                <button type={'button'} style={btn(editMode)} onClick={() => setEditMode((v) => !v)}>
                    <FontAwesomeIcon icon={editMode ? faCheck : faPen} />
                    {editMode ? t('done') : t('organise')}
                </button>

                <button type={'button'} style={btn()} onClick={addGroup}>
                    <FontAwesomeIcon icon={faFolderPlus} /> {t('newGroup')}
                </button>

                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        color: C.faint,
                    }}
                >
                    <FontAwesomeIcon icon={faSort} />
                    <select
                        value={prefs.sortMode}
                        onChange={(e) => persist({ ...prefs, sortMode: e.target.value as SortMode })}
                        style={{
                            padding: '0.3rem 0.4rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.25rem',
                            border: `1px solid ${C.border}`,
                            background: C.panel,
                            color: C.muted,
                            cursor: 'pointer',
                        }}
                    >
                        {/*
                          * FONTOS: a ciklusvaltozo nem lehet 'mode', 'name', 'version' stb., mert a
                          * Blueprint telepitoje a kapcsos zarojelbe tett ilyen neveket sajat ertekre
                          * csereli a forrasfajlokban, es ezzel eltorne a JSX-et.
                          */}
                        {(Object.keys(SORT_KEYS) as SortMode[]).map((sortKey) => (
                            <option key={sortKey} value={sortKey}>
                                {t(SORT_KEYS[sortKey])}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ flex: 1 }} />

                {saving && <span style={{ fontSize: '0.7rem', color: C.faint }}>{t('saving')}</span>}
                {saveError && <span style={{ fontSize: '0.7rem', color: C.danger }}>{t('saveFailed')}</span>}

                {rootAdmin && (
                    <button type={'button'} style={btn(showAdmin)} onClick={() => setShowAdmin((v) => !v)}>
                        {showAdmin ? t('showingOthers') : t('showingOwn')}
                    </button>
                )}

                {editMode && (
                    <select
                        value={prefs.language || ''}
                        title={t('language')}
                        onChange={(e) =>
                            persist({ ...prefs, language: (e.target.value || null) as Lang | null })
                        }
                        style={{
                            padding: '0.3rem 0.4rem',
                            fontSize: '0.75rem',
                            borderRadius: '0.25rem',
                            border: `1px solid ${C.border}`,
                            background: C.panel,
                            color: C.muted,
                            cursor: 'pointer',
                        }}
                    >
                        <option value={''}>{t('language')}: auto</option>
                        {LANGUAGES.map((entry) => (
                            <option key={entry.code} value={entry.code}>
                                {entry.label}
                            </option>
                        ))}
                    </select>
                )}

                {editMode && (
                    <button type={'button'} style={btn()} onClick={() => persist({ ...prefs, enabled: false })}>
                        {t('disableOrganiser')}
                    </button>
                )}
            </div>

            {/* csoportok */}
            {sections.map(({ group, servers: groupServers }) => {
                // A "csoport nelkul" reszt csak akkor cimkezzuk, ha van egyaltalan csoport.
                if (!group && groupServers.length === 0 && prefs.groups.length > 0 && !editMode) {
                    return null;
                }

                return (
                    <GroupSection
                        key={group ? group.id : '__ungrouped__'}
                        group={group}
                        servers={groupServers}
                        prefFor={prefFor}
                        editMode={editMode}
                        showHeader={!!group || prefs.groups.length > 0}
                        draggingServer={draggingServer}
                        dropTarget={dropTarget}
                        draggingGroup={draggingGroup}
                        onToggleCollapse={() => group && toggleCollapse(group.id)}
                        onEditGroup={() => group && setEditingGroup(group.id)}
                        canRestartChain={!!group && groupHasRoles(groupServers)}
                        onRestartChain={() => group && setChainGroupId(group.id)}
                        onEditServer={(uuid) => setEditingServer(uuid)}
                        onServerDragStart={(uuid) => setDraggingServer(uuid)}
                        onServerDragEnd={finishServerDrag}
                        onServerDragOver={(uuid, position) => setDropTarget({ uuid, position })}
                        onServerDrop={handleServerDrop}
                        onDropIntoGroup={() => handleDropIntoGroup(group ? group.id : null)}
                        onGroupDragStart={() => group && setDraggingGroup(group.id)}
                        onGroupDragEnd={() => setDraggingGroup(null)}
                        onGroupDragOver={() => undefined}
                        onGroupDrop={() => group && handleGroupDrop(group.id)}
                    />
                );
            })}

            {servers.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: C.faint }}>
                    {showAdmin
? t('noOtherServers') : t('noServers')}
                </p>
            )}

            {/* modalok */}
            {editingServerObject && (
                <ServerSettingsModal
                    serverName={editingServerObject.name}
                    pref={prefFor(editingServerObject.uuid)}
                    groups={[...prefs.groups].sort((a, b) => a.order - b.order)}
                    onClose={() => setEditingServer(null)}
                    onSave={(pref) => {
                        persist({
                            ...prefs,
                            servers: { ...prefs.servers, [editingServerObject.uuid]: pref },
                        });
                        setEditingServer(null);
                    }}
                />
            )}

            {chainGroupId && (
                <RestartPanel
                    state={chain.state}
                    config={prefs.chain}
                    servers={servers}
                    targets={chainTargets}
                    onStart={() => chain.start(chainTargets, prefs.chain)}
                    onConfigChange={(next: ChainConfig) => persist({ ...prefs, chain: next })}
                    onAbort={chain.abort}
                    onRetry={() => {
                        chain.reset();
                        // A reset utan a panel visszater a terv-nezetbe, ahonnan ujra indithato.
                    }}
                    onClose={() => {
                        chain.reset();
                        setChainGroupId(null);
                    }}
                />
            )}

            {editingGroupObject && (
                <GroupEditModal
                    group={editingGroupObject}
                    onClose={() => setEditingGroup(null)}
                    onDelete={() => deleteGroup(editingGroupObject.id)}
                    onSave={(group) => {
                        persist({
                            ...prefs,
                            groups: prefs.groups.map((g) => (g.id === group.id ? group : g)),
                        });
                        setEditingGroup(null);
                    }}
                />
            )}
        </div>
        </LangProvider>
    );
};
