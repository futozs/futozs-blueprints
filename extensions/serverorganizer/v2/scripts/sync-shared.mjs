// A kozos szervezo-kodot (../components/Organizer + ../styles.css) bemasolja a
// .shared konyvtarba, es a platform.tsx-et a 2.x-es megvalositasra csereli.
// Igy a Vite es a tsc is a v2/node_modules-bol old fel mindent.
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.shared');

rmSync(target, { recursive: true, force: true });
cpSync(join(root, '..', 'components', 'Organizer'), join(target, 'Organizer'), { recursive: true });
cpSync(join(root, '..', 'styles.css'), join(target, 'styles.css'));
writeFileSync(
    join(target, 'Organizer', 'platform.tsx'),
    "// Generalt fajl (scripts/sync-shared.mjs) - a 2.x-es platform reteg.\nexport * from '../../src/client/platform';\n"
);
