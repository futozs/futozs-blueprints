/*
 * Az 1.x-es adatbazis-addon funkcioi a 2.x-es Databases oldalon:
 * meret, import (SQL fajlbol vagy tavoli MySQL/MariaDB-bol), export es urites.
 * A vegpontok: /api/client/servers/{uuid}/extensions/databasetools/...
 */
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eraser, FileDown, FileUp } from 'lucide-react';
import {
    Button,
    Dialog,
    Input,
    Label,
    RowActionButton,
    SpinnerOverlay,
    Switch,
    http,
    httpErrorToHuman,
    toast,
    useCurrentServerUuid,
} from '@pterodactyl/sdk';
import type { ViewModel } from '@pterodactyl/sdk';

type ServerDatabaseItem = ViewModel<'server.databases'>['databases'][number];

const base = (uuid: string) => `/api/client/servers/${uuid}/extensions/databasetools`;

const fail = (error: unknown) => toast.error(httpErrorToHuman(error));

/** Az adatbazisok merete { <id>: "12.5 MB" } alakban; 30 masodpercenkent frissul. */
export function useDatabaseSizes(enabled: boolean): Record<string, string> {
    const uuid = useCurrentServerUuid() ?? '';
    const { data } = useQuery({
        queryKey: ['databasetools', uuid, 'sizes'],
        queryFn: async () => (await http.get(`${base(uuid)}/sizes`)).data.data as Record<string, string>,
        enabled: enabled && !!uuid,
        refetchInterval: 30_000,
    });

    return data ?? {};
}

const panelBox = 'mt-4 rounded border p-4';

function ImportDialog({ database, open, onClose }: { database: ServerDatabaseItem; open: boolean; onClose: () => void }) {
    const uuid = useCurrentServerUuid() ?? '';
    const fileInput = useRef<HTMLInputElement>(null);
    const [truncate, setTruncate] = useState(false);
    const [remote, setRemote] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ host: '', port: '3306', database: '', username: '', password: '' });

    const close = () => {
        if (busy) return;
        setTruncate(false);
        setRemote(false);
        setForm({ host: '', port: '3306', database: '', username: '', password: '' });
        onClose();
    };

    const run = async (request: () => Promise<unknown>, message: string) => {
        setBusy(true);
        try {
            await request();
            toast.success(message);
            setBusy(false);
            close();
        } catch (error) {
            setBusy(false);
            fail(error);
        }
    };

    const importFile = (file: File) => {
        const data = new FormData();
        data.append('database_file', file);
        data.append('truncate', truncate ? '1' : '0');

        void run(
            () => http.post(`${base(uuid)}/${database.id}/import`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
            'Database has been successfully imported.'
        );
    };

    const importRemote = () =>
        void run(
            () => http.post(`${base(uuid)}/${database.id}/import-remote`, { ...form, truncate: truncate ? '1' : '0' }),
            'Database has been successfully imported from remote source.'
        );

    const field = (key: keyof typeof form, label: string, placeholder: string, type = 'text') => (
        <div>
            <Label htmlFor={`dbt_${key}`}>{label}</Label>
            <Input
                id={`dbt_${key}`}
                type={type}
                value={form[key]}
                placeholder={placeholder}
                onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
            />
        </div>
    );

    const remoteReady = Object.values(form).every((value) => value.trim() !== '');

    return (
        <Dialog open={open} title='Import Database' preventExternalClose={busy} hideCloseIcon={busy} onClose={close}>
            <SpinnerOverlay visible={busy} />
            <p className='text-sm'>
                Import into <strong>{database.name}</strong>.
            </p>
            <div className={panelBox}>
                <Switch
                    checked={truncate}
                    onChange={setTruncate}
                    label='Delete all tables and data'
                    description="Helps if you're experiencing import errors due to existing data."
                />
            </div>
            <div className={panelBox}>
                <Switch
                    checked={remote}
                    onChange={setRemote}
                    label='Remote Import'
                    description='Import from a remote MySQL/MariaDB database.'
                />
            </div>
            {remote && (
                <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    {field('host', 'Host', '127.0.0.1')}
                    {field('port', 'Port', '3306')}
                    {field('database', 'Database', 'database_name')}
                    {field('username', 'Username', 'database_user')}
                    <div className='sm:col-span-2'>{field('password', 'Password', '••••••••', 'password')}</div>
                </div>
            )}
            <input
                ref={fileInput}
                type='file'
                accept='.sql'
                hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) importFile(file);
                }}
            />
            <div className='mt-6 flex justify-end gap-2'>
                <Button type='button' isSecondary onClick={close} disabled={busy}>
                    Cancel
                </Button>
                {remote ? (
                    <Button type='button' onClick={importRemote} disabled={busy || !remoteReady}>
                        Import from Remote
                    </Button>
                ) : (
                    <Button type='button' onClick={() => fileInput.current?.click()} disabled={busy}>
                        Select File
                    </Button>
                )}
            </div>
        </Dialog>
    );
}

function ClearDialog({ database, open, onClose }: { database: ServerDatabaseItem; open: boolean; onClose: () => void }) {
    const uuid = useCurrentServerUuid() ?? '';
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const matches = confirm === database.name || confirm === database.shortName;

    const close = () => {
        if (busy) return;
        setConfirm('');
        onClose();
    };

    const clear = async () => {
        setBusy(true);
        try {
            await http.post(`${base(uuid)}/${database.id}/clear`);
            toast.success('Database has been successfully cleared.');
            setBusy(false);
            close();
        } catch (error) {
            setBusy(false);
            fail(error);
        }
    };

    return (
        <Dialog open={open} title='Confirm database clearing' preventExternalClose={busy} hideCloseIcon={busy} onClose={close}>
            <SpinnerOverlay visible={busy} />
            <p className='text-sm'>
                Clearing a database will remove all tables and data. This action cannot be undone. All data in the{' '}
                <strong>{database.name}</strong> database will be permanently deleted.
            </p>
            <div className='mt-6'>
                <Label htmlFor='dbt_confirm_clear'>Confirm Database Name</Label>
                <Input id='dbt_confirm_clear' type='text' value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                <p className='mt-1 text-xs text-muted-foreground'>Enter the database name to confirm clearing.</p>
            </div>
            <div className='mt-6 flex justify-end gap-2'>
                <Button type='button' isSecondary onClick={close} disabled={busy}>
                    Cancel
                </Button>
                <Button type='button' color='red' onClick={() => void clear()} disabled={busy || !matches}>
                    Clear Database
                </Button>
            </div>
        </Dialog>
    );
}

/** Import / Export / Uritese gombok egy adatbazis soraban. */
export function DatabaseTools({ database }: { database: ServerDatabaseItem }) {
    const uuid = useCurrentServerUuid() ?? '';
    const [importing, setImporting] = useState(false);
    const [clearing, setClearing] = useState(false);

    return (
        <>
            <RowActionButton
                icon={FileUp}
                label='Import database from SQL file'
                aria-label={`Import into ${database.name}`}
                onClick={() => setImporting(true)}
            />
            <RowActionButton
                icon={FileDown}
                label='Export database to SQL file'
                aria-label={`Export ${database.name}`}
                onClick={() => {
                    window.location.href = `${base(uuid)}/${database.id}/export`;
                }}
            />
            <RowActionButton
                icon={Eraser}
                label='Clear database'
                aria-label={`Clear ${database.name}`}
                danger
                onClick={() => setClearing(true)}
            />
            <ImportDialog database={database} open={importing} onClose={() => setImporting(false)} />
            <ClearDialog database={database} open={clearing} onClose={() => setClearing(false)} />
        </>
    );
}
