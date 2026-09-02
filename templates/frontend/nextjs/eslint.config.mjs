import next from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Flat config. `next lint` was removed in Next.js 16, so ESLint is invoked
 * directly and eslint-config-next is composed here instead.
 */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'out/**'] },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
];
