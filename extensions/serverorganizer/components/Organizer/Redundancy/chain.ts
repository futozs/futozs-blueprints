import { useCallback, useRef, useState } from 'react';
import getWebsocketToken from '@/api/server/getWebsocketToken';
import { Websocket } from '@/plugins/Websocket';
import { Server } from '@/api/server/getServer';
import { ChainConfig, ChainState, ConsoleLine, StepState } from './types';
import { classifyLine } from './patterns';

const MAX_LINES = 1000;

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
    stableFor: 0,
    elapsed: 0,
    lines: [],
    appReady: false,
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
 * Egyetlen szerver ujrainditasa, es varakozas arra, hogy tenyleg fusson.
 *
 * A nehezseg az, hogy a websocket a csatlakozas pillanataban azonnal kikuldi az
 * AKTUALIS allapotot - ami az ujrainditas elott meg 'running'. Ha ezt naivan
 * figyelnenk, a rakovetkezo 'stopping' esemenyt osszeomlasnak neznenk. Ezert
 * szakaszokban haladunk: eloszor megvarjuk hogy a szerver tenyleg lemenjen,
 * es csak az utana kovetkezo 'running' szamit.
 */
const runStep = (
    target: ChainTarget,
    config: ChainConfig,
    patch: (partial: Partial<StepState>) => void,
    appendLine: (line: ConsoleLine) => void,
    shouldAbort: () => boolean,
    registerSocket: (socket: Websocket) => void
): Promise<boolean> =>
    new Promise((resolve) => {
        let settled = false;
        let socket: Websocket | null = null;
        let stage: 'init' | 'awaitingDown' | 'awaitingUp' | 'up' = 'init';
        let status = '';
        let runningSince: number | null = null;
        let ticker: ReturnType<typeof setInterval> | null = null;
        const startedAt = Date.now();

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
            patch({ phase: 'done', stableFor: config.stabilitySeconds });
            resolve(true);
        };

        patch({ phase: 'connecting' });

        getWebsocketToken(target.server.uuid)
            .then(({ token, socket: url }) => {
                if (settled) return;

                socket = new Websocket();
                registerSocket(socket);

                socket.on('console output', (line: string) => {
                    const verdict = classifyLine(line);

                    appendLine({ text: line, level: verdict.level });

                    if (verdict.ready) {
                        patch({ appReady: true });
                    }

                    // Csak a FAILURE kategoria allitja meg a lancot. A NOTICE
                    // sorok (pl. "Cannot find module") csak kiemelve latszanak.
                    if (verdict.failure) {
                        fail(verdict.failure.kind, line.trim().slice(0, 400));
                    }
                });

                socket.on('status', (next: string) => {
                    status = next;

                    if (stage === 'init') {
                        // Meg el sem kuldtuk az ujrainditast: ez csak a kiindulasi allapot.
                        return;
                    }

                    if (stage === 'awaitingDown') {
                        if (next === 'stopping' || next === 'offline') {
                            stage = 'awaitingUp';
                            patch({ phase: 'stopping' });
                        } else if (next === 'starting') {
                            // Elofordul hogy a leallast le sem latjuk (gyors restart,
                            // vagy eleve allo szerver) - ez is az ujrainditas kezdete.
                            stage = 'awaitingUp';
                            patch({ phase: 'starting' });
                        }
                        return;
                    }

                    if (stage === 'awaitingUp') {
                        if (next === 'running') {
                            runningSince = Date.now();
                            stage = 'up';
                            patch({ phase: 'stabilising', stableFor: 0 });
                        } else {
                            patch({ phase: next === 'starting' ? 'starting' : 'stopping' });
                        }
                        return;
                    }

                    if (stage === 'up' && next !== 'running') {
                        // Mar futott, es megis lement -> ez osszeomlas.
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
                    const stable = runningSince ? Math.round((Date.now() - runningSince) / 1000) : 0;
                    patch({ elapsed, stableFor: stable });

                    if (elapsed >= config.timeoutSeconds) {
                        fail('timeout', null);
                        return;
                    }

                    if (stage === 'up' && status === 'running' && stable >= config.stabilitySeconds) {
                        succeed();
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
        [patchStep, appendLine]
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
