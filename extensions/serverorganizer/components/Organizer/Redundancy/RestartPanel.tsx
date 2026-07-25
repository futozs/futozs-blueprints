import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faTimes,
    faSpinner,
    faExclamationTriangle,
    faMinus,
    faWrench,
    faTrash,
    faStar,
    faLifeRing,
    faArrowDown,
    faTerminal,
} from '@fortawesome/free-solid-svg-icons';
import { Server } from '@/api/server/getServer';
import { Modal } from '../Modals';
import { C, btn, inputStyle } from '../ui';
import { useT } from '../i18n';
import { ChainConfig, ChainState, ConsoleLine, StepPhase, StepState } from './types';
import { LineLevel, PROGRESS_MARKERS } from './patterns';
import { FixResult, deletePackageJson, patchStartScript, resolvePort } from './fixPort';
import { parseAnsi } from './ansi';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

const PHASE_KEYS: Record<StepPhase, string> = {
    pending: 'phasePending',
    connecting: 'phaseConnecting',
    sending: 'phaseSending',
    stopping: 'phaseStopping',
    starting: 'phaseStarting',
    done: 'phaseDone',
    failed: 'phaseFailed',
    skipped: 'phaseSkipped',
};

const phaseColour = (phase: StepPhase): string => {
    if (phase === 'done') return '#34d399';
    if (phase === 'failed') return C.danger;
    if (phase === 'skipped' || phase === 'pending') return C.faint;

    return '#38bdf8';
};

/** A sor sajat besorolasa - ez ul RA az ANSI szinekre, es felul is irja azokat. */
const LEVEL_STYLE: Record<LineLevel, CSSProperties> = {
    normal: {},
    progress: { color: '#7dd3fc' },
    ready: { color: '#4ade80', fontWeight: 600 },
    notice: { color: '#fbbf24' },
    error: { color: '#f87171' },
};

const LEVEL_ACCENT: Record<LineLevel, string> = {
    normal: 'transparent',
    progress: '#38bdf8',
    ready: '#4ade80',
    notice: '#fbbf24',
    error: '#f87171',
};

/**
 * A build lepesei, ahogy tenylegesen megtortentek. Szandekosan csak azt
 * mutatjuk, amit mar lattunk a konzolon - igy barmilyen stackkel helyes marad,
 * nem csak Next.js + Prisma felallassal.
 */
