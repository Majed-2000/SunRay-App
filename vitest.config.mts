import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure logic only (money, cart, order mapping) — no React
// Native runtime. Screens are verified on a device.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/__tests__/**/*.test.ts'], environment: 'node' },
});
