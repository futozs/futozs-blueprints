import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck, faTimes, faSpinner, faExclamationTriangle, faMinus, faWrench, faTrash, faStar, faLifeRing,
} from '@fortawesome/free-solid-svg-icons';
import { Server } from '@/api/server/getServer';
import { Modal } from '../Modals';
import { C, btn, inputStyle } from '../ui';
import { useT } from '../i18n';
import { ChainConfig, ChainState, StepPhase, StepState } from './types';
import { FixResult, deletePackageJson, patchStartScript, resolvePort } from './fixPort';

const PHASE_KEYS: Record<StepPhase, string> = {
    pending: 'phasePending',
    connecting: 'phaseConnecting',
    sending: 'phaseSending',
    stopping: 'phaseStopping',
    starting: 'phaseStarting',
    stabilising: 'phaseStabilising',
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

const PhaseIcon = ({ phase }: { phase: StepPhase }) => {
    if (phase === 'done') return <FontAwesomeIcon icon={faCheck} />;
    if (phase === 'failed') return <FontAwesomeIcon icon={faTimes} />;
    if (phase === 'skipped' || phase === 'pending') return <FontAwesomeIcon icon={faMinus} />;

    return <FontAwesomeIcon icon={faSpinner} spin />;
};

/** Elo konzol-kivonat: mindig a legutolso sorokhoz gorgetunk. */
const ConsoleTail = ({ lines }: { lines: string[] }) => {
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (boxRef.current) {
            boxRef.current.scrollTop = boxRef.current.scrollHeight;
        }
    }, [lines.length]);

    if (lines.length === 0) return null;

    return (
        <div
            ref={boxRef}
            style={{
                marginTop: '0.5rem',
                maxHeight: 150,
                overflowY: 'auto',
                background: C.deep,
                border: `1px solid ${C.border}`,
                borderRadius: '0.25rem',
                padding: '0.4rem 0.5rem',
                fontFamily: 'monospace',
                fontSize: '0.68rem',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: C.muted,
            }}
        >
            {lines.map((line, index) => (
                <div key={index}>{line}</div>
            ))}
        </div>
    );
};

