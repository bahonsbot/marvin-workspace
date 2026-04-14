import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'coverage/**', '.test-dist/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['eslint.config.mjs', 'scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default config;
