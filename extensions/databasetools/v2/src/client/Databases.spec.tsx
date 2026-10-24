import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, type ViewModel, type ViewProps } from '@pterodactyl/sdk';
import { createExtensionTestHost, createTestServer, type ExtensionTestHost } from '@pterodactyl/sdk/testing';
import Databases from './Databases';

type Model = ViewModel<'server.databases'>;

let host: ExtensionTestHost | undefined;

afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
});

const resolved = async () => {};

const model = (viewPassword: boolean): Model =>
    ({
        databases: [
            {
                id: 'abc123',
                name: 's1_survival',
                shortName: 'survival',
                endpoint: '127.0.0.1:3306',
                connectionsFrom: '%',
                username: 'u1_x',
                password: viewPassword ? 'secret' : null,
                jdbc: 'jdbc:mysql://127.0.0.1:3306/s1_survival',
            },
        ],
        loading: false,
        limit: 3,
        permissions: { create: true, update: true, delete: true, viewPassword },
        canCreate: true,
        rotating: [],
        validate: { name: () => undefined, connectionsFrom: () => undefined },
        actions: { create: resolved, rotatePassword: resolved, remove: resolved },
    }) as unknown as Model;

const mount = (viewPassword: boolean) => {
    const server = createTestServer();
    host = createExtensionTestHost({ extensionId: 'databasetools', server });
    render(<Databases {...({ model: model(viewPassword) } as unknown as ViewProps<'server.databases'>)} />, {
        wrapper: host.Wrapper,
    });

    return server.attributes.uuid;
};

it('megmutatja a meretet es az import / export / urites gombokat', async () => {
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: { data: { abc123: '12.5 MB' } } } as never);
    const uuid = mount(true);

    expect(await screen.findByText('12.5 MB')).toBeTruthy();
    expect(get).toHaveBeenCalledWith(`/api/client/servers/${uuid}/extensions/databasetools/sizes`);
    expect(screen.getByLabelText('Import into s1_survival')).toBeTruthy();
    expect(screen.getByLabelText('Export s1_survival')).toBeTruthy();
    expect(screen.getByLabelText('Clear s1_survival')).toBeTruthy();
});

it('az urites csak a nev begepelese utan indul, es a megfelelo vegpontot hivja', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { data: {} } } as never);
    const post = vi.spyOn(http, 'post').mockResolvedValue({ data: { success: true } } as never);
    const uuid = mount(true);

    fireEvent.click(await screen.findByLabelText('Clear s1_survival'));
    const button = (await screen.findByText('Clear Database')).closest('button')!;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Confirm Database Name'), { target: { value: 'survival' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(post).toHaveBeenCalledWith(`/api/client/servers/${uuid}/extensions/databasetools/abc123/clear`));
});

it('jelszo-jogosultsag nelkul nincsenek eszkozok es meret-lekeres sem', () => {
    const get = vi.spyOn(http, 'get');
    mount(false);

    expect(screen.queryByLabelText('Import into s1_survival')).toBeNull();
    expect(get).not.toHaveBeenCalled();
});
