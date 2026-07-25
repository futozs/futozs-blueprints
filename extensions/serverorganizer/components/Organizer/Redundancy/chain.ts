import { useCallback, useRef, useState } from 'react';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { Websocket } from '@/plugins/Websocket';
import { Server } from '@/api/server/getServer';
import { ChainConfig, ChainState, ConsoleLine, StepState } from './types';
import { classifyLine, compileReadyPattern } from './patterns';

const MAX_LINES = 2000;

export interface ChainTarget {
    server: Server;
    role: 'primary' | 'backup';
}

const makeStep = (target: ChainTarget): StepState => ({
    uuid: target.server.uuid,
    identifier: target.server.id,
    name: target.server.name,
    role: target.role,
    phase: 'pending',
    elapsed: 0,
    lines: [],
    progress: [],
    failureKind: null,
    failureDetail: null,
});

const EMPTY: ChainState = {
    running: false,
    startedAt: null,
    steps: [],
    activeIndex: null,
    finishedAt: null,
    aborted: false,
};

/**
 * Egyetlen szerver ujrainditasa, es varakozas arra, hogy tenylegesen keszen
 * alljon.
 *
 * A siker feltetele NEM ido, hanem az alkalmazas sajat visszajelzese: a
 * konzolon megjelenik a "kesz vagyok" sor (Next.js eseten "Ready in ...").
 * Egy build percekig is tarthat - nincs ertelme masodperceket tippelni.
 *
 * Ket csapdat kell kikerulni:
 *
 *  1. A Wings a csatlakozaskor visszakuldi a KORABBI konzol-elozmenyt. Ha abban
 *     benne van egy regi "Ready in", azonnal - es hamisan - sikert jeleznenk.
 *     Ezert a kesz-jelzest csak azutan fogadjuk el, hogy a szervert lattuk
 *     lemenni vagy elindulni.
 *
 *  2. A csatlakozas pillanataban az allapot meg 'running' (hiszen meg el sem
 *     kuldtuk az ujrainditast). Ezert szakaszokban haladunk.
 */
const runStep = (
    target: ChainTarget,
    config: ChainConfig,
    patch: (partial: Partial<StepState>) => void,
    appendLine: (line: ConsoleLine) => void,
    markProgress: (key: string) => void,
    clearOutput: () => void,
    shouldAbort: () => boolean,
    registerSocket: (socket: Websocket) => void
): Promise<boolean> =>
    new Promise((resolve) => {
        let settled = false;
        let socket: Websocket | null = null;
        let stage: 'init' | 'awaitingDown' | 'awaitingUp' | 'up' = 'init';
        let ticker: ReturnType<typeof setInterval> | null = null;
        const startedAt = Date.now();
        const readyPattern = compileReadyPattern(config.readyPattern);

        const cleanup = () => {
            if (ticker) clearInterval(ticker);
            if (socket) {
                try {
                    socket.removeAllListeners();
                    socket.close();
                } catch (error) {
                    /* a bontas hibaja mar nem erdekes */
                }
            }
        };

        const fail = (kind: StepState['failureKind'], detail: string | null) => {
            if (settled) return;
            settled = true;
            cleanup();
            patch({ phase: 'failed', failureKind: kind, failureDetail: detail });
            resolve(false);
        };

        const succeed = () => {
            if (settled) return;
            settled = true;
            cleanup();
            patch({ phase: 'done' });
            resolve(true);
        };

        /** Az ujrainditas utani szakasz - innentol erdekes barmi, amit latunk. */
        const isFresh = () => stage === 'awaitingUp' || stage === 'up';

        patch({ phase: 'connecting' });

        getWebsocketToken(target.server.uuid)
            .then(({ token, socket: url }) => {
                if (settled) return;

                socket = new Websocket();
                registerSocket(socket);

                socket.on('console output', (line: string) => {
                    // A regi elozmenyt eldobjuk: az meg az elozo futashoz tartozik.
                    if (stage === 'init') return;

                    const verdict = classifyLine(line, readyPattern);

                    appendLine({ text: line, level: verdict.level });

                    if (!isFresh()) return;

                    if (verdict.progressKey) {
                        markProgress(verdict.progressKey);
                    }

                    if (verdict.failure) {
                        fail(verdict.failure.kind, line.trim().slice(0, 400));
                        return;
                    }

                    if (verdict.ready) {
                        // Ez az egyetlen sikerfeltetel: az app kiirta hogy kesz.
                        succeed();
                    }
                });

                socket.on('status', (next: string) => {
                    if (stage === 'init') {
                        // Meg el sem kuldtuk az ujrainditast: ez a kiindulasi allapot.
                        return;
                    }

                    if (stage === 'awaitingDown') {
                        if (next === 'stopping' || next === 'offline' || next === 'starting') {
                            stage = 'awaitingUp';
                            // Innentol a kimenet mar az uj futashoz tartozik.
                            clearOutput();
                            patch({ phase: next === 'starting' ? 'starting' : 'stopping' });
                        }
                        return;
                    }

                    if (stage === 'awaitingUp') {
                        if (next === 'running') {
                            stage = 'up';
                            patch({ phase: 'starting' });
                        } else if (next === 'starting') {
                            patch({ phase: 'starting' });
                        }
                        return;
                    }

                    if (stage === 'up' && next !== 'running') {
                        // Mar futott, es megis lement - a build vagy az app elszallt.
                        fail('crash', next);
                    }
                });

                socket.on('daemon error', (message: string) => fail('api', String(message)));
                socket.on('SOCKET_CONNECT_ERROR', () => fail('api', 'websocket'));

                socket.on('auth success', () => {
                    if (settled || stage !== 'init') return;

                    stage = 'awaitingDown';
                    patch({ phase: 'sending' });
                    // Ugyanaz a csatorna, amit a panel sajat power gombjai hasznalnak.
                    socket?.send('set state', 'restart');
                });

                socket.setToken(token).connect(url);

                ticker = setInterval(() => {
                    if (settled) return;

                    if (shouldAbort()) {
                        fail('aborted', null);
                        return;
                    }

                    const elapsed = Math.round((Date.now() - startedAt) / 1000);
                    patch({ elapsed });

                    if (elapsed >= config.timeoutSeconds) {
                        fail('timeout', null);
                    }
                }, 1000);
            })
            .catch(() => fail('api', 'token'));
    });

