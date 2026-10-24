import { defineConfig } from 'vitest/config';
import { pterodactylTestAliases, pterodactylTestDirectory, pterodactylTestSetup } from '@pterodactyl/sdk/vitest';

export default defineConfig({
    server: { fs: { allow: [process.cwd(), pterodactylTestDirectory] } },
    resolve: { alias: pterodactylTestAliases() },
    test: {
        environment: 'jsdom',
        setupFiles: [pterodactylTestSetup],
        include: ['src/**/*.spec.{ts,tsx}'],
        restoreMocks: true,
    },
});
