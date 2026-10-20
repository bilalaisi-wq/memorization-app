async function menu(page) { const toggle=page.locator('#site-menu-toggle'); if(await toggle.getAttribute('aria-expanded')==='false') await toggle.click(); return page; }
// QA-only screenshots. All sample progress is generated through the production learning store.
// Run with Vite already serving: node scripts/night-sky-screenshots.mjs [internal base URL]
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createLearningStore } from "../src/learning-store.js";
import { surahs } from "../src/data.js";
const base = process.argv[2] || "http://127.0.0.1:5173",
  out = "docs/night-sky-screenshots";
await mkdir(out, { recursive: true });
const saved = new Map(),
  store = createLearningStore(
    {
      getItem: (k) => saved.get(k) || null,
      setItem: (k, v) => saved.set(k, String(v)),
    },
    surahs,
    { timeZone: "UTC", clock: () => new Date("2026-10-01T12:00Z") },
  );
for (const key of ["1:1", "1:2", "108:1", "108:2", "108:3"])
  for (let day = 1; day <= (key === "108:3" ? 2 : 3); day++) {
    const due = store.getRecord(key).memory.nextReview,
      now = new Date(
        Math.max(
          Date.parse(`2026-10-0${day}T12:00Z`),
          due ? Date.parse(due) : 0,
        ),
      );
    const attempt = store.beginRecall(key, now);
    store.updateRecall(attempt.id, "compare");
    store.gradeRecall(attempt.id, "Good", now);
  }
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
await page.addInitScript((values) => {
  if (!localStorage.getItem("qa-seeded")) {
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
    localStorage.setItem("qa-seeded", "true");
    localStorage.setItem(
      "ayah-tutorial-v1",
      JSON.stringify({ status: "skipped" }),
    );
  }
}, Object.fromEntries(saved));
await page.route("https://ycgyuatjgdbhiakqourg.supabase.co/**", (route) =>
  route.fulfill({
    status: 503,
    headers: { "access-control-allow-origin": "*" },
    json: { message: "QA uses mocked authentication only." },
  }),
);
const manifest = [],
  surfaceAudit = [];
async function shot(name, locator = null, target = page) {
  await target.mouse.move(0, 0);
  await target.evaluate(() => document.fonts.ready);
  const path = `${out}/${name}.jpg`;
  if (locator) await locator.screenshot({ path, type: "jpeg", quality: 82 });
  else
    await target.screenshot({
      path,
      type: "jpeg",
      quality: 82,
      fullPage: !name.includes("200-percent"),
    });
  manifest.push(name);
  if (name.startsWith("night")) {
    const bright = await target.locator("body *").evaluateAll((nodes) =>
      nodes
        .filter((el) => {
          if (!el.checkVisibility() || el.closest(".theme-preview-simple"))
            return false;
          const rect = el.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 35) return false;
          const color =
            getComputedStyle(el).backgroundColor.match(/^rgb[a]?\(([^)]+)\)/);
          if (!color) return false;
          const values = color[1].split(/[ ,/]+/).map(Number);
          return (
            values.slice(0, 3).every((n) => n > 185) &&
            (values.length < 4 || values[3] > 0.8)
          );
        })
        .map((el) => ({
          tag: el.tagName,
          classes: el.className,
          color: getComputedStyle(el).backgroundColor,
        })),
    );
    surfaceAudit.push({ screen: name, bright });
  }
}
await page.goto(base);
await page.locator(".reference-card").waitFor();
await shot("simple-practice");
await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
await shot("simple-daily");
await page.locator("#nav-learn").evaluate((el) => el.click());
await (await menu(page)).locator("#nav-encouragement").click();
await page.getByRole("button", { name: "Choose theme", exact: true }).click();
await page.locator('[data-theme-choice="night-sky"]').click();
await page.locator("[data-reduce-celestial]").check();
await page.locator("[data-appearance-apply]").click();
await page.locator(".experience-dialog [data-close]").click();
await shot("night-practice");
await page.locator('.word-bank [data-word="0"]').click();
await page.locator('.word-bank [data-word="1"]').click();
await shot("night-partial-puzzle", page.locator(".builder"));
await page.locator('[data-mode="quiz"]').click();
await shot("night-puzzle-quest");
for (let round = 0; round < 4; round++) {
  for (const id of [0, 1, 2, 3])
    await page.locator(`.word-bank [data-word="${id}"]`).click();
  await page.locator("#next").click();
  if (round === 0) await shot("night-puzzle-success");
  await page.locator("#next").click();
  if (round === 1) await shot("night-puzzle-quest-level-2");
  if (round === 3) await shot("night-puzzle-quest-level-3");
}
await page.locator('[data-mode="recall"]').click();
await shot("night-active-recall");
await page.locator('[data-mode="sequence"]').click();
await page.locator("#chain-all").click();
await page.locator("#chain-start").click();
await shot("night-ayah-chain");
await (await menu(page)).locator("#nav-lab").click();
await page.locator("#lab-mute").click();
for (const game of [
  "falling",
  "vanishing",
  "jigsaw",
  "match",
  "chain",
  "continue",
  "detective",
]) {
  await page.locator(`[data-game="${game}"]`).click();
  await shot(`night-lab-${game}`);
}
await page.locator('[data-choice="1"]').click();
await shot("night-lab-error");
await page.locator('[data-game="match"]').click();
for (const type of ["audio", "continuation"]) {
  await page.locator("#match-type").selectOption(type);
  await shot(`night-match-${type}`);
}
await (await menu(page)).locator("#nav-gallery").click();
await shot("night-gallery");
await page.getByRole("tab", { name: "Poetic Tafsir", exact: true }).click();
await shot("night-poetic-tafsir");
await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
await shot("night-daily");
await shot("night-achievements", page.locator(".achievements-section"));
await shot("night-activity", page.locator(".activity-section"));
await page.locator("[data-edit-goals]").click();
await shot("night-goals");
await page.keyboard.press("Escape");
await (await menu(page)).locator("#nav-encouragement").click();
await shot("night-settings");
await page.getByRole("button", { name: "Choose theme", exact: true }).click();
await shot("night-theme-chooser");
await page.keyboard.press("Escape");
await page.locator(".experience-dialog [data-close]").click();
await (await menu(page)).locator("#nav-tutorial").click();
await shot("night-tutorial");
await page.keyboard.press("Escape");
await (await menu(page)).getByRole("button", { name: "Sign in", exact: true }).click();
await page.locator('[data-auth-mode="signup"]').click();
await shot("night-signup");
let finishRequest, requestSeen;
const requested = new Promise((resolve) => {
  requestSeen = resolve;
});
await page.route(
  "**/auth/v1/otp**",
  (route) =>
    new Promise((resolve) => {
      requestSeen();
      finishRequest = () =>
        resolve(
          route.fulfill({
            status: 429,
            headers: { "access-control-allow-origin": "*" },
            json: { msg: "QA delivery limit. Please try again later." },
          }),
        );
    }),
);
await page.locator('[name="adult"]').check();
await page.locator('[name="email"]').fill("qa-learner@example.test");
await page.getByRole("button", { name: "Email me a sign-in code" }).click();
await page.waitForFunction(
  () => document.querySelector(".account-dialog .primary")?.disabled,
);
await requested;
await shot("night-signin-loading");
finishRequest();
await page
  .locator("[data-account-status]")
  .getByText("QA delivery limit. Please try again later.")
  .waitFor();
