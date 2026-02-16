import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
  // UMD (browser, script tag)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/livellm.min.js',
      format: 'umd',
      name: 'LiveLLM',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json', declaration: false, declarationDir: undefined }),
      resolve({ browser: true }),
      commonjs(),
      terser(),
    ],
  },
  // ESM (bundlers, tree-shaking)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/livellm.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json' }),
      resolve({ browser: true }),
      commonjs(),
    ],
  },
  // CJS (Node.js)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/livellm.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      typescript({ tsconfig: './tsconfig.json', declaration: false, declarationDir: undefined }),
      resolve({ browser: true }),
      commonjs(),
    ],
  },
];
