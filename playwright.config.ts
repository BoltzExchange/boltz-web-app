import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./e2e",
    /* Run tests in files in parallel */
    fullyParallel: false,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: process.env.CI ? "blob" : "html",
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: "http://localhost:4173",
        ignoreHTTPSErrors: true,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: "on-first-retry",

        headless: true,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: "chromium",
            fullyParallel: true,
            use: {
                ...devices["Desktop Chrome"],
                contextOptions: {
                    // chromium-specific permissions
                    permissions: ["clipboard-read", "clipboard-write"],
                },
            },
        },

        /*
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    */
    ],

    webServer: {
        command: "npm run regtest && npm run build && npx vite preview",
        port: 4173,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
    },
});
