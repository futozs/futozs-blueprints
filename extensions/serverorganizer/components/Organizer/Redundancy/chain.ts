import { useCallback, useEffect, useRef, useState } from 'react';
import http from '@/api/http';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { Websocket } from '@/plugins/Websocket';
import { Server } from '@/api/server/getServer';
import { ChainState, ConsoleLine, FailureKind, Live, StepState } from './types';
import { classify, messageOf } from './startsh';

const MAX_LINES = 3000;
const FLUSH_MS = 120;
/** Ennyi ido alatt a restartra valaszolnia kell a Wingsnek (lealt / indul). */
const ACK_TIMEOUT_MS = 90 * 1000;
/** "Ready in" utan a start.sh rogziti a commitot es bemelegit - legfeljebb eddig varunk ra. */
const WARM_TIMEOUT_MS = 120 * 1000;
/** Vegso biztonsagi hatar: build-zarra varas (max 15 perc) + build + inditas. */
const STEP_TIMEOUT_MS = 60 * 60 * 1000;

export interface ChainTarget {
    server: Server;
    role: 'primary' | 'backup';
}

const emptyLive = (): Live => ({
    connected: false,
    stats: null,
    lines: [],
    reached: [],
    activity: null,
    activityDetail: null,
    commit: null,
    buildSkipped: false,
    lastError: null,
});

const makeStep = (target: ChainTarget): StepState => ({
    uuid: target.server.uuid,
    name: target.server.name,
    role: target.role,
    phase: 'pending',
    startedAt: null,
    finishedAt: null,
    failureKind: null,
    failureDetail: null,
});

const clock = () => new Date().toLocaleTimeString('hu-HU', { hour12: false });

type Listener = (uuid: string, kind: 'status' | 'line', value: string) => void;

/**
 * A teljes kepernyos ujrainditas motorja.
 *
 * Megnyitaskor minden erintett szerverhez websocketet nyit (elo konzol +
 * eroforrasok), a lanc pedig sorban, a POWER API-n kuldi a restartot:
 * eloszor a primary, es csak ha az sikeresen fent van, utana a backup.
 *
 * A siker forrasa a Wings allapota: az egg "done" jele a "Ready in", vagyis
 * 'running' = a Next.js tenyleg kiszolgal. Utana megvarjuk a start.sh
 * "bemelegítve" sorat - addigra a primary mar rogzitette a futo commitot,
 * amit a backup kovetni fog.
 */