const ProgressList = ({ progress, running }: { progress: string[]; running: boolean }) => {
    const t = useT();

    const reached = PROGRESS_MARKERS.filter((marker) => progress.indexOf(marker.key) !== -1);
    const isReady = progress.indexOf('ready') !== -1;

    if (reached.length === 0 && !isReady) {
        return null;
    }

    return (
        <div style={{ marginTop: '0.55rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.9rem' }}>
            {reached.map((marker) => (
                <span
                    key={marker.key}
                    style={{ fontSize: '0.72rem', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                    <FontAwesomeIcon icon={faCheck} style={{ fontSize: '0.62rem' }} />
                    {t(marker.labelKey as any)}
                </span>
            ))}

            {isReady && (
                <span
                    style={{ fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                >
                    <FontAwesomeIcon icon={faCheck} style={{ fontSize: '0.62rem' }} />
                    {t('stepReady')}
                </span>
            )}

            {running && !isReady && (
                <span
                    style={{ fontSize: '0.72rem', color: C.faint, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                    <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '0.62rem' }} />
                    {t('buildRunning')}
                </span>
            )}
        </div>
    );
};

const PhaseIcon = ({ phase }: { phase: StepPhase }) => {
    if (phase === 'done') return <FontAwesomeIcon icon={faCheck} />;
    if (phase === 'failed') return <FontAwesomeIcon icon={faTimes} />;
    if (phase === 'skipped' || phase === 'pending') return <FontAwesomeIcon icon={faMinus} />;

    return <FontAwesomeIcon icon={faSpinner} spin />;
};

/* ------------------------------------------------------------------ konzol */

const ConsoleRow = ({ line }: { line: ConsoleLine }) => {
    const override = LEVEL_STYLE[line.level];
    const segments = parseAnsi(line.text);

    return (
        <div
            style={{
                display: 'flex',
                borderLeft: `2px solid ${LEVEL_ACCENT[line.level]}`,
                paddingLeft: '0.5rem',
                background: line.level === 'error' ? 'rgba(248,113,113,0.07)' : 'transparent',
            }}
        >
            <span style={{ flex: 1, minWidth: 0, ...override }}>
                {segments.length === 0
                    ? ' '
                    : segments.map((segment, index) => (
                          <span key={index} style={{ ...segment.style, ...override }}>
                              {segment.text}
                          </span>
                      ))}
            </span>
        </div>
    );
};

const ConsoleView = ({ lines, label }: { lines: ConsoleLine[]; label: string }) => {
    const t = useT();
    const boxRef = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(true);

    useEffect(() => {
        if (pinned && boxRef.current) {
            boxRef.current.scrollTop = boxRef.current.scrollHeight;
        }
    }, [lines.length, pinned]);

    const handleScroll = () => {
        const box = boxRef.current;
        if (!box) return;

        // "Odatapadunk" az aljahoz, amig a felhasznalo nem gorget felfele.
        setPinned(box.scrollHeight - box.scrollTop - box.clientHeight < 40);
    };

    return (
        <div style={{ marginTop: '0.6rem', position: 'relative' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.6rem',
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderBottom: 'none',
                    borderTopLeftRadius: '0.3rem',
                    borderTopRightRadius: '0.3rem',
                    fontSize: '0.7rem',
                    color: C.faint,
                }}
            >
                <FontAwesomeIcon icon={faTerminal} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                <span>{lines.length}</span>
            </div>

            <div
                ref={boxRef}
                onScroll={handleScroll}
                style={{
                    height: 380,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    background: '#0b1016',
                    border: `1px solid ${C.border}`,
                    borderBottomLeftRadius: '0.3rem',
                    borderBottomRightRadius: '0.3rem',
                    padding: '0.5rem 0.4rem',
                    fontFamily: MONO,
                    fontSize: '0.78rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#cbd5e1',
                }}
            >
                {lines.length === 0 ? (
                    <div style={{ color: C.faint, fontStyle: 'italic' }}>{t('consoleWaiting')}</div>
                ) : (
                    lines.map((line, index) => <ConsoleRow key={index} line={line} />)
                )}
            </div>

            {!pinned && (
                <button
                    type={'button'}
                    onClick={() => setPinned(true)}
                    style={{
                        ...btn(true),
                        position: 'absolute',
                        right: '0.6rem',
                        bottom: '0.6rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                >
                    <FontAwesomeIcon icon={faArrowDown} /> {t('jumpToBottom')}
                </button>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------- lepes */

const StepBlock = ({ step, active, config }: { step: StepState; active: boolean; config: ChainConfig }) => {
    const t = useT();
    const colour = phaseColour(step.phase);
    const showConsole = active || step.phase === 'failed';

    return (
        <div
            style={{
                border: `1px solid ${active ? colour : C.border}`,
                borderRadius: '0.35rem',
                padding: '0.7rem 0.8rem',
                marginBottom: '0.7rem',
                background: active ? 'rgba(56,189,248,0.05)' : 'transparent',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <span style={{ color: colour, width: 16, textAlign: 'center' }}>
                    <PhaseIcon phase={step.phase} />
                </span>

                <FontAwesomeIcon
                    icon={step.role === 'primary' ? faStar : faLifeRing}
                    style={{ color: step.role === 'primary' ? '#fbbf24' : '#94a3b8', fontSize: '0.75rem' }}
                    title={step.role === 'primary' ? t('primaryServer') : t('backupServer')}
                />

                <span
                    style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {step.name}
                </span>

                {step.appReady && (
                    <span style={{ fontSize: '0.68rem', color: '#34d399' }}>{t('appReported')}</span>
                )}

                {(active || step.phase === 'failed') && (
                    <span style={{ fontSize: '0.68rem', color: C.faint }}>{step.elapsed}s</span>
                )}

                <span
                    style={{
                        fontSize: '0.72rem',
                        color: colour,
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                    }}
                >
                    {t(PHASE_KEYS[step.phase] as any)}
                </span>
            </div>

            <ProgressList progress={step.progress} running={active && step.phase !== 'failed'} />

            {showConsole && <ConsoleView lines={step.lines} label={step.name} />}
        </div>
    );
};

/* ------------------------------------------------------------------- hiba */

const FailureBox = ({ step, server, config }: { step: StepState; server: Server | undefined; config: ChainConfig }) => {
    const t = useT();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<FixResult | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const port = server ? resolvePort(server) : null;
    const offerPortFix = step.failureKind === 'package' || step.failureKind === 'port';
    const offerDelete = step.failureKind === 'pull' || step.failureKind === 'package';

    const reasonKey =
        step.failureKind === 'build'
            ? 'failBuild'
            : step.failureKind === 'timeout'
            ? 'failTimeout'
            : step.failureKind === 'crash'
            ? 'failCrash'
            : step.failureKind === 'pull'
            ? 'failPull'
            : step.failureKind === 'package'
            ? 'failPackage'
            : step.failureKind === 'port'
            ? 'failPort'
            : step.failureKind === 'aborted'
            ? 'failAborted'
            : 'failApi';

    const run = async (action: () => Promise<FixResult>) => {
        setBusy(true);
        try {
            setResult(await action());
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            style={{
                border: `1px solid ${C.danger}`,
                background: 'rgba(239,68,68,0.08)',
                borderRadius: '0.35rem',
                padding: '0.7rem 0.8rem',
                marginBottom: '0.7rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <strong>{t(reasonKey as any)}</strong>
            </div>

            {step.failureDetail && (
                <pre
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.45rem 0.55rem',
                        background: '#0b1016',
                        borderRadius: '0.25rem',
                        fontFamily: MONO,
                        fontSize: '0.75rem',
                        color: '#fca5a5',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 110,
                        overflowY: 'auto',
                    }}
                >
                    {step.failureDetail}
                </pre>
            )}

            {(offerPortFix || offerDelete) && (
                <div style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {offerPortFix && (
                        <button
                            type={'button'}
                            disabled={busy || !port}
                            style={{ ...btn(true), opacity: busy || !port ? 0.5 : 1 }}
                            onClick={() => server && run(() => patchStartScript(server, config.startScript))}
                        >
                            <FontAwesomeIcon icon={faWrench} />
                            {port ? `${t('fixPort')} (${port})` : t('fixNoPort')}
                        </button>
                    )}

                    {offerDelete && (
                        <button
                            type={'button'}
                            disabled={busy}
                            style={{ ...btn(), borderColor: C.danger, color: C.danger, opacity: busy ? 0.5 : 1 }}
                            onClick={() => {
                                if (!confirmDelete) {
                                    setConfirmDelete(true);
                                    return;
                                }
                                if (server) run(() => deletePackageJson(server));
                            }}
                        >
                            <FontAwesomeIcon icon={faTrash} />
                            {confirmDelete ? t('deletePackageConfirm') : t('deletePackage')}
                        </button>
                    )}
                </div>
            )}

            {confirmDelete && !result && (
                <div style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: '#fca5a5' }}>
                    {t('deletePackageWarning')}
                </div>
            )}

            {result && (
                <div style={{ marginTop: '0.55rem', fontSize: '0.72rem', color: result.ok ? '#34d399' : C.danger }}>
                    {result.ok
                        ? result.kind === 'patched'
                            ? `${t('fixApplied')} — ${result.command}`
                            : t('fixDeleted')
                        : t(('fixError_' + result.reason) as any)}
                </div>
            )}
        </div>
    );
};

/* ------------------------------------------------------------------- panel */

export default ({
    state,
    config,
    servers,
    targets,
    onStart,
    onConfigChange,
    onAbort,
    onClose,
    onRetry,
}: {
    state: ChainState;
    config: ChainConfig;
    servers: Server[];
    targets: { server: Server; role: 'primary' | 'backup' }[];
    onStart: () => void;
    onConfigChange: (config: ChainConfig) => void;
    onAbort: () => void;
    onClose: () => void;
    onRetry: () => void;
}) => {
    const t = useT();
    const failedStep = state.steps.find((step) => step.phase === 'failed');
    const allDone = !state.running && state.steps.length > 0 && state.steps.every((step) => step.phase === 'done');
    const started = state.steps.length > 0;

    /* ---------------------------------------------------- indulas elotti terv */

    if (!started) {
        return (
            <Modal
                title={t('restartChain')}
                onClose={onClose}
                footer={
                    <>
                        <button type={'button'} style={btn()} onClick={onClose}>
                            {t('cancel')}
                        </button>
                        <button
                            type={'button'}
                            style={{ ...btn(true), opacity: targets.length === 0 ? 0.5 : 1 }}
                            disabled={targets.length === 0}
                            onClick={onStart}
                        >
                            {t('startChain')}
                        </button>
                    </>
                }
            >
                <div style={{ fontSize: '0.72rem', color: C.faint, marginBottom: '0.8rem' }}>{t('chainExplainer')}</div>

                {targets.length === 0 ? (
                    <div style={{ color: C.danger, fontSize: '0.8rem' }}>{t('chainNeedsRoles')}</div>
                ) : (
                    <>
                        <div style={{ fontSize: '0.7rem', color: C.faint, marginBottom: '0.35rem' }}>{t('planTitle')}</div>
                        <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                            {targets.map((entry) => (
                                <li key={entry.server.uuid} style={{ marginBottom: '0.25rem' }}>
                                    <FontAwesomeIcon
                                        icon={entry.role === 'primary' ? faStar : faLifeRing}
                                        style={{
                                            color: entry.role === 'primary' ? '#fbbf24' : '#94a3b8',
                                            fontSize: '0.7rem',
                                            marginRight: '0.4rem',
                                        }}
                                    />
                                    {entry.server.name}
                                    <span style={{ color: C.faint, fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                                        ({entry.role === 'primary' ? t('rolePrimary') : t('roleBackup')})
                                    </span>
                                </li>
                            ))}
                        </ol>

                        <div style={{ height: 1, background: C.border, margin: '0.9rem 0' }} />

                        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.7rem', color: C.faint, marginBottom: '0.25rem' }}>
                                {t('readyPatternLabel')}
                            </div>
                            <input
                                type={'text'}
                                value={config.readyPattern}
                                maxLength={256}
                                onChange={(e) => onConfigChange({ ...config, readyPattern: e.target.value })}
                                style={{ ...inputStyle, fontFamily: MONO, fontSize: '0.78rem' }}
                            />
                            <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '0.3rem' }}>
                                {t('readyPatternHelp')}
                            </div>
                        </label>

                        <label style={{ display: 'block' }}>
                            <div style={{ fontSize: '0.7rem', color: C.faint, marginBottom: '0.25rem' }}>
                                {t('startScriptLabel')}
                            </div>
                            <input
                                type={'text'}
                                value={config.startScript}
                                maxLength={256}
                                onChange={(e) => onConfigChange({ ...config, startScript: e.target.value })}
                                style={inputStyle}
                            />
                        </label>
                        <div style={{ fontSize: '0.68rem', color: C.faint, marginTop: '0.3rem' }}>
                            {t('startScriptHelp')}
                        </div>
                    </>
                )}
            </Modal>
        );
    }

    /* -------------------------------------------------------- futas / eredmeny */

    return (
        <Modal
            title={t('restartChain')}
            maxWidth={980}
            onClose={state.running ? () => undefined : onClose}
            footer={
                state.running ? (
                    <button
                        type={'button'}
                        style={{ ...btn(), borderColor: C.danger, color: C.danger }}
                        onClick={onAbort}
                    >
                        {t('abort')}
                    </button>
                ) : (
                    <>
                        {failedStep && (
                            <button type={'button'} style={btn(true)} onClick={onRetry}>
                                {t('retry')}
                            </button>
                        )}
                        <button type={'button'} style={btn()} onClick={onClose}>
                            {t('close')}
                        </button>
                    </>
                )
            }
        >
            {state.steps.map((step, index) => (
                <React.Fragment key={step.uuid}>
                    <StepBlock step={step} active={state.activeIndex === index} config={config} />
                    {step.phase === 'failed' && (
                        <FailureBox step={step} server={servers.find((s) => s.uuid === step.uuid)} config={config} />
                    )}
                </React.Fragment>
            ))}

            {allDone && (
                <div
                    style={{
                        color: '#34d399',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                    }}
                >
                    <FontAwesomeIcon icon={faCheck} /> {t('chainComplete')}
                </div>
            )}
        </Modal>
    );
};
