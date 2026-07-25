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
