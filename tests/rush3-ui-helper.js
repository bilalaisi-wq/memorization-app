import { expect } from "@playwright/test";
export async function mountRush(
  page,
  {
    refs = ["1:1", "1:2", "1:3", "1:4", "1:5"],
    motor = "relaxed",
    memory = "guided",
    client = false,
    environment = 0,
    game = "surah-rush",
    renderIntervalMs = 100,
  } = {}
) {
  await page.goto("/");
  await page.evaluate(
    async ({
      refs,
      motor,
      memory,
      client,
      environment,
      game,
      renderIntervalMs,
    }) => {
      window.Audio = class {
        play() {
          return Promise.resolve();
        }
        pause() {}
        load() {}
        removeAttribute() {}
      };
      const root = document.createElement("section");
      document.body.replaceChildren(root);
      const { mountAdventure } = await import("/src/revision/adventures/ui.js");
      window.rushFrames = new Map();
      window.rushClock = performance.now();
      let next = 0;
      window.rushActivity = await mountAdventure(root, {
        game,
        refs,
        settings: { motor, memory, environment },
        client: client
          ? {
              functions: {
                invoke: async (_, { body }) => {
                  if (body.asset === "audio")
                    return { error: Error("No fixture audio") };
                  const response = await fetch(
                    "https://rush-source.test/?key=" + body.key
                  );
                  return response.ok
                    ? { data: await response.json() }
                    : { error: Error("Fixture source unavailable") };
                },
              },
            }
          : null,
        frameScheduler: {
          renderIntervalMs,
          request(fn) {
            const id = ++next;
            window.rushFrames.set(id, fn);
            return id;
          },
          cancel(id) {
            window.rushFrames.delete(id);
          },
        },
      });
    },
    { refs, motor, memory, client, environment, game, renderIntervalMs }
  );
  await page.locator("[data-adventure-audio]").selectOption("paused");
  if (!(await page.locator(".rush-checkpoint").isVisible())) {
    await page.locator("[data-flow-start]").click();
    await expect(page.locator(".flow-battlefield")).toBeFocused();
  }
}
export async function driveRush(
  page,
  { goal = 5, wrong = false, maxFrames = 12000, units = null } = {}
) {
  return page.evaluate(
    async ({ goal, wrong, maxFrames, units }) => {
      const { revisionUnits } = await import(
        "/src/revision/adventures/content.js"
      );
      const { localBundle } = await import("/src/content/library.js");
      let lastCourse = -1,
        wrongDone = false,
        commits = 0;
      const key = (code, type = "keydown") =>
        document
          .querySelector(".flow-battlefield")
          ?.dispatchEvent(
            new KeyboardEvent(type, { bubbles: true, code, key: code })
          );
      const yieldTask = () =>
        new Promise((resolve) => {
          const c = new MessageChannel();
          c.port1.onmessage = () => {
            c.port1.close();
            c.port2.close();
            resolve();
          };
          c.port2.postMessage(0);
        });
      for (let n = 0; n < maxFrames; n++) {
        const host = window.rushActivity.getSnapshot(),
          s = host.engine;
        if (
          host.completed >= goal ||
          document.querySelector(".rush-checkpoint:not([hidden])")
        ) {
          key("ArrowRight", "keyup");
          return host;
        }
        if (host.pendingSave) throw Error("Host save pending");
        if (document.querySelector("[data-flow-ready]"))
          document.querySelector("[data-flow-ready]").click();
        let route = 1;
        if (!s.resolved && !s.detour) {
          const ref = host.refs[host.completed],
            unit = (
              units?.[ref] ||
              ["guided", "standard", "expert"].flatMap((m) =>
                revisionUnits(localBundle(ref), m)
              )
            ).find((u) => u.id === s.challenge?.id);
          const signs = [...document.querySelectorAll("[data-rush-sign]")];
          const correct = signs.find(
            (el) => el.querySelector(".arabic")?.textContent === unit?.text
          );
          if (correct) {
            route = Number(correct.dataset.rushSign);
            if (wrong && !wrongDone) {
              route = (route + 1) % signs.length;
            }
          }
        }
        key("ArrowRight");
        const x = s.x - s.plan.start;
        if (s.detour) {
          wrongDone = true;
          if (s.grounded && x > 1230) key("Space");
        } else if (!s.resolved) {
          if (
            route === 0 &&
            s.grounded &&
            x > 440 &&
            x < 1080 &&
            s.y + 18 > s.plan.upper + 8
          )
            key("Space");
          if (
            route === 2 &&
            s.grounded &&
            x > 580 &&
            x < 930 &&
            s.y + 18 < s.plan.lower - 20
          )
            key("ArrowDown");
          if (
            ["obstacles", "multi-junction"].includes(s.plan.kind) &&
            x > 870 &&
            x < 930 &&
            s.grounded
          )
            key("Space");
        }
        window.rushClock += 1000 / 60;
        for (const [id, fn] of [...window.rushFrames]) {
          window.rushFrames.delete(id);
          fn(window.rushClock);
        }
        if (s.course !== lastCourse) {
          lastCourse = s.course;
          commits++;
        }
        if (n % 12 === 0 || host.answerPending) await yieldTask();
      }
      throw Error(
        "Driver exceeded route budget: " +
          JSON.stringify(window.rushActivity.getSnapshot())
      );
    },
    { goal, wrong, maxFrames, units }
  );
}
