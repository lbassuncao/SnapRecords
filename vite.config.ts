import path from 'path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vite';

/*=============================================================================================================
   VITE CONFIGURATION
   This configuration file is used to build the SnapRecords library.
   It includes TypeScript definitions and minification settings.
   The output will be in the 'dist' directory with source maps enabled.
   The library will be named 'SnapRecords' and will generate files in various formats.
   The TypeScript definitions will be generated and included in the output.
==============================================================================================================*/

export default defineConfig(({ mode }) => ({
    plugins: [
        dts({
            processor: 'vue',
            tsconfigPath: './tsconfig.json',
            include: ['src'],
            bundleTypes: true,
            insertTypesEntry: true,
        }),
    ],
    define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        minify: 'terser',
        terserOptions: {
            format: {
                comments: false,
            },
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
        rollupOptions: {
            output: {
                // rename CSS files
                assetFileNames: 'snap-records.[ext]',
            },
            checks: {
                pluginTimings: false,
            },
        },
        lib: {
            name: 'SnapRecords',
            entry: path.resolve(import.meta.dirname, 'src/index.ts'),
            // The UMD build is a CommonJS bundle; ".js" would be loaded as ESM under
            // this package's "type": "module", leaving it with no exports under require().
            fileName: (format) => `snap-records.${format}.${format === 'umd' ? 'cjs' : 'js'}`,
        },
    },
}));

/*=============================================================================================================
    VITE CONFIGURATION ENDS
==============================================================================================================*/