export const useRestartChain = () => {
    const [state, setState] = useState<ChainState>(EMPTY);
    const abortRef = useRef(false);
    const socketsRef = useRef<Websocket[]>([]);

    const patchStep = useCallback((index: number, partial: Partial<StepState>) => {
        setState((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) => (i === index ? { ...step, ...partial } : step)),
        }));
    }, []);

    const appendLine = useCallback((index: number, line: ConsoleLine) => {
        setState((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) =>
                i === index ? { ...step, lines: [...step.lines, line].slice(-MAX_LINES) } : step
            ),
        }));
    }, []);

    const markProgress = useCallback((index: number, key: string) => {
        setState((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) =>
                i === index && step.progress.indexOf(key) === -1
                    ? { ...step, progress: [...step.progress, key] }
                    : step
            ),
        }));
    }, []);

    const clearOutput = useCallback((index: number) => {
        setState((prev) => ({
            ...prev,
            steps: prev.steps.map((step, i) => (i === index ? { ...step, lines: [], progress: [] } : step)),
        }));
    }, []);

    const start = useCallback(
        async (targets: ChainTarget[], config: ChainConfig) => {
            abortRef.current = false;
            socketsRef.current = [];

            setState({
                running: true,
                startedAt: Date.now(),
                steps: targets.map(makeStep),
                activeIndex: 0,
                finishedAt: null,
                aborted: false,
            });

            for (let i = 0; i < targets.length; i++) {
                setState((prev) => ({ ...prev, activeIndex: i }));

                const ok = await runStep(
                    targets[i],
                    config,
                    (partial) => patchStep(i, partial),
                    (line) => appendLine(i, line),
                    (key) => markProgress(i, key),
                    () => clearOutput(i),
                    () => abortRef.current,
                    (socket) => socketsRef.current.push(socket)
                );

                if (!ok) {
                    // A tobbi lepes el sem indul: ha a backup nem jott vissza, a
                    // primaryhoz hozza sem nyulunk.
                    setState((prev) => ({
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

            setState((prev) => ({ ...prev, running: false, activeIndex: null, finishedAt: Date.now() }));
        },
        [patchStep, appendLine, markProgress, clearOutput]
    );

    const abort = useCallback(() => {
        abortRef.current = true;
    }, []);

    const reset = useCallback(() => {
        abortRef.current = true;
        socketsRef.current.forEach((socket) => {
            try {
                socket.removeAllListeners();
                socket.close();
            } catch (error) {
                /* nem erdekes */
            }
        });
        socketsRef.current = [];
        setState(EMPTY);
    }, []);

    return { state, start, abort, reset };
};