const StepBlock = ({
    step,
    active,
    config,
}: {
    step: StepState;
    active: boolean;
    config: ChainConfig;
}) => {
    const t = useT();
    const colour = phaseColour(step.phase);

    return (
        <div
            style={{
                border: `1px solid ${active ? colour : C.border}`,
                borderRadius: '0.3rem',
                padding: '0.6rem 0.7rem',
                marginBottom: '0.6rem',
                background: active ? 'rgba(56,189,248,0.06)' : 'transparent',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: colour, width: 16, textAlign: 'center' }}>
                    <PhaseIcon phase={step.phase} />
                </span>

                <FontAwesomeIcon
                    icon={step.role === 'primary' ? faStar : faLifeRing}
                    style={{ color: step.role === 'primary' ? '#fbbf24' : '#94a3b8', fontSize: '0.75rem' }}
                    title={step.role === 'primary' ? t('primaryServer') : t('backupServer')}
                />

                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {step.name}
                </span>

                <span style={{ fontSize: '0.7rem', color: colour, whiteSpace: 'nowrap' }}>
                    {t(PHASE_KEYS[step.phase] as any)}
                </span>
            </div>

            {/* stabilitasi visszaszamlalas */}
            {step.phase === 'stabilising' && (
                <div style={{ marginTop: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: C.faint }}>
                        <span>{t('stabilityProgress')}</span>
                        <span>
                            {step.stableFor}s / {config.stabilitySeconds}s
                        </span>
                    </div>
                    <div style={{ height: 4, background: C.deep, borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                        <div
                            style={{
                                height: '100%',
                                width: `${Math.min(100, (step.stableFor / config.stabilitySeconds) * 100)}%`,
                                background: colour,
                                transition: 'width 400ms linear',
                            }}
                        />
                    </div>
                </div>
            )}

            {(active || step.phase === 'failed') && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.68rem', color: C.faint, display: 'flex', gap: '0.75rem' }}>
                    <span>
                        {t('elapsed')}: {step.elapsed}s
                    </span>
                    {step.appReady && <span style={{ color: '#34d399' }}>{t('appReported')}</span>}
                </div>
            )}

            {active && <ConsoleTail lines={step.lines} />}
        </div>
    );
};

const FailureBox = ({
    step,
    server,
    config,
    onFixed,
}: {
    step: StepState;
    server: Server | undefined;
    config: ChainConfig;
    onFixed: () => void;
}) => {
    const t = useT();
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<FixResult | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const port = server ? resolvePort(server) : null;
    const offerPortFix = step.failureKind === 'package' || step.failureKind === 'port';
    const offerDelete = step.failureKind === 'pull' || step.failureKind === 'package';

    const reasonKey =
        step.failureKind === 'timeout'
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
            const outcome = await action();
            setResult(outcome);
            if (outcome.ok) onFixed();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            style={{
                border: `1px solid ${C.danger}`,
                background: 'rgba(239,68,68,0.08)',
                borderRadius: '0.3rem',
                padding: '0.6rem 0.7rem',
                marginBottom: '0.6rem',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.8rem' }}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <strong>{t(reasonKey as any)}</strong>
            </div>

            {step.failureDetail && (
                <pre
                    style={{
                        marginTop: '0.45rem',
                        padding: '0.4rem 0.5rem',
                        background: C.deep,
                        borderRadius: '0.2rem',
                        fontSize: '0.68rem',
                        color: C.muted,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: 90,
                        overflowY: 'auto',
                    }}
                >
                    {step.failureDetail}
                </pre>
            )}

            {(offerPortFix || offerDelete) && (
                <div style={{ marginTop: '0.55rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
                <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', color: '#fca5a5' }}>{t('deletePackageWarning')}</div>
            )}

            {result && (
                <div
                    style={{
                        marginTop: '0.5rem',
                        fontSize: '0.7rem',
                        color: result.ok ? '#34d399' : C.danger,
                    }}
                >
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
        const numberField = (
            label: string,
            value: number,
            min: number,
            max: number,
            apply: (next: number) => void
        ) => (
            <label style={{ display: 'block', marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.7rem', color: C.faint, marginBottom: '0.25rem' }}>{label}</div>
                <input
                    type={'number'}
                    value={value}
                    min={min}
                    max={max}
                    onChange={(e) => apply(Number(e.target.value))}
                    style={{ ...inputStyle, maxWidth: 140 }}
                />
            </label>
        );

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

                        {numberField(t('stabilityLabel'), config.stabilitySeconds, 5, 600, (next) =>
                            onConfigChange({ ...config, stabilitySeconds: next })
                        )}
                        {numberField(t('timeoutLabel'), config.timeoutSeconds, 30, 3600, (next) =>
                            onConfigChange({ ...config, timeoutSeconds: next })
                        )}

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
            onClose={state.running ? () => undefined : onClose}
            footer={
                state.running ? (
                    <button type={'button'} style={{ ...btn(), borderColor: C.danger, color: C.danger }} onClick={onAbort}>
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
            <div style={{ fontSize: '0.72rem', color: C.faint, marginBottom: '0.7rem' }}>{t('chainExplainer')}</div>

            {state.steps.map((step, index) => (
                <React.Fragment key={step.uuid}>
                    <StepBlock step={step} active={state.activeIndex === index} config={config} />
                    {step.phase === 'failed' && (
                        <FailureBox
                            step={step}
                            server={servers.find((s) => s.uuid === step.uuid)}
                            config={config}
                            onFixed={() => undefined}
                        />
                    )}
                </React.Fragment>
            ))}

            {allDone && (
                <div style={{ color: '#34d399', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FontAwesomeIcon icon={faCheck} /> {t('chainComplete')}
                </div>
            )}
        </Modal>
    );
};
