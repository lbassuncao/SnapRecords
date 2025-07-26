/*=============================================================================================================
    JEST CONFIGURATION FOR TESTS
    This configuration file is set up to run tests using Jest with TypeScript support.
    It specifies the test environment, transforms for TypeScript files, and module name mappings.
    The tests are located in the 'tests' folder, and the setup file is also specified to run
    after the environment is set up.
    The configuration is optimized to ensure that Jest only looks for tests in the
    'tests' folder, improving performance.
==============================================================================================================*/

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    // Add this line to tell Jest to look for tests only in the 'tests' folder.
    // This prevents it from searching in 'src' or 'node_modules', making it faster.
    roots: ['<rootDir>/tests'],

    preset: 'ts-jest',
    testEnvironment: 'jest-environment-jsdom',
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true,
            },
        ],
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    extensionsToTreatAsEsm: ['.ts'],

    // Update the path to the setup file, which is now inside the 'tests' folder.
    setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
};

/*=============================================================================================================
    EST CONFIGURATION ENDS
==============================================================================================================*/