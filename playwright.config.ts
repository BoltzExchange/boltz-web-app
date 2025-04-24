import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./e2e",
    /* Run tests in files in parallel */
    fullyParallel: false,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: isCI,
    /* Retry on CI only */
    retries: isCI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: isCI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: "html",
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: isCI ? "http://localhost:5173" : "https://localhost:5173",
        ignoreHTTPSErrors: true,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: "on-first-retry",

        headless: true,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: "chromium",
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
        command: "npm run start",
        port: 5173,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
    },
});
