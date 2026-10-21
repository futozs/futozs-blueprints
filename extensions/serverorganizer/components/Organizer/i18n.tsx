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

    /* modals */
    group: 'Group',
    colour: 'Colour',
    icon: 'Icon',
    noColour: 'No colour',
    customColour: 'Custom colour',
    noIcon: 'No icon',
    iconSearch: 'Search icons (e.g. server, fire, crown)',
    noResults: 'No matches.',
    orCustomImage: 'Or your own image (URL)',
    imageUrlInvalid: 'The address must start with http:// or https://.',
    preview: 'Preview',
    cancel: 'Cancel',
    save: 'Save',
    name: 'Name',
    delete: 'Delete',
    language: 'Language',

    /* empty states */
    noOtherServers: 'There are no other servers to display.',
    noServers: 'There are no servers associated with your account.',

    /* redundancy chain */
    restart: 'Restart',
    edit: 'Edit',
    runningShort: 'running',
    uptime: 'UPTIME',
    startChain: 'Restart',
    abort: 'Abort',
    retry: 'Retry',
    close: 'Close',
    chainComplete: 'Both are up',
    singleComplete: 'Up and serving',
    warnNoBackup: 'No backup — the site is down during the restart',
    warnBackupDown: 'The backup is not running — the site goes down while the primary restarts',
    runPrimary: 'Primary restarting — the backup is serving',
    runBackup: 'Backup restarting — the primary is serving',
    dividerRestart: '⟲ restart',

    failAborted: 'Aborted',
    failTimeout: 'Did not come up within an hour',
    failCrash: 'Did not come up',
    failApi: 'Wings did not respond to the restart',

    phSending: 'Restarting…',
    phStopping: 'Stopping…',
    phStarting: 'Starting…',
    phWarming: 'Up — warming',
    phDone: 'Up',
    phFailed: 'Failed',
    phSkipped: 'Skipped',

    stConnecting: 'Connecting…',
    stRunning: 'Running',
    stStarting: 'Starting',
    stStopping: 'Stopping',
    stOffline: 'Offline',

    actError: 'Error',
    actUpdate: 'Code updated',
    actFollow: "On the primary's commit",
    actBun: 'Installing bun',
    actBuildNeeded: 'Build needed',
    actWaitPeer: 'Waiting for its peer',
    actWaitLock: 'Waiting: another build',
    actWaitMemory: 'Waiting for memory',
    actInstall: 'Installing packages',
    actPrisma: 'Prisma client',
    actMigrate: 'Migrating database',
    actFirstRun: 'First run',
    actBuild: 'Building…',
    actPages: 'Generating pages',
    actBuildDone: 'Build done',
    actBuildSkipped: 'No change — no build',
    actLaunch: 'Launching',
    actReady: 'Serving',
    actWarm: 'Warmed up',

    msUpdate: 'Update',
    msBuild: 'Build',
    msBuildSkipped: 'No build',
    msLaunch: 'Launch',
    msReady: 'Serving',
    msWarm: 'Warm',

    consoleWaiting: 'Waiting for console output…',
    jumpToBottom: 'Latest',
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

    /* modals */
    group: 'Csoport',
    colour: 'Szín',
    icon: 'Ikon',
    noColour: 'Nincs szín',
    customColour: 'Egyéni szín',
    noIcon: 'Nincs ikon',
    iconSearch: 'Ikon keresése (pl. server, fire, crown)',
    noResults: 'Nincs találat.',
    orCustomImage: 'Vagy saját kép (URL)',
    imageUrlInvalid: 'A címnek http:// vagy https:// előtaggal kell kezdődnie.',
    preview: 'Előnézet',
    cancel: 'Mégse',
    save: 'Mentés',
    name: 'Név',
    delete: 'Törlés',
    language: 'Nyelv',

    /* empty states */
    noOtherServers: 'Nincs megjeleníthető másik szerver.',
    noServers: 'Nincs a fiókodhoz tartozó szerver.',

    /* redundancy chain */
    restart: 'Újraindítás',
    edit: 'Szerkesztés',
    runningShort: 'fut',
    uptime: 'ÜZEMIDŐ',
    startChain: 'Újraindítás',
    abort: 'Megszakítás',
    retry: 'Újra',
    close: 'Bezárás',
    chainComplete: 'Mindkettő fut',
    singleComplete: 'Fut és kiszolgál',
    warnNoBackup: 'Nincs backup — az újraindítás alatt az oldal nem elérhető',
    warnBackupDown: 'A backup nem fut — a primary újraindítása alatt az oldal leáll',
    runPrimary: 'A primary indul újra — a backup szolgál ki',
    runBackup: 'A backup indul újra — a primary szolgál ki',
    dividerRestart: '⟲ újraindítás',

    failAborted: 'Megszakítva',
    failTimeout: 'Egy órán belül sem jött fel',
    failCrash: 'Nem jött fel',
    failApi: 'A Wings nem reagált az újraindításra',

    phSending: 'Újraindítás…',
    phStopping: 'Leáll…',
    phStarting: 'Indul…',
    phWarming: 'Fut — bemelegítés',
    phDone: 'Fut',
    phFailed: 'Hiba',
    phSkipped: 'Kihagyva',

    stConnecting: 'Kapcsolódás…',
    stRunning: 'Fut',
    stStarting: 'Indul',
    stStopping: 'Leáll',
    stOffline: 'Áll',

    actError: 'Hiba',
    actUpdate: 'Kód frissítve',
    actFollow: 'A primary commitján',
    actBun: 'bun telepítése',
    actBuildNeeded: 'Build kell',
    actWaitPeer: 'Vár a párjára',
    actWaitLock: 'Vár: másik build fut',
    actWaitMemory: 'Vár: kevés a memória',
    actInstall: 'Csomagok telepítése',
    actPrisma: 'Prisma kliens',
    actMigrate: 'Adatbázis migráció',
    actFirstRun: 'Első indítás',
    actBuild: 'Buildel…',
    actPages: 'Oldalak generálása',
    actBuildDone: 'Build kész',
    actBuildSkipped: 'Nincs változás — nincs build',
    actLaunch: 'Indul',
    actReady: 'Kiszolgál',
    actWarm: 'Bemelegítve',

    msUpdate: 'Frissítés',
    msBuild: 'Build',
    msBuildSkipped: 'Nincs build',
    msLaunch: 'Indítás',
    msReady: 'Kiszolgál',
    msWarm: 'Kész',

    consoleWaiting: 'Várakozás a konzolra…',
    jumpToBottom: 'Legújabb',
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
