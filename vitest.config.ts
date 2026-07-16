import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/domain/**',
        'src/shared/**',
        'src/utils/**',
        'src/application/**',
        'src/infrastructure/http/**',
      ],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        statements: 34,
        branches:   31,
        functions:  38,
        lines:      34,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
