import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowRight,
    faCheck,
    faCheckCircle,
    faCodeBranch,
    faExclamationTriangle,
    faRedo,
    faSpinner,
    faStop,
    faSync,
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
    idle: C.faint,
    busy: C.accent,
    ok: C.ok,
    bad: C.danger,
    wait: C.warn,
};

const LEVEL_STYLE: Record<LineLevel, CSSProperties> = {
    normal: {},
    start: { color: '#67e8f9' },
    progress: { color: '#7dd3fc' },
    ready: { color: '#4ade80', fontWeight: 700 },
    warning: { color: '#fbbf24' },
    error: { color: '#f87171' },
};

const LEVEL_ACCENT: Record<LineLevel, string> = {
    normal: 'transparent',
    start: 'rgba(103,232,249,0.5)',
    progress: '#38bdf8',
    ready: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
};

const MILESTONE_KEYS: Record<Milestone, StringKey> = {
    update: 'msUpdate',
    build: 'msBuild',
    launch: 'msLaunch',
    ready: 'msReady',
    warm: 'msWarm',
};

/* --------------------------------------------------- allapot -> nagy kiiras */

const WAIT_ACTIVITIES = ['actWaitPeer', 'actWaitLock', 'actWaitMemory'];

const describe = (
    step: StepState,
    live: Live,
    chainStarted: boolean
): { label: StringKey; tone: Tone; spinning: boolean } => {
    const state = live.stats?.state;

    switch (step.phase) {
        case 'sending':
            return { label: 'phSending', tone: 'busy', spinning: true };
        case 'stopping':
            return { label: 'phStopping', tone: 'busy', spinning: true };
        case 'starting': {
            const activity = live.activity as StringKey | null;
            if (activity && activity !== 'actReady' && activity !== 'actWarm' && activity !== 'actError') {
                return {
                    label: activity,
                    tone: WAIT_ACTIVITIES.indexOf(activity) !== -1 ? 'wait' : 'busy',
                    spinning: true,
                };
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

    // Meg nem kerult sorra: az elo allapotot mutatjuk.
    if (!live.connected && !live.stats) return { label: 'stConnecting', tone: 'idle', spinning: true };
    if (state === 'running') return { label: 'stRunning', tone: chainStarted ? 'idle' : 'ok', spinning: false };
    if (state === 'starting') return { label: 'stStarting', tone: 'busy', spinning: true };
    if (state === 'stopping') return { label: 'stStopping', tone: 'busy', spinning: true };
    return { label: 'stOffline', tone: 'bad', spinning: false };
};

/* --------------------------------------------------------- merfoldkovek */

const Milestones = ({ live, active, done }: { live: Live; active: boolean; done: boolean }) => {
    const t = useT();
    const reachedCount = MILESTONES.filter((ms) => live.reached.indexOf(ms) !== -1).length;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MILESTONES.length}, 1fr)`, gap: '0.35rem' }}>
            {MILESTONES.map((ms, index) => {
                const reached = done || live.reached.indexOf(ms) !== -1;
                const current = active && !reached && index === reachedCount;
                const skippedBuild = ms === 'build' && live.buildSkipped;
                const colour = reached ? C.ok : current ? C.accent : 'rgba(255,255,255,0.12)';

                return (
                    <div key={ms}>
                        <div
                            style={{
                                height: 8,
                                borderRadius: 4,
                                background: colour,
                                boxShadow: current ? `0 0 12px ${C.accent}` : 'none',
                                transition: 'background 200ms ease',
                            }}
                        />
                        <div
                            style={{
                                marginTop: '0.4rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: reached ? C.text : current ? C.accent : C.faint,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {skippedBuild ? t('msBuildSkipped') : t(MILESTONE_KEYS[ms])}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/* ------------------------------------------------------------ lepeskartya */

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: C.faint }}>{label}</div>
        <div style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: MONO, color: C.text, whiteSpace: 'nowrap' }}>
            {value}
        </div>
    </div>
);

const StepCard = ({
    index,
    step,
    live,
    active,
    selected,
    chainStarted,
    now,
    onSelect,
}: {
    index: number;
    step: StepState;
    live: Live;
    active: boolean;
    selected: boolean;
    chainStarted: boolean;
    now: number;
    onSelect: () => void;
}) => {
    const t = useT();
    const info = describe(step, live, chainStarted);
    const tone = TONE[info.tone];
    const roleColour = step.role === 'primary' ? C.primary : C.backup;
    const elapsed = step.startedAt ? (step.finishedAt || now) - step.startedAt : null;
    const stats = live.stats;
    const showMilestones = step.phase !== 'pending' && step.phase !== 'skipped';

    return (
        <button
            type={'button'}
            onClick={onSelect}
            style={{
                flex: '1 1 380px',
                minWidth: 0,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.25rem 1.4rem',
                borderRadius: '0.9rem',
                background: active ? 'rgba(56,189,248,0.07)' : 'rgba(255,255,255,0.03)',
                border: `2px solid ${selected ? tone : 'rgba(255,255,255,0.08)'}`,
                boxShadow: active ? `0 0 0 4px ${tone}22` : 'none',
                color: C.text,
                cursor: 'pointer',
                transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                        background: roleColour,
                        color: C.deep,
                        flexShrink: 0,
                    }}
                >
                    {index + 1}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.12em', color: roleColour }}>
                        {step.role === 'primary' ? 'PRIMARY' : 'BACKUP'}
                    </div>
                    <div
                        style={{
                            fontSize: '0.95rem',
                            color: C.muted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {step.name}
                    </div>
                </div>
                {elapsed !== null && (
                    <span style={{ fontFamily: MONO, fontSize: '1.5rem', fontWeight: 700, color: tone }}>
                        {formatDuration(elapsed)}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: tone, minHeight: 48 }}>
                <FontAwesomeIcon
                    icon={
                        info.spinning
                            ? faSpinner
                            : info.tone === 'ok'
                            ? faCheckCircle
                            : info.tone === 'bad'
                            ? faExclamationTriangle
                            : faCheck
                    }
                    spin={info.spinning}
                    style={{ fontSize: '1.9rem' }}
                />
                <span style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1 }}>{t(info.label)}</span>
            </div>

            {showMilestones && <Milestones live={live} active={active} done={step.phase === 'done'} />}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                <Stat label={'CPU'} value={stats ? `${Math.round(stats.cpu)}%` : '–'} />
                <Stat
                    label={'RAM'}
                    value={
                        stats
                            ? `${formatBytes(stats.memory)}${stats.memoryLimit ? ' / ' + formatBytes(stats.memoryLimit) : ''}`
                            : '–'
                    }
                />
                <Stat
                    label={t('uptime')}
                    value={stats && stats.state === 'running' && stats.uptime ? formatDuration(stats.uptime) : '–'}
                />
            </div>

            {live.commit && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        fontFamily: MONO,
                        fontSize: '0.9rem',
                        color: C.muted,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                    }}
                >
                    <FontAwesomeIcon icon={faCodeBranch} style={{ color: C.faint }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.8rem',
                    margin: '0.8rem 0',
                    color: C.accent,
                    fontWeight: 700,
                }}
            >
                <span style={{ flex: 1, height: 1, background: 'rgba(56,189,248,0.4)' }} />
                {line.text}
                <span style={{ flex: 1, height: 1, background: 'rgba(56,189,248,0.4)' }} />
            </div>
        );
    }

    const override = LEVEL_STYLE[line.level];
    const segments = parseAnsi(line.text);

    return (
        <div
            style={{
                borderLeft: `3px solid ${LEVEL_ACCENT[line.level]}`,
                paddingLeft: '0.7rem',
                background: line.level === 'error' ? 'rgba(248,113,113,0.08)' : 'transparent',
            }}
        >
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

const ConsoleView = ({ lines, title, connected }: { lines: ConsoleLine[]; title: string; connected: boolean }) => {
    const t = useT();
    const boxRef = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(true);

    useEffect(() => {
        if (pinned && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }, [lines, pinned]);

    return (
        <div
            style={{
                position: 'relative',
                flex: 1,
                minHeight: 360,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '0.9rem',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.7rem 1.1rem',
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: C.muted,
                }}
            >
                <span
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: connected ? C.ok : C.danger,
                        boxShadow: connected ? `0 0 8px ${C.ok}` : 'none',
                    }}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                </span>
            </div>

            <div
                ref={boxRef}
                onScroll={() => {
                    const box = boxRef.current;
                    if (box) setPinned(box.scrollHeight - box.scrollTop - box.clientHeight < 60);
                }}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: C.console,
                    padding: '0.9rem 1rem',
                    fontFamily: MONO,
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
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
                    style={{
                        ...bigBtn('go'),
                        minHeight: 48,
                        fontSize: '1rem',
                        padding: '0 1.2rem',
                        position: 'absolute',
                        right: '1.2rem',
                        bottom: '1.2rem',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                    }}
                >
                    <FontAwesomeIcon icon={faArrowDown} /> {t('jumpToBottom')}
                </button>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------ banner */

const Banner = ({ tone, title, detail }: { tone: Tone; title: string; detail?: string | null }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem 1.3rem',
            borderRadius: '0.9rem',
            border: `2px solid ${TONE[tone]}`,
            background: `${TONE[tone]}1a`,
            color: TONE[tone],
            minWidth: 0,
            flex: '1 1 320px',
        }}
    >
        <FontAwesomeIcon
            icon={tone === 'ok' ? faCheckCircle : tone === 'busy' ? faSpinner : faExclamationTriangle}
            spin={tone === 'busy'}
            style={{ fontSize: '1.9rem', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{title}</div>
            {detail && (
                <div
                    style={{
                        marginTop: '0.25rem',
                        fontFamily: MONO,
                        fontSize: '0.92rem',
                        color: C.text,
                        wordBreak: 'break-word',
                    }}
                >
                    {detail}
                </div>
            )}
        </div>
    </div>
);

/* ------------------------------------------------------------------ kepernyo */

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
    const selectedTarget = targets.find((target) => target.server.uuid === selected) || targets[0];
    const selectedLive = (selectedTarget && live[selectedTarget.server.uuid]) || null;

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

    const screen = (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                background: 'radial-gradient(ellipse at top, #13202e 0%, #0a0f15 70%)',
                color: C.text,
                overflowY: 'auto',
            }}
        >
            <div
                style={{
                    minHeight: '100%',
                    maxWidth: 1600,
                    margin: '0 auto',
                    padding: 'clamp(1rem, 2.5vw, 2rem)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    boxSizing: 'border-box',
                }}
            >
                {/* fejlec */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <FontAwesomeIcon
                        icon={faSync}
                        spin={chain.running}
                        style={{ fontSize: '1.9rem', color: chain.running ? C.accent : C.faint }}
                    />
                    <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: 800 }}>
                        {title}
                    </h1>
                    {!chain.running && (
                        <button type={'button'} style={{ ...bigBtn('plain'), minHeight: 52, fontSize: '1.05rem' }} onClick={onClose}>
                            <FontAwesomeIcon icon={faTimes} /> {t('close')}
                        </button>
                    )}
                </div>

                {/* lepesek: primary -> backup */}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap' }}>
                    {chain.steps.map((step, index) => (
                        <React.Fragment key={step.uuid}>
                            {index > 0 && (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '1.8rem',
                                        color: chain.steps[index - 1].phase === 'done' ? C.ok : C.faint,
                                    }}
                                >
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </div>
                            )}
                            <StepCard
                                index={index}
                                step={step}
                                live={live[step.uuid]}
                                active={chain.activeIndex === index}
                                selected={selected === step.uuid}
                                chainStarted={started}
                                now={now}
                                onSelect={() => setSelected(step.uuid)}
                            />
                        </React.Fragment>
                    ))}
                </div>

                {/* fo muvelet + allapot */}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', flexWrap: 'wrap' }}>
                    {!started && primary && !backup && <Banner tone={'wait'} title={t('warnNoBackup')} />}
                    {!started && primary && backupDown && <Banner tone={'bad'} title={t('warnBackupDown')} />}

                    {chain.running && chain.activeIndex !== null && (
                        <Banner
                            tone={'busy'}
                            title={t(chain.steps[chain.activeIndex].role === 'primary' ? 'runPrimary' : 'runBackup')}
                        />
                    )}

                    {allDone && <Banner tone={'ok'} title={t(targets.length > 1 ? 'chainComplete' : 'singleComplete')} />}
                    {failed && !chain.running && (
                        <Banner
                            tone={'bad'}
                            title={`${failed.role === 'primary' ? 'PRIMARY' : 'BACKUP'}: ${failureTitle}`}
                            detail={failed.failureDetail}
                        />
                    )}

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
                        {!started && (
                            <button
                                type={'button'}
                                style={{ ...bigBtn('go'), minWidth: 300 }}
                                onClick={() => start(0, labels)}
                            >
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
                        {allDone && (
                            <button type={'button'} style={bigBtn('ok')} onClick={onClose}>
                                <FontAwesomeIcon icon={faCheck} /> {t('close')}
                            </button>
                        )}
                    </div>
                </div>

                {/* konzol */}
                {selectedTarget && selectedLive && (
                    <ConsoleView
                        lines={selectedLive.lines}
                        connected={selectedLive.connected}
                        title={`${selectedTarget.role === 'primary' ? 'PRIMARY' : 'BACKUP'} · ${selectedTarget.server.name}`}
                    />
                )}
            </div>
        </div>
    );

    return createPortal(screen, document.body);
};
