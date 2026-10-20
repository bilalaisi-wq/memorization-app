import { menu } from "./menu-helper.js";
import { test, expect } from "@playwright/test";
const project = "ycgyuatjgdbhiakqourg";
const endpoint = `https://${project}.supabase.co`;
const storageKey = `sb-${project}-auth-token`;
const user = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "learner@example.test",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
};
const session = () => {
  const payload = {
    sub: user.id,
    aud: "authenticated",
    role: "authenticated",
    iss: endpoint + "/auth/v1",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    session_id: "00000000-0000-0000-0000-000000000099",
  };
  return {
    access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.mock-signature`,
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
    expires_at: payload.exp,
    token_type: "bearer",
    user,
  };
};
async function mockService(page) {
  const calls = [];
  await page.route(`${endpoint}/**`, async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        },
      });
    const headers = { "access-control-allow-origin": "*" };
    if (path.endsWith("/otp")) {
      calls.push({ path, body: request.postDataJSON() });
      return route.fulfill({ headers, json: {} });
    }
    if (path.endsWith("/verify")) {
      calls.push({ path, body: request.postDataJSON() });
      return route.fulfill({ headers, json: session() });
    }
    if (path.endsWith("/user")) return route.fulfill({ headers, json: user });
    if (path.endsWith("/token"))
      return route.fulfill({ headers, json: session() });
    if (path.endsWith("/logout")) {
      calls.push({ path, url: request.url() });
      return route.fulfill({ status: 204, headers });
    }
    if (path.endsWith("/authorize"))
      return route.fulfill({
        headers,
        contentType: "text/html",
        body: "Google authorization handoff",
      });
    if (
      path.endsWith("/learner_progress") ||
      path.endsWith("/leaderboard_preferences")
    )
      return route.fulfill({ headers, json: [] });
    return route.fulfill({
      headers,
      status: 404,
      json: { message: "Mock endpoint not configured" },
    });
  });
  return calls;
}
test("email signup verifies a code and login survives closing the tab", async ({
  page,
  context,
}) => {
  const calls = await mockService(page);
  await page.goto("/");
  await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('[data-auth-mode="signup"]').click();
  await page.locator('[name="adult"]').check();
  await page.locator('[name="email"]').fill("learner@example.test");
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.locator("[data-verify]")).toBeVisible();
  expect(calls[0].body.create_user).toBe(true);
  await page.locator('[name="token"]').fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    (await menu(page)).getByRole("button", { name: "My account", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => !!localStorage.getItem(key), storageKey),
  ).toBe(true);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), storageKey),
  ).toBe(null);
  await page.close();
  const next = await context.newPage();
  await mockService(next);
  await next.goto("/");
  await expect(
    (await menu(next)).getByRole("button", { name: "My account", exact: true }),
  ).toBeVisible();
  await (await menu(next)).getByRole("button", { name: "My account", exact: true }).click();
  await expect(
    next.getByRole("button", { name: "Sign out on this device", exact: true }),
  ).toBeVisible();
  await next
    .getByRole("button", { name: "Sign out on this device", exact: true })
    .click();
  await expect(
    (await menu(next)).getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await next.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(null);
});
test("returning sign-in does not create accounts and failed verification preserves guest data", async ({
  page,
}) => {
  const calls = await mockService(page);
  await page.route(`${endpoint}/auth/v1/verify`, (route) =>
    route.fulfill({
      status: 403,
      headers: { "access-control-allow-origin": "*" },
      json: { code: "otp_expired", msg: "The sign-in code has expired." },
    }),
  );
  await page.goto("/");
  await page.locator(".word-bank [data-word]").first().click();
  const guest = await page.evaluate(() =>
    localStorage.getItem("ayah-learning-v1"),
  );
  await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('[name="adult"]').check();
  await page.locator('[name="email"]').fill("learner@example.test");
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.locator("[data-verify]")).toBeVisible();
  expect(calls[0].body.create_user).toBe(false);
  await page.locator('[name="token"]').fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.locator("[data-account-status]")).toContainText("expired");
  expect(
    await page.evaluate(() => localStorage.getItem("ayah-learning-v1")),
  ).toBe(guest);
});
test("Google redirects through Supabase to the exact Railway site URL", async ({
  page,
}) => {
  await mockService(page);
  await page.goto("/");
  await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('[name="adult"]').check();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(`${endpoint}/auth/v1/authorize**`);
  const url = new URL(page.url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(
    "https://ayah-a-day.up.railway.app/",
  );
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
});
test("a fresh device signs in separately and refreshes an expired access token", async ({
  page,
}) => {
  await mockService(page);
  const expired = session();
  expired.expires_at = Math.floor(Date.now() / 1000) - 60;
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: storageKey, value: expired },
  );
  await page.goto("/");
  await expect(
    (await menu(page)).getByRole("button", { name: "My account", exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    storageKey,
  );
  expect(stored.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test("disabled Google provider gives useful guidance without leaving the site", async ({
  page,
}) => {
  await mockService(page);
  await page.route(`${endpoint}/auth/v1/settings`, (route) =>
    route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: { external: { google: false } },
    }),
  );
  await page.goto("/");
  await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('[name="adult"]').check();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.locator("[data-account-status]")).toContainText(
    "Google sign-in is not enabled",
  );
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("sign out on all devices requests global session revocation", async ({
  page,
}) => {
  const calls = await mockService(page);
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: storageKey, value: session() },
  );
  await page.reload();
  await (await menu(page)).getByRole("button", { name: "My account", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Sign out on all devices", exact: true })
    .click();
  await expect(
    (await menu(page)).getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    new URL(
      calls.find((call) => call.path.endsWith("/logout")).url,
    ).searchParams.get("scope"),
  ).toBe("global");
});

test('only the server-verified owner sees developer menu and editorial notes', async ({page}) => {
  const owner = {...user, email:'bilalaisi@gmail.com', email_confirmed_at:'2026-10-20T00:00:00Z'};
  await mockService(page);
  await page.route(`${endpoint}/auth/v1/user`, route => route.fulfill({json:owner}));
  await page.addInitScript(({key, value}) => localStorage.setItem(key, JSON.stringify(value)), {key:storageKey,value:{...session(),user:owner}});
  await page.goto('/');
  await menu(page);
  await page.getByRole('button',{name:'Developer mode',exact:true}).click();
  await expect(page.locator('dialog')).toContainText('verified owner account');
  await page.locator('dialog [data-close]').click();
  await menu(page);
  await page.locator('#nav-gallery').click();
  await expect(page.locator('.mastery-view')).toContainText('Awaiting source verification');
});

test('a cached owner email cannot override a different verified server identity', async ({page}) => {
  await mockService(page);
  await page.addInitScript(({key,value}) => localStorage.setItem(key,JSON.stringify(value)), {key:storageKey,value:{...session(),user:{...user,email:'bilalaisi@gmail.com',email_confirmed_at:'2026-10-20T00:00:00Z'}}});
  await page.goto('/');
  await menu(page);
  await expect(page.getByRole('button',{name:'My account',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Developer mode',exact:true})).toHaveCount(0);
});