await shot("night-signin-error");
await page.keyboard.press("Escape");
await page.locator("#sky-surah-search").fill("108");
await page.locator('[data-sky-open="108"]').click();
await shot("night-self-assessment");
await page.locator("#recited-compare").click();
await shot("night-compare");
await page.locator('[data-recall-grade="Good"]').click();
await page.locator(".celestial-complete").waitFor();
await shot("night-confirmed-completion");
await page.locator(".celestial-complete button").click();
await page.locator("#nav-learn").evaluate((el) => el.click());
await page
  .locator("#surah-picker")
  .selectOption(String(surahs.findIndex((s) => s.id === 79)));
await shot("night-long-surah");
await page.setViewportSize({ width: 768, height: 1024 });
await shot("night-tablet");
await page.setViewportSize({ width: 390, height: 844 });
await shot("night-phone-long-surah");
await page.locator("#surah-picker").selectOption("0");
await shot("night-phone-practice");
await (await menu(page)).getByRole("button", { name: "My plan & achievements" }).click();
await shot("night-phone-daily");
await page.evaluate(() => (document.documentElement.style.zoom = "2"));
await shot("night-phone-200-percent");
// Separate, fully mocked signed-in QA context: no real accounts or provider requests.
const accountPage=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const uid='00000000-0000-0000-0000-000000000001';
const qaUser={id:uid,aud:'authenticated',role:'authenticated',email:'qa-account@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const exp=Math.floor(Date.now()/1000)+3600;
const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',exp})).toString('base64url')}.qa-signature`;
const qaSession={access_token:token,refresh_token:'qa-refresh',expires_at:exp,expires_in:3600,token_type:'bearer',user:qaUser};
await accountPage.addInitScript(({session,uid})=>{
 localStorage.setItem('sb-ycgyuatjgdbhiakqourg-auth-token',JSON.stringify(session));
 localStorage.setItem(`ayah-user:${uid}:ayah-appearance-v1`,JSON.stringify({version:1,theme:'night-sky',reduceEffects:true,updatedAt:new Date().toISOString()}));
},{session:qaSession,uid});
await accountPage.route('https://ycgyuatjgdbhiakqourg.supabase.co/**',route=>{
 const path=new URL(route.request().url()).pathname;
 return route.fulfill({headers:{'access-control-allow-origin':'*'},json:path.endsWith('/user')?qaUser:route.request().method()==='GET'||path.endsWith('get_weekly_leaderboard')?[]:null});
});
await accountPage.goto(base);await (await menu(accountPage)).getByRole('button',{name:'My account',exact:true}).click();await shot('night-account',null,accountPage);await accountPage.keyboard.press('Escape');await (await menu(accountPage)).getByRole('button',{name:'Leaderboard',exact:true}).click();await accountPage.getByText('No learners have opted in this week yet.').waitFor();await shot('night-leaderboard',null,accountPage);
await writeFile(
  `${out}/README.md`,
  `# Screenshot evidence\n\nGenerated with scripts/night-sky-screenshots.mjs using Chromium. These are isolated QA browser records, not real user activity or production defaults. Sample retained states are produced through the actual FSRS store on distinct days; the completion screenshot follows an actual self-assessed Good grade that makes the last ayah retained. No mockup Qur'an text or invented production achievements is used. Audio is muted in Lab captures. Reduced motion is enabled for stable screenshots.\n\n${manifest.map((name) => `- [${name}](${name}.jpg)`).join("\n")}\n`,
);
await writeFile(
  `${out}/surface-audit.json`,
  JSON.stringify(surfaceAudit, null, 2),
);
await browser.close();
console.log(`Saved ${manifest.length} screenshot artifacts.`);
