import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faCheck,
    faCodeBranch,
    faExclamationTriangle,
    faRedo,
    faSpinner,
    faStop,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { C, MONO, bigBtn, formatBytes, formatDuration } from '../ui';
import { StringKey, useT } from '../i18n';
import { ChainTarget, useChain } from './chain';
import { ConsoleLine, Live, StepState } from './types';
import { LineLevel, MILESTONES, Milestone } from './startsh';
import { parseAnsi } from './ansi';

/* ---------------------------------------------------------------- szinek */

type Tone = 'idle' | 'busy' | 'ok' | 'bad' | 'wait';

const TONE: Record<Tone, string> = {
    idle: C.muted,
    busy: C.accent,
    ok: C.ok,
    bad: '#f87171',
    wait: C.warn,
};

const LEVEL_STYLE: Record<LineLevel, CSSProperties> = {
    normal: {},
    start: { color: '#67e8f9' },
    progress: { color: '#7dd3fc' },
    ready: { color: '#4ade80' },
    warning: { color: '#fbbf24' },
    error: { color: '#f87171' },
};

const MILESTONE_KEYS: Record<Milestone, StringKey> = {
    update: 'msUpdate',
    build: 'msBuild',
    launch: 'msLaunch',
    ready: 'msReady',
    warm: 'msWarm',
};

/* --------------------------------------------------- allapot -> kiiras */

const WAIT_ACTIVITIES = ['actWaitPeer', 'actWaitLock', 'actWaitMemory'];

const describe = (step: StepState, live: Live): { label: StringKey; tone: Tone; spinning: boolean } => {
    const state = live.stats?.state;

    switch (step.phase) {
        case 'sending':
            return { label: 'phSending', tone: 'busy', spinning: true };
        case 'stopping':
            return { label: 'phStopping', tone: 'busy', spinning: true };
        case 'starting': {
            const activity = live.activity as StringKey | null;
            if (activity && activity !== 'actReady' && activity !== 'actWarm' && activity !== 'actError') {
                return { label: activity, tone: WAIT_ACTIVITIES.indexOf(activity) !== -1 ? 'wait' : 'busy', spinning: true };
            }
            return { label: 'phStarting', tone: 'busy', spinning: true };
        }
        case 'warming':
            return { label: 'phWarming', tone: 'ok', spinning: true };
        case 'done':
            return { label: 'phDone', tone: 'ok', spinning: false };
        case 'failed':
            return { label: 'phFailed', tone: 'bad', spinning: false };
        case 'skipped':
            return { label: 'phSkipped', tone: 'idle', spinning: false };
        default:
            break;
    }

    // Meg nem kerult sorra: az elo allapot.
    if (!live.connected && !live.stats) return { label: 'stConnecting', tone: 'idle', spinning: true };
    if (state === 'running') return { label: 'stRunning', tone: 'ok', spinning: false };
    if (state === 'starting') return { label: 'stStarting', tone: 'busy', spinning: true };
    if (state === 'stopping') return { label: 'stStopping', tone: 'busy', spinning: true };
    return { label: 'stOffline', tone: 'bad', spinning: false };
};

/* --------------------------------------------------------- merfoldkovek */

