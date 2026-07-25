import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faServer, faGamepad, faDatabase, faGlobe, faCube, faCubes, faRocket, faShieldAlt,
    faBolt, faFire, faStar, faHeart, faFlask, faCog, faCogs, faTerminal,
    faCloud, faHdd, faMicrochip, faMemory, faNetworkWired, faSitemap, faLayerGroup, faBox,
    faBoxOpen, faArchive, faFolder, faFlag, faBookmark, faTag, faTags, faTrophy,
    faCrown, faGem, faKey, faLock, faUsers, faUser, faUserShield, faRobot,
    faGhost, faDragon, faSkull, faDice, faChess, faPuzzlePiece, faMusic, faVideo,
    faCamera, faMicrophone, faHeadphones, faComments, faEnvelope, faBell, faClock, faCalendar,
    faChartLine, faChartBar, faCode, faBug, faWrench, faTools, faLifeRing, faSatelliteDish,
    faTree, faLeaf, faWater, faMountain, faSun, faMoon, faSnowflake, faTruck,
    faPlane, faShip, faCar, faHome, faBuilding, faIndustry, faStore, faShoppingCart,
    faCoins, faDollarSign, faCopy, faSync, faCircle, faSquare, faCheck,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Valogatott ikonkeszlet. Szandekosan nem a teljes FontAwesome csomagot importaljuk,
 * mert az feleslegesen novelne a bundle meretet - ezek egyenkent fa-shakelhetok.
 * A kulcs kerul az adatbazisba (par bajt), nem maga az ikon.
 */
export const ICONS: Record<string, IconDefinition> = {
    server: faServer, gamepad: faGamepad, database: faDatabase, globe: faGlobe,
    cube: faCube, cubes: faCubes, rocket: faRocket, shield: faShieldAlt,
    bolt: faBolt, fire: faFire, star: faStar, heart: faHeart,
    flask: faFlask, cog: faCog, cogs: faCogs, terminal: faTerminal,
    cloud: faCloud, hdd: faHdd, microchip: faMicrochip, memory: faMemory,
    network: faNetworkWired, sitemap: faSitemap, layers: faLayerGroup, box: faBox,
    boxOpen: faBoxOpen, archive: faArchive, folder: faFolder, flag: faFlag,
    bookmark: faBookmark, tag: faTag, tags: faTags, trophy: faTrophy,
    crown: faCrown, gem: faGem, key: faKey, lock: faLock,
    users: faUsers, user: faUser, userShield: faUserShield, robot: faRobot,
    ghost: faGhost, dragon: faDragon, skull: faSkull, dice: faDice,
    chess: faChess, puzzle: faPuzzlePiece, music: faMusic, video: faVideo,
    camera: faCamera, microphone: faMicrophone, headphones: faHeadphones, comments: faComments,
    envelope: faEnvelope, bell: faBell, clock: faClock, calendar: faCalendar,
    chartLine: faChartLine, chartBar: faChartBar, code: faCode, bug: faBug,
    wrench: faWrench, tools: faTools, lifeRing: faLifeRing, satellite: faSatelliteDish,
    tree: faTree, leaf: faLeaf, water: faWater, mountain: faMountain,
    sun: faSun, moon: faMoon, snowflake: faSnowflake, truck: faTruck,
    plane: faPlane, ship: faShip, car: faCar, home: faHome,
    building: faBuilding, industry: faIndustry, store: faStore, cart: faShoppingCart,
    coins: faCoins, dollar: faDollarSign, copy: faCopy, sync: faSync,
    circle: faCircle, square: faSquare, check: faCheck,
};

export const ICON_KEYS = Object.keys(ICONS);

export const resolveIcon = (key: string | null | undefined): IconDefinition | null =>
    key && ICONS[key] ? ICONS[key] : null;

/**
 * Elore beallitott szinek. Sotet hatteren mind jol olvashato.
 */
export const PRESET_COLORS = [
    '#38bdf8', // vilagoskek
    '#34d399', // zold
    '#fbbf24', // borostyan
    '#fb7185', // rozsaszin
    '#a78bfa', // lila
    '#f97316', // narancs
    '#22d3ee', // cian
    '#94a3b8', // szurke
    '#ef4444', // piros
    '#84cc16', // limezold
];
