// @ts-check
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* No retries — visual tests should be deterministic */
  retries: 0,

  /* Clean snapshot file names: tests/__snapshots__/basic-light.png */
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",

  use: {
    /* iPhone-like viewport */
    viewport: { width: 390, height: 844 },

    /* Disable animations for stable screenshots */
    reducedMotion: "reduce",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],

  /* Serve from the project root so that both web/ and shared/ are accessible */
  webServer: {
    command: "npx serve .. --listen 3847 --no-clipboard",
    port: 3847,
    reuseExistingServer: !process.env.CI,
  },
});
