// @ts-check
import { test, expect } from "@playwright/test";

// Regression tests for custom element registration. The module used to call
// customElements.define() at module scope, which threw NotSupportedError
// whenever the bundle was evaluated twice on the same page (duplicate
// snippet, Turbo-style soft navigations re-running body scripts, npm + CDN
// double-loads). Registration is now explicit via the exported register().

const HARNESS_URL = "http://localhost:3847/web/tests/registration-harness.html";

async function gotoHarness(page) {
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => typeof window.jistRegister === "function");
}

test("importing the module does not define <jist-template>", async ({ page }) => {
  await gotoHarness(page);

  const defined = await page.evaluate(
    () => customElements.get("jist-template") !== undefined
  );
  expect(defined).toBe(false);
});

test("register() defines <jist-template>", async ({ page }) => {
  await gotoHarness(page);

  const registered = await page.evaluate(() => {
    window.jistRegister();
    return customElements.get("jist-template") === window.JistTemplateElement;
  });
  expect(registered).toBe(true);
});

test("register() is a no-op when called again", async ({ page }) => {
  await gotoHarness(page);

  // The second call must not throw NotSupportedError
  const defined = await page.evaluate(() => {
    window.jistRegister();
    window.jistRegister();
    return customElements.get("jist-template") !== undefined;
  });
  expect(defined).toBe(true);
});

test("register() yields when the tag is already defined", async ({ page }) => {
  await gotoHarness(page);

  // Another copy of the library (or an older version) claimed the tag first
  const firstRegistrationWins = await page.evaluate(() => {
    class Placeholder extends HTMLElement {}
    customElements.define("jist-template", Placeholder);
    window.jistRegister();
    return customElements.get("jist-template") === Placeholder;
  });
  expect(firstRegistrationWins).toBe(true);
});

test("elements parsed before register() upgrade once it runs", async ({ page }) => {
  await gotoHarness(page);

  const upgraded = await page.evaluate(() => {
    const el = document.createElement("jist-template");
    document.body.appendChild(el);
    window.jistRegister();
    return el instanceof window.JistTemplateElement;
  });
  expect(upgraded).toBe(true);
});
