import getFileContents from '@/api/server/files/getFileContents';
import saveFileContents from '@/api/server/files/saveFileContents';
import copyFile from '@/api/server/files/copyFile';
import deleteFiles from '@/api/server/files/deleteFiles';
import { Server } from '@/api/server/getServer';

export const PACKAGE_FILE = '/package.json';

export type FixReason = 'noPort' | 'unreadable' | 'unparseable' | 'write' | 'noScripts';

export type FixResult =
    | { ok: true; kind: 'patched'; port: number; command: string }
    | { ok: true; kind: 'deleted' }
    | { ok: false; reason: FixReason };

/**
 * A Pterodactyl altal kiosztott port. Az alapertelmezett allokaciot preferaljuk,
 * mert az alkalmazas jellemzoen azon figyel.
 */
export const resolvePort = (server: Server): number | null => {
    const allocations = server.allocations || [];
    const primary = allocations.find((allocation) => allocation.isDefault) || allocations[0];

    return primary ? primary.port : null;
};

/**
 * A package.json "start" scriptjenek javitasa a valodi porttal.
 *
 * SZANDEKOSAN nem irunk ujra egy olvashatatlan package.json-t nullarol: azzal
 * elveszne az osszes fuggoseg, es a szerver hasznalhatatlan lenne. Ha a fajl
 * nem parse-olhato, inkabb visszajelzunk.
 */
export const patchStartScript = async (server: Server, template: string): Promise<FixResult> => {
    const port = resolvePort(server);
    if (!port) {
        return { ok: false, reason: 'noPort' };
    }

    let raw: string;
    try {
        raw = await getFileContents(server.uuid, PACKAGE_FILE);
    } catch (error) {
        return { ok: false, reason: 'unreadable' };
    }

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { ok: false, reason: 'unparseable' };
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, reason: 'unparseable' };
    }

    const command = template.replace(/%PORT%/g, String(port));

    parsed.scripts = { ...(parsed.scripts || {}), start: command };

    try {
        // Biztonsagi masolat, mielott hozzanyulunk az eles fajlhoz.
        await copyFile(server.uuid, PACKAGE_FILE).catch(() => undefined);
        await saveFileContents(server.uuid, PACKAGE_FILE, JSON.stringify(parsed, null, 2) + '\n');
    } catch (error) {
        return { ok: false, reason: 'write' };
    }

    return { ok: true, kind: 'patched', port, command };
};

/**
 * A package.json torlese, hogy a kovetkezo git pull utkozes nelkul lefusson.
 *
 * Ez csak akkor biztonsagos, ha a repo TARTALMAZZA a package.json-t - kulonben a
 * pull nem allitja vissza, es a szerver indithatatlan marad. A felulet ezert
 * kulon figyelmeztet, es csak kifejezett megerositesre hivja meg.
 */
export const deletePackageJson = async (server: Server): Promise<FixResult> => {
    try {
        await copyFile(server.uuid, PACKAGE_FILE).catch(() => undefined);
        await deleteFiles(server.uuid, '/', ['package.json']);
    } catch (error) {
        return { ok: false, reason: 'write' };
    }

    return { ok: true, kind: 'deleted' };
};
