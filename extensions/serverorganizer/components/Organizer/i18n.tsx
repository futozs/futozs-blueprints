import React, { createContext, useCallback, useContext } from 'react';

export type Lang = 'en' | 'hu';

export const LANGUAGES: { code: Lang; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hu', label: 'Magyar' },
];

const en = {
    /* toolbar */
    organise: 'Organise',
    done: 'Done',
    newGroup: 'New group',
    saving: 'saving...',
    saveFailed: 'Could not save your settings.',
    showingOthers: "Others' servers",
    showingOwn: 'Your servers',
    disableOrganiser: 'Turn organiser off',
    enableOrganiser: 'Turn organiser on',
    loadFailed: 'The organiser could not be loaded, so the default list is shown instead.',

    /* sort modes */
    sortManual: 'Custom order',
    sortName: 'By name',
    sortStatus: 'By status',
    sortRole: 'By role',

    /* groups */
    ungrouped: 'Ungrouped',
    editGroup: 'Edit group',
    dropServersHere: 'Drag servers here',
    emptyGroup: 'Empty group',
    untitledGroup: 'Untitled group',
    newGroupName: 'New group',

    /* server row */
    dragToReorder: 'Drag to reorder',
    serverSettings: 'Server settings',
    primaryServer: 'Primary server',
    backupServer: 'Backup server',

    /* modals */
    group: 'Group',
    role: 'Role',
    roleNone: 'None',
    rolePrimary: 'Primary',
    roleBackup: 'Backup',
    colour: 'Colour',
    icon: 'Icon',
    noColour: 'No colour',
    customColour: 'Custom colour',
    noIcon: 'No icon',
    iconSearch: 'Search icons (e.g. server, fire, crown)',
    noResults: 'No matches.',
    orCustomImage: 'Or your own image (URL)',
    imageUrlInvalid: 'The address must start with http:// or https://.',
    imageHelp:
        'An image overrides the icon. It is loaded from an external address — if that stops working, the icon is shown instead.',
    preview: 'Preview',
    cancel: 'Cancel',
    save: 'Save',
    name: 'Name',
    delete: 'Delete',
    groupDeleteHelp: 'Deleting a group does not delete its servers — they move back to “Ungrouped”.',
    language: 'Language',

    /* empty states */
    noOtherServers: 'There are no other servers to display.',
    noServers: 'There are no servers associated with your account.',

    /* redundancy chain */
    restartGroup: 'Restart chain',
    restartChain: 'Chain restart',
    chainExplainer: 'The backup restarts first. Only once it has come back up and stayed up does the primary follow — so the two are never down at the same time.',
    chainComplete: 'Both servers are back up.',
    chainNeedsRoles: 'Mark one server as primary and one as backup in this group first.',
    abort: 'Abort',
    retry: 'Retry',
    close: 'Close',
    elapsed: 'Elapsed',
    stabilityProgress: 'Staying up',
    appReported: 'app reported ready',

    phasePending: 'waiting',
    phaseConnecting: 'connecting',
    phaseSending: 'restarting',
    phaseStopping: 'shutting down',
    phaseStarting: 'starting',
    phaseStabilising: 'checking stability',
    phaseDone: 'done',
    phaseFailed: 'failed',
    phaseSkipped: 'skipped',

    failTimeout: 'Timed out — the server did not come back up in time.',
    failCrash: 'The server went down again after starting.',
    failPull: 'The git pull failed.',
    failPackage: 'There is a problem with package.json.',
    failPort: 'The port is already in use.',
    failAborted: 'Aborted.',
    failApi: 'Could not reach the server console.',

    fixPort: 'Fix port in package.json',
    fixNoPort: 'No allocated port found',
    fixApplied: 'Start script updated',
    deletePackage: 'Delete package.json',
    deletePackageConfirm: 'Click again to confirm',
    deletePackageWarning: 'Only do this if package.json is committed in your repository — otherwise the next pull will not restore it and the server will not start. A copy is kept beside it.',
    fixDeleted: 'package.json deleted — restart to let the pull restore it.',
    fixError_noPort: 'No allocated port found for this server.',
    fixError_unreadable: 'package.json could not be read.',
    fixError_unparseable: 'package.json is not valid JSON, so it was left untouched — rewriting it would destroy your dependency list.',
    fixError_write: 'The file could not be written.',
    fixError_noScripts: 'package.json has no scripts section.',

    startChain: 'Start restart chain',
    planTitle: 'What will happen, in order:',
    stabilityLabel: 'Must stay up for (seconds)',
    timeoutLabel: 'Give up after (seconds)',
    startScriptLabel: 'Start script used when fixing package.json',
    startScriptHelp: '%PORT% is replaced with the port Pterodactyl allocated to that server — you never type it yourself.',

    consoleWaiting: 'Waiting for console output...',
    jumpToBottom: 'Jump to latest',
};