export const useChain = (targets: ChainTarget[]) => {
    const targetsKey = targets.map((target) => target.server.uuid).join(',');

    const [live, setLive] = useState<Record<string, Live>>(() =>
        targets.reduce((acc, target) => ({ ...acc, [target.server.uuid]: emptyLive() }), {})
    );
    const [chain, setChain] = useState<ChainState>(() => ({
        running: false,
        steps: targets.map(makeStep),
        activeIndex: null,
        finishedAt: null,
        aborted: false,
    }));

    const liveRef = useRef(live);
    liveRef.current = live;
    const listeners = useRef(new Set<Listener>());
    const abortRef = useRef(false);
    const mounted = useRef(true);

    /* --------------------------------------------- kotegelt konzol-frissites */

    const pending = useRef<Record<string, ((prev: Live) => Live)[]>>({});
    const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flush = useCallback(() => {
        flushTimer.current = null;
        const queued = pending.current;
        pending.current = {};
        if (!mounted.current) return;

        setLive((prev) => {
            const next = { ...prev };
            Object.keys(queued).forEach((uuid) => {
                next[uuid] = queued[uuid].reduce((acc, fn) => fn(acc), next[uuid] || emptyLive());
            });
            return next;
        });
    }, []);

    const update = useCallback(
        (uuid: string, fn: (prev: Live) => Live) => {
            (pending.current[uuid] = pending.current[uuid] || []).push(fn);
            if (!flushTimer.current) flushTimer.current = setTimeout(flush, FLUSH_MS);
        },
        [flush]
    );

    const pushLine = (prev: Live, line: ConsoleLine): Live => ({
        ...prev,
        lines: prev.lines.length >= MAX_LINES ? [...prev.lines.slice(-MAX_LINES + 1), line] : [...prev.lines, line],
    });

    const onLine = useCallback(
        (uuid: string, raw: string) => {
            const verdict = classify(raw);
            const rule = verdict.rule;

            update(uuid, (prev) => {
                let next = pushLine(prev, { text: raw, level: verdict.level });

                if (rule) {
                    if (rule.milestone && next.reached.indexOf(rule.milestone) === -1) {
                        next = { ...next, reached: [...next.reached, rule.milestone] };
                    }
                    if (rule.activity) {
                        next = { ...next, activity: rule.activity, activityDetail: messageOf(verdict.clean) };
                    }
                    if (rule.buildSkipped) next = { ...next, buildSkipped: true };
                    if (rule.commit) next = { ...next, commit: messageOf(verdict.clean) };
                    if (rule.error) next = { ...next, lastError: messageOf(verdict.clean) };
                }

                return next;
            });

            listeners.current.forEach((listener) => listener(uuid, 'line', verdict.clean));
        },
        [update]
    );

    /** Az uj futas kezdete: elvalaszto a konzolba, a korabbi futas adatai torlodnek. */
    const beginRun = useCallback(
        (uuid: string, label: string) => {
            update(uuid, (prev) => ({
                ...pushLine(prev, { text: `${label} ${clock()}`, level: 'start', divider: true }),
                reached: [],
                activity: null,
                activityDetail: null,
                buildSkipped: false,
                lastError: null,
            }));
        },
        [update]
    );

    /* ----------------------------------------------------- websocketek */

    const sockets = useRef<Record<string, Websocket>>({});

    useEffect(() => {
        mounted.current = true;
        let disposed = false;

        targets.forEach(({ server }) => {
            const uuid = server.uuid;
            let historyRequested = false;

            const refresh = (socket: Websocket) =>
                getWebsocketToken(uuid)
                    .then(({ token }) => socket.setToken(token, true))
                    .catch(() => undefined);

            getWebsocketToken(uuid)
                .then(({ token, socket: url }) => {
                    if (disposed) return;

                    const socket = new Websocket();
                    sockets.current[uuid] = socket;

                    socket.on('auth success', () => {
                        update(uuid, (prev) => ({ ...prev, connected: true }));
                        // Az elozmenyt csak egyszer kerjuk, kulonben ujracsatlakozaskor duplazodna.
                        if (!historyRequested) {
                            historyRequested = true;
                            socket.send('send logs');
                        }
                        socket.send('send stats');
                    });

                    socket.on('SOCKET_CLOSE', () => update(uuid, (prev) => ({ ...prev, connected: false })));
                    socket.on('token expiring', () => refresh(socket));
                    socket.on('token expired', () => refresh(socket));

                    socket.on('status', (state: string) => {
                        update(uuid, (prev) => ({
                            ...prev,
                            stats: prev.stats
                                ? { ...prev.stats, state }
                                : { state, cpu: 0, memory: 0, memoryLimit: 0, uptime: 0 },
                        }));
                        listeners.current.forEach((listener) => listener(uuid, 'status', state));
                    });

                    socket.on('stats', (json: string) => {
                        try {
                            const data = JSON.parse(json);
                            update(uuid, (prev) => ({
                                ...prev,
                                stats: {
                                    state: data.state,
                                    cpu: data.cpu_absolute,
                                    memory: data.memory_bytes,
                                    memoryLimit: data.memory_limit_bytes,
                                    uptime: data.uptime,
                                },
                            }));
                        } catch (error) {
                            /* hibas stats csomag - a kovetkezo jo lesz */
                        }
                    });

                    socket.on('console output', (line: string) => onLine(uuid, line));
                    socket.on('daemon message', (line: string) => onLine(uuid, `[Wings] ${line}`));

                    socket.setToken(token).connect(url);
                })
                .catch(() => update(uuid, (prev) => ({ ...prev, connected: false, lastError: 'websocket' })));
        });

        return () => {
            disposed = true;
            mounted.current = false;
            abortRef.current = true;
            if (flushTimer.current) clearTimeout(flushTimer.current);
            Object.keys(sockets.current).forEach((uuid) => {
                try {
                    sockets.current[uuid].removeAllListeners();
                    sockets.current[uuid].close();
                } catch (error) {
                    /* a bontas hibaja mar nem erdekes */
                }
            });
            sockets.current = {};
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetsKey]);

    /* ---------------------------------------------------------- lanc */

    const patchStep = useCallback((index: number, partial: Partial<StepState>) => {
        if (!mounted.current) return;
        setChain((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) => (i === index ? { ...step, ...partial } : step)),
        }));
    }, []);

    const runStep = (index: number, labels: { restart: string }): Promise<boolean> =>
        new Promise((resolve) => {
            const uuid = targets[index].server.uuid;
            const startedAt = Date.now();
            let stage: 'sending' | 'awaitDown' | 'up' | 'warming' = 'sending';
            let sawStart = false;
            let settled = false;
            let warmSince = 0;

            const finish = (ok: boolean, kind: FailureKind | null = null) => {
                if (settled) return;
                settled = true;
                listeners.current.delete(listener);
                clearInterval(ticker);

                const detail = kind === 'crash' ? (liveRef.current[uuid] || emptyLive()).lastError : null;
                patchStep(index, {
                    phase: ok ? 'done' : 'failed',
                    finishedAt: Date.now(),
                    failureKind: kind,
                    failureDetail: detail,
                });
                resolve(ok);
            };

            const listener: Listener = (who, kind, value) => {
                if (who !== uuid || settled) return;

                if (kind === 'line') {
                    if (stage === 'warming' && /bemelegítve/.test(value)) finish(true);
                    return;
                }

                if (stage === 'awaitDown') {
                    if (value === 'stopping' || value === 'offline' || value === 'starting') {
                        stage = 'up';
                        beginRun(uuid, labels.restart);
                        sawStart = value === 'starting';
                        patchStep(index, { phase: sawStart ? 'starting' : 'stopping' });
                    }
                    return;
                }

                if (stage === 'up') {
                    if (value === 'starting') {
                        sawStart = true;
                        patchStep(index, { phase: 'starting' });
                    } else if (value === 'running' && sawStart) {
                        stage = 'warming';
                        warmSince = Date.now();
                        patchStep(index, { phase: 'warming' });
                    } else if (value === 'offline' && sawStart) {
                        // A start.sh kilepett (build hiba, HIBA: sor) - a szerver nem jott fel.
                        finish(false, 'crash');
                    }
                    return;
                }

                if (stage === 'warming' && value !== 'running') {
                    finish(false, 'crash');
                }
            };

            listeners.current.add(listener);
            patchStep(index, { phase: 'sending', startedAt, finishedAt: null, failureKind: null, failureDetail: null });

            const ticker = setInterval(() => {
                if (settled) return;
                const now = Date.now();

                if (abortRef.current) finish(false, 'aborted');
                else if (stage === 'awaitDown' && now - startedAt > ACK_TIMEOUT_MS) finish(false, 'api');
                else if (stage === 'warming' && now - warmSince > WARM_TIMEOUT_MS) finish(true);
                else if (now - startedAt > STEP_TIMEOUT_MS) finish(false, 'timeout');
            }, 1000);

            // Az allapotvaltast a websocket hozza - elobb az legyen elo, csak utana kuldjuk a restartot.
            const waitConnected = (tries: number): Promise<void> =>
                (liveRef.current[uuid] || emptyLive()).connected || tries <= 0
                    ? Promise.resolve()
                    : new Promise((r) => setTimeout(r, 500)).then(() => waitConnected(tries - 1));

            waitConnected(30)
                .then(() => {
                    if (settled) return;
                    stage = 'awaitDown';
                    return http.post(`/api/client/servers/${uuid}/power`, { signal: 'restart' });
                })
                .catch(() => finish(false, 'api'));
        });

    const start = useCallback(
        async (fromIndex: number, labels: { restart: string }) => {
            abortRef.current = false;

            setChain((prev) => ({
                ...prev,
                running: true,
                finishedAt: null,
                aborted: false,
                activeIndex: fromIndex,
                steps: prev.steps.map((step, i) =>
                    i >= fromIndex
                        ? { ...step, phase: 'pending', startedAt: null, finishedAt: null, failureKind: null, failureDetail: null }
                        : step
                ),
            }));

            for (let i = fromIndex; i < targets.length; i++) {
                if (!mounted.current) return;
                setChain((prev) => ({ ...prev, activeIndex: i }));

                const ok = await runStep(i, labels);

                if (!ok) {
                    // A primary nem jott fel -> a backuphoz hozza sem nyulunk: az viszi tovabb az oldalt.
                    if (!mounted.current) return;
                    setChain((prev) => ({
                        ...prev,
                        running: false,
                        activeIndex: null,
                        finishedAt: Date.now(),
                        aborted: abortRef.current,
                        steps: prev.steps.map((step, index) =>
                            index > i && step.phase === 'pending' ? { ...step, phase: 'skipped' } : step
                        ),
                    }));
                    return;
                }
            }

            if (mounted.current) {
                setChain((prev) => ({ ...prev, running: false, activeIndex: null, finishedAt: Date.now() }));
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [targetsKey]
    );

    const abort = useCallback(() => {
        abortRef.current = true;
    }, []);

    return { live, chain, start, abort };
};