const Milestones = ({ live, active, done }: { live: Live; active: boolean; done: boolean }) => {
    const t = useT();
    const reachedCount = MILESTONES.filter((ms) => live.reached.indexOf(ms) !== -1).length;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MILESTONES.length}, minmax(0, 1fr))`, gap: '0.3rem' }}>
            {MILESTONES.map((ms, index) => {
                const reached = done || live.reached.indexOf(ms) !== -1;
                const current = active && !reached && index === reachedCount;

                return (
                    <div key={ms} style={{ minWidth: 0 }}>
                        <div
                            style={{
                                height: 3,
                                borderRadius: 2,
                                background: reached ? C.ok : current ? C.accent : 'hsl(209, 14%, 30%)',
                            }}
                        />
                        <div
                            style={{
                                marginTop: '0.3rem',
                                fontSize: '0.72rem',
                                color: reached ? C.muted : current ? C.accent : C.faint,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {ms === 'build' && live.buildSkipped ? t('msBuildSkipped') : t(MILESTONE_KEYS[ms])}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/* ------------------------------------------------------------ lepeskartya */

const StepCard = ({
    step,
    live,
    active,
    selected,
    now,
    onSelect,
}: {
    step: StepState;
    live: Live;
    active: boolean;
    selected: boolean;
    now: number;
    onSelect: () => void;
}) => {
    const t = useT();
    const info = describe(step, live);
    const tone = TONE[info.tone];
    const elapsed = step.startedAt ? (step.finishedAt || now) - step.startedAt : null;
    const stats = live.stats;
    const started = step.phase !== 'pending' && step.phase !== 'skipped';

    const metrics = [
        `CPU ${stats ? Math.round(stats.cpu) + '%' : '–'}`,
        `RAM ${stats ? formatBytes(stats.memory) + (stats.memoryLimit ? ' / ' + formatBytes(stats.memoryLimit) : '') : '–'}`,
        `${t('uptime')} ${stats && stats.state === 'running' && stats.uptime ? formatDuration(stats.uptime) : '–'}`,
    ];

    return (
        <button
            type={'button'}
            onClick={onSelect}
            style={{
                minWidth: 0,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                padding: '0.8rem 1rem',
                borderRadius: '0.375rem',
                background: C.deep,
                border: `1px solid ${selected ? (active ? C.accent : C.muted) : C.border}`,
                color: C.text,
                cursor: 'pointer',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', minWidth: 0 }}>
                <span
                    style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        color: step.role === 'primary' ? C.primary : C.backup,
                    }}
                >
                    {step.role === 'primary' ? 'PRIMARY' : 'BACKUP'}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {step.name}
                </span>
                {elapsed !== null && (
                    <span style={{ fontFamily: MONO, fontSize: '0.85rem', color: C.muted }}>{formatDuration(elapsed)}</span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: tone }}>
                <FontAwesomeIcon
                    icon={info.spinning ? faSpinner : info.tone === 'bad' ? faExclamationTriangle : faCheck}
                    spin={info.spinning}
                    style={{ fontSize: '0.95rem', opacity: info.tone === 'idle' && !info.spinning ? 0 : 1 }}
                />
                <span style={{ fontSize: '1.15rem', fontWeight: 600 }}>{t(info.label)}</span>
            </div>

            {started && <Milestones live={live} active={active} done={step.phase === 'done'} />}

            <div style={{ fontFamily: MONO, fontSize: '0.78rem', color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {metrics.join('   ·   ')}
            </div>

            {live.commit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: MONO, fontSize: '0.78rem', color: C.faint, minWidth: 0 }}>
                    <FontAwesomeIcon icon={faCodeBranch} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {live.commit.replace(/^git:\s*/, '')}
                    </span>
                </div>
            )}
        </button>
    );
};

/* ------------------------------------------------------------------ konzol */

const ConsoleRow = React.memo(({ line }: { line: ConsoleLine }) => {
    if (line.divider) {
        return <div style={{ margin: '0.5rem 0', color: C.accent, borderTop: '1px dashed hsl(209, 14%, 30%)', paddingTop: '0.4rem' }}>{line.text}</div>;
    }

    const override = LEVEL_STYLE[line.level];
    const segments = parseAnsi(line.text);

    return (
        <div>
            {segments.length === 0
                ? ' '
                : segments.map((segment, index) => (
                      <span key={index} style={{ ...segment.style, ...override }}>
                          {segment.text}
                      </span>
                  ))}
        </div>
    );
});

const ConsoleView = ({ lines }: { lines: ConsoleLine[] }) => {
    const t = useT();
    const boxRef = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(true);

    useEffect(() => {
        if (pinned && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }, [lines, pinned]);

    return (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
            <div
                ref={boxRef}
                className={'so-console'}
                onScroll={() => {
                    const box = boxRef.current;
                    if (box) setPinned(box.scrollHeight - box.scrollTop - box.clientHeight < 40);
                }}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: C.console,
                    padding: '0.7rem 0.9rem',
                    fontFamily: MONO,
                    fontSize: '0.8rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#cbd5e1',
                }}
            >
                {lines.length === 0 ? (
                    <div style={{ color: C.faint }}>{t('consoleWaiting')}</div>
                ) : (
                    lines.map((line, index) => <ConsoleRow key={index} line={line} />)
                )}
            </div>

            {!pinned && (
                <button
                    type={'button'}
                    onClick={() => setPinned(true)}
                    style={{ ...bigBtn('plain'), height: 32, background: C.panel, position: 'absolute', right: '1rem', bottom: '0.8rem' }}
                >
                    <FontAwesomeIcon icon={faArrowDown} /> {t('jumpToBottom')}
                </button>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ ablak */

export default ({ title, targets, onClose }: { title: string; targets: ChainTarget[]; onClose: () => void }) => {
    const t = useT();
    const { live, chain, start, abort } = useChain(targets);
    const [now, setNow] = useState(Date.now());
    const [selected, setSelected] = useState<string>(targets[0]?.server.uuid || '');

    const started = chain.steps.some((step) => step.phase !== 'pending');
    const failed = chain.steps.find((step) => step.phase === 'failed');
    const failedIndex = failed ? chain.steps.indexOf(failed) : -1;
    const allDone = !chain.running && chain.steps.length > 0 && chain.steps.every((step) => step.phase === 'done');

    const primary = targets.find((target) => target.role === 'primary');
    const backup = targets.find((target) => target.role === 'backup');
    const backupLive = backup ? live[backup.server.uuid] : null;
    const backupDown = !!backup && !!backupLive?.stats && backupLive.stats.state !== 'running';

    // Mindig az aktiv lepes konzolja latszik; kattintassal at lehet nezni a masikra.
    useEffect(() => {
        if (chain.activeIndex !== null && chain.steps[chain.activeIndex]) {
            setSelected(chain.steps[chain.activeIndex].uuid);
        }
    }, [chain.activeIndex]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Futas kozben nem zarhato be - elobb meg kell szakitani.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !chain.running) onClose();
        };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [chain.running, onClose]);

    const labels = { restart: t('dividerRestart') };
    const selectedLive = live[selected] || null;

    const failureTitle = failed
        ? t(
              failed.failureKind === 'aborted'
                  ? 'failAborted'
                  : failed.failureKind === 'timeout'
                  ? 'failTimeout'
                  : failed.failureKind === 'api'
                  ? 'failApi'
                  : 'failCrash'
          )
        : '';

    /* egyetlen sor az allapotrol, a gombok mellett */
    let notice: { tone: Tone; text: string; detail?: string | null } | null = null;
    if (failed && !chain.running) {
        notice = { tone: 'bad', text: `${failed.role === 'primary' ? 'Primary' : 'Backup'}: ${failureTitle}`, detail: failed.failureDetail };
    } else if (allDone) {
        notice = { tone: 'ok', text: t(targets.length > 1 ? 'chainComplete' : 'singleComplete') };
    } else if (chain.running && chain.activeIndex !== null) {
        notice = { tone: 'busy', text: t(chain.steps[chain.activeIndex].role === 'primary' ? 'runPrimary' : 'runBackup') };
    } else if (!started && primary && !backup) {
        notice = { tone: 'wait', text: t('warnNoBackup') };
    } else if (!started && primary && backupDown) {
        notice = { tone: 'bad', text: t('warnBackupDown') };
    }

    const popup = (
        <div
            onClick={() => !chain.running && onClose()}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: 1180,
                    height: 'min(880px, 94vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: '0.5rem',
                    color: C.text,
                    overflow: 'hidden',
                }}
            >
                {/* fejlec */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.85rem 1.2rem',
                        borderBottom: `1px solid ${C.border}`,
                    }}
                >
                    <span style={{ flex: 1, minWidth: 0, fontSize: '1.1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('restart')} · {title}
                    </span>
                    <button
                        type={'button'}
                        onClick={onClose}
                        disabled={chain.running}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: C.faint,
                            fontSize: '1.15rem',
                            cursor: chain.running ? 'not-allowed' : 'pointer',
                            opacity: chain.running ? 0.3 : 1,
                        }}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* lepesek */}
                <div className={'so-steps'} style={{ padding: '1rem 1.2rem 0' }}>
                    {chain.steps.map((step, index) => (
                        <StepCard
                            key={step.uuid}
                            step={step}
                            live={live[step.uuid]}
                            active={chain.activeIndex === index}
                            selected={selected === step.uuid}
                            now={now}
                            onSelect={() => setSelected(step.uuid)}
                        />
                    ))}
                </div>

                {/* allapot + gombok */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.2rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                        {notice && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: TONE[notice.tone], fontSize: '0.95rem' }}>
                                    {notice.tone !== 'busy' && notice.tone !== 'ok' && <FontAwesomeIcon icon={faExclamationTriangle} />}
                                    {notice.tone === 'ok' && <FontAwesomeIcon icon={faCheck} />}
                                    <span>{notice.text}</span>
                                </div>
                                {notice.detail && (
                                    <div style={{ marginTop: '0.3rem', fontFamily: MONO, fontSize: '0.8rem', color: C.muted, wordBreak: 'break-word' }}>
                                        {notice.detail}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        {!started && (
                            <button type={'button'} style={{ ...bigBtn('go'), minWidth: 170 }} onClick={() => start(0, labels)}>
                                <FontAwesomeIcon icon={faRedo} /> {t('startChain')}
                            </button>
                        )}
                        {chain.running && (
                            <button type={'button'} style={bigBtn('danger')} onClick={abort}>
                                <FontAwesomeIcon icon={faStop} /> {t('abort')}
                            </button>
                        )}
                        {failed && !chain.running && (
                            <button type={'button'} style={bigBtn('go')} onClick={() => start(failedIndex, labels)}>
                                <FontAwesomeIcon icon={faRedo} /> {t('retry')}
                            </button>
                        )}
                        {!chain.running && started && (
                            <button type={'button'} style={bigBtn('plain')} onClick={onClose}>
                                {t('close')}
                            </button>
                        )}
                    </div>
                </div>

                {/* konzol: a kivalasztott szervere; a fulekkel valthato */}
                <div style={{ display: 'flex', gap: '0.25rem', padding: '0 1.2rem', borderBottom: `1px solid ${C.border}` }}>
                    {chain.steps.map((step) => (
                        <button
                            key={step.uuid}
                            type={'button'}
                            onClick={() => setSelected(step.uuid)}
                            style={{
                                padding: '0.5rem 0.9rem',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: `2px solid ${selected === step.uuid ? C.accent : 'transparent'}`,
                                marginBottom: -1,
                                color: selected === step.uuid ? C.text : C.faint,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {t('console')} · {step.role === 'primary' ? 'Primary' : 'Backup'}
                        </button>
                    ))}
                </div>

                {selectedLive && <ConsoleView lines={selectedLive.lines} />}
            </div>
        </div>
    );

    return createPortal(popup, document.body);
};