const hu: typeof en = {
    /* toolbar */
    organise: 'Rendezés',
    done: 'Kész',
    newGroup: 'Új csoport',
    saving: 'mentés...',
    saveFailed: 'A beállításokat nem sikerült menteni.',
    showingOthers: 'Mások szerverei',
    showingOwn: 'Saját szerverek',
    disableOrganiser: 'Szervező kikapcsolása',
    enableOrganiser: 'Szervező bekapcsolása',
    loadFailed: 'A szervezőt nem sikerült betölteni, ezért az alapértelmezett lista látható.',

    /* sort modes */
    sortManual: 'Saját sorrend',
    sortName: 'Név szerint',
    sortStatus: 'Állapot szerint',
    sortRole: 'Szerep szerint',

    /* groups */
    ungrouped: 'Csoport nélkül',
    editGroup: 'Csoport szerkesztése',
    dropServersHere: 'Húzz ide szervereket',
    emptyGroup: 'Üres csoport',
    untitledGroup: 'Névtelen csoport',
    newGroupName: 'Új csoport',

    /* server row */
    dragToReorder: 'Húzd át a sorrend változtatásához',
    serverSettings: 'Szerver beállításai',
    primaryServer: 'Elsődleges szerver',
    backupServer: 'Backup szerver',

    /* modals */
    group: 'Csoport',
    role: 'Szerep',
    roleNone: 'Nincs',
    rolePrimary: 'Elsődleges',
    roleBackup: 'Backup',
    colour: 'Szín',
    icon: 'Ikon',
    noColour: 'Nincs szín',
    customColour: 'Egyéni szín',
    noIcon: 'Nincs ikon',
    iconSearch: 'Ikon keresése (pl. server, fire, crown)',
    noResults: 'Nincs találat.',
    orCustomImage: 'Vagy saját kép (URL)',
    imageUrlInvalid: 'A címnek http:// vagy https:// előtaggal kell kezdődnie.',
    imageHelp:
        'A kép felülírja az ikont. Egy külső címről töltődik — ha az megszűnik, automatikusan visszavált az ikonra.',
    preview: 'Előnézet',
    cancel: 'Mégse',
    save: 'Mentés',
    name: 'Név',
    delete: 'Törlés',
    groupDeleteHelp: 'A csoport törlése nem törli a szervereket — azok a „Csoport nélkül” részbe kerülnek vissza.',
    language: 'Nyelv',

    /* empty states */
    noOtherServers: 'Nincs megjeleníthető másik szerver.',
    noServers: 'Nincs a fiókodhoz tartozó szerver.',

    /* redundancy chain */
    restartGroup: 'Lánc újraindítás',
    restartChain: 'Láncolt újraindítás',
    chainExplainer: 'Először a backup indul újra. A primary csak akkor követi, ha a backup visszajött és stabilan fut — így sosem áll le egyszerre a kettő.',
    chainComplete: 'Mindkét szerver fut.',
    chainNeedsRoles: 'Előbb jelölj ki egy elsődleges és egy backup szervert ebben a csoportban.',
    abort: 'Megszakítás',
    retry: 'Újra',
    close: 'Bezárás',
    elapsed: 'Eltelt',
    stabilityProgress: 'Folyamatosan fut',
    appReported: 'az app jelezte hogy kész',

    phasePending: 'várakozik',
    phaseConnecting: 'csatlakozás',
    phaseSending: 'újraindítás',
    phaseStopping: 'leáll',
    phaseStarting: 'indul',
    phaseStabilising: 'stabilitás ellenőrzése',
    phaseDone: 'kész',
    phaseFailed: 'hiba',
    phaseSkipped: 'kihagyva',

    failTimeout: 'Időtúllépés — a szerver nem jött vissza időben.',
    failCrash: 'A szerver az indulás után újra leállt.',
    failPull: 'A git pull nem sikerült.',
    failPackage: 'Baj van a package.json fájllal.',
    failPort: 'A port már foglalt.',
    failAborted: 'Megszakítva.',
    failApi: 'Nem sikerült elérni a szerver konzolját.',

    fixPort: 'Port javítása a package.json-ban',
    fixNoPort: 'Nincs kiosztott port',
    fixApplied: 'A start script frissítve',
    deletePackage: 'package.json törlése',
    deletePackageConfirm: 'Kattints újra a megerősítéshez',
    deletePackageWarning: 'Csak akkor csináld, ha a package.json benne van a repódban — különben a következő pull nem hozza vissza, és a szerver nem indul el. Egy másolat mellette marad.',
    fixDeleted: 'package.json törölve — indítsd újra, hogy a pull visszahozza.',
    fixError_noPort: 'Ehhez a szerverhez nincs kiosztott port.',
    fixError_unreadable: 'A package.json nem olvasható.',
    fixError_unparseable: 'A package.json nem érvényes JSON, ezért nem nyúltunk hozzá — újraírásával elveszne a függőséglistád.',
    fixError_write: 'A fájlt nem sikerült írni.',
    fixError_noScripts: 'A package.json-ban nincs scripts szekció.',

    startChain: 'Lánc indítása',
    planTitle: 'Ez fog történni, ebben a sorrendben:',
    stabilityLabel: 'Ennyi másodpercig kell futnia',
    timeoutLabel: 'Ennyi másodperc után feladjuk',
    startScriptLabel: 'Start script a package.json javításához',
    startScriptHelp: 'A %PORT% helyére a Pterodactyl által kiosztott port kerül — neked sosem kell begépelned.',

    consoleWaiting: 'Várakozás a konzol kimenetére...',
    jumpToBottom: 'Ugrás a legaljára',
};

export const STRINGS: Record<Lang, typeof en> = { en, hu };

export type StringKey = keyof typeof en;

/**
 * Ha a felhasznalo nem valasztott nyelvet, a bongeszo beallitasabol talaljuk ki.
 */
export const detectLang = (): Lang => {
    const preferred = (typeof navigator !== 'undefined' && navigator.language) || 'en';

    return preferred.toLowerCase().startsWith('hu') ? 'hu' : 'en';
};

const LangContext = createContext<Lang>('en');

export const LangProvider = LangContext.Provider;

export const useT = () => {
    const lang = useContext(LangContext);

    return useCallback((key: StringKey): string => STRINGS[lang][key] || STRINGS.en[key] || key, [lang]);
};

export const useLang = (): Lang => useContext(LangContext);
