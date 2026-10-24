import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, type ViewProps } from '@pterodactyl/sdk';
import { createExtensionTestHost, type ExtensionTestHost } from '@pterodactyl/sdk/testing';
import ServerList from './ServerList';

const variable = (env: string, value: string) => ({
    object: 'egg_variable',
    attributes: { name: env, description: '', env_variable: env, default_value: '', server_value: value, is_editable: true, rules: 'nullable|string' },
});

const server = (uuid: string, name: string, role: string) => ({
    object: 'server',
    attributes: {
        identifier: uuid.slice(0, 8),
        internal_id: 1,
        uuid,
        name,
        status: null,
        is_transferring: false,
        invocation: `ROLE=${role} bash .ptero/start.sh`,
        limits: { memory: 4096, swap: -1, disk: 0, io: 500, cpu: 0, threads: null },
        relationships: {
            allocations: { object: 'list', data: [{ object: 'allocation', attributes: { id: 1, ip: '172.18.0.1', ip_alias: null, port: 3000, notes: null, is_default: true } }] },
            variables: { object: 'list', data: [variable('ROLE', role), variable('GIT_ADDRESS', 'https://github.com/futozs/racehub.hu'), variable('BRANCH', 'main')] },
        },
    },
});

let host: ExtensionTestHost | undefined;

afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
});

it('a szervezo felulirja a szerverlistat, es a primary/backup part egy kartyan mutatja', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (url: string) => {
        if (url === '/api/client/extensions/serverorganizer/prefs') return { data: { data: null } } as never;
        if (url === '/api/client') {
            return {
                data: {
                    data: [server('aaaaaaaa-0000', 'racehub primary', 'primary'), server('bbbbbbbb-0000', 'racehub backup', 'backup')],
                    meta: { pagination: { current_page: 1, total_pages: 1 } },
                },
            } as never;
        }
        if (url.endsWith('/resources')) {
            return { data: { attributes: { current_state: 'running', is_suspended: false, resources: { memory_bytes: 1, cpu_absolute: 1, disk_bytes: 1, network_rx_bytes: 0, network_tx_bytes: 0, uptime: 1 } } } } as never;
        }
        throw new Error('unexpected ' + url);
    });

    host = createExtensionTestHost({ extensionId: 'serverorganizer' });
    const Default = () => <p>NATIVE LIST</p>;
    render(<ServerList {...({ model: {}, Default } as unknown as ViewProps<'dashboard.serverList'>)} />, { wrapper: host.Wrapper });

    // A par cime a repo neve; a ket tag egy kartyan.
    expect(await screen.findByText('racehub.hu')).toBeTruthy();
    expect(screen.getByText('racehub primary')).toBeTruthy();
    expect(screen.getByText('racehub backup')).toBeTruthy();

    // A panel sajat listajat (Default) a szervezo elrejti.
    await waitFor(() => expect(screen.queryByText('NATIVE LIST')).toBeNull());
});

const mountWith = (prefs: unknown, fail = false) => {
    vi.spyOn(http, 'get').mockImplementation(async (url: string) => {
        if (fail) throw new Error('network');
        if (url === '/api/client/extensions/serverorganizer/prefs') return { data: { data: prefs } } as never;
        return { data: { data: [], meta: { pagination: { current_page: 1, total_pages: 1 } } } } as never;
    });

    host = createExtensionTestHost({ extensionId: 'serverorganizer' });
    const Default = () => <p>NATIVE LIST</p>;
    render(<ServerList {...({ model: {}, Default } as unknown as ViewProps<'dashboard.serverList'>)} />, { wrapper: host.Wrapper });
};

it('kikapcsolt szervezonel a panel sajat listaja latszik', async () => {
    mountWith({ version: 2, enabled: false, sortMode: 'manual', language: 'hu', groups: [], servers: {} });

    expect(await screen.findByText('NATIVE LIST')).toBeTruthy();
});

it('ha a betoltes hibara fut, visszajon a panel sajat listaja', async () => {
    mountWith(null, true);

    expect(await screen.findByText('NATIVE LIST')).toBeTruthy();
});
