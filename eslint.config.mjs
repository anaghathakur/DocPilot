import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

const webFiles = ['apps/web/**/*.{js,jsx,ts,tsx}'];

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/*.tsbuildinfo',
    'apps/web/next-env.d.ts',
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals.map((config) => ({ ...config, files: webFiles })),
  ...nextTypeScript.map((config) => ({ ...config, files: webFiles })),
]);
