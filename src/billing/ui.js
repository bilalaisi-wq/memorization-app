import {isDeveloperMode} from "../developer/access.js";
import { mountSegmentReview } from "../passage/review-menu.js";
const openPassageStudio = (ctx) =>
  import("../passage/ui.js").then((m) => m.openPassageStudio(ctx));
import { billingClient, stripeRedirect } from "./client.js";
import { esc } from "../ui/dom.js";
import { surahs } from "../data.js";
import "./billing.css";
const names = {
  free: "Free",
  explorer: "Explorer",
  pathfinder: "Pathfinder",
  guardian: "Guardian",
};
const plans = [
  ["free", 0, 0, "A steady beginning", [
    "Unlimited Juz Amma and Al-Fatihah",
    "Every existing free learning mode",
    "Basic spaced revision",
  ]],
  ["explorer", 3.99, 35.99, "Build your own path", [
    "Passage Builder and saved passages",
    "Choose five additional juz as content becomes available",
    "Everything in Free",
  ]],
  ["pathfinder", 6.99, 59.99, "Make revision intentional", [
    "All Qur’an content when available",
    "Advanced revision planning",
    "Memory analytics",
    "AI only when separately enabled",
  ]],
  ["guardian", 11.99, 99.99, "For the journey ahead", [
    "Everything in Pathfinder",
    "Advanced AI services when ready",
    "Initially unavailable",
  ]],
];
function dialog(title, extra = "") {
  const d = document.createElement("dialog");
  d.className = `account-dialog billing-dialog ${extra}`;
  d.innerHTML = `<button class="text-button" data-close>Close ×</button><h2>${
    esc(title)
  }</h2><div data-billing-content></div><p data-billing-status role="status" aria-live="polite"></p>`;
  const close = () => {
    d.close();
    d.remove();
  };
  d.querySelector("[data-close]").onclick = close;
  d.oncancel = () => d.remove();
  document.body.append(d);
  d.showModal();
  return d;
}
function status(d, message, error = false) {
  const el = d.querySelector("[data-billing-status]");
  el.textContent = message;
  el.dataset.tone = error ? "error" : "info";
}
async function action(d, fn) {
  const buttons = [...d.querySelectorAll("button:not([data-close])")];
  buttons.forEach((b) => b.disabled = true);
  try {
    await fn();
  } catch (e) {
    status(d, e.message, true);
  } finally {
    buttons.forEach((b) => {
      if (b.isConnected && !b.hasAttribute("data-permanent-disabled")) {
        b.disabled = false;
      }
    });
  }
}
function date(value) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "—";
}
export function mountBillingControls(nav, context) {
  const api = billingClient(context.client);
  mountSegmentReview(nav, context);
  for (
    const [label, open] of [
      ["Hifz Coach", () => import("../coach/ui.js").then(m=>m.openCoach({...context,onPassageStudio:(target,action)=>openPassageStudio({...context,coachTarget:target,coachAction:action})}))],
      ["Juz 29 library", () => import("../content/juz-library.js").then(m=>m.openJuz29(context))],
      ["Plans & pricing", () => pricing(context, api)],
      ["Subscription & billing", () => account(context, api)],
      ["Passage Builder", () => passages(context, api)],
      ["Passage memorization", () => openPassageStudio(context)],
      ["Passage Expedition", () => import("../quest/expedition/ui.js").then(m=>m.openExpedition(context))],
      ["Advanced revision & analytics", () => insights(context, api)],
    ]
  ) {
    const b = document.createElement("button");
    b.className = "text-button";
    b.textContent = label;
    b.dataset.developerOnly='true';b.hidden=!isDeveloperMode();b.disabled=!isDeveloperMode();
    b.onclick = () => {if(isDeveloperMode())open();};
    nav.append(b);
  }
  if (
    isDeveloperMode() && !document.querySelector("[data-billing-return]") &&
    ["success", "cancel", "return"].includes(
      new URL(location.href).searchParams.get("billing"),
    )
  ) {
    const banner = document.createElement("section");
    banner.className = "billing-return";
    banner.dataset.billingReturn = "true";
    banner.setAttribute("role", "status");
    banner.innerHTML = `<p>${
      new URL(location.href).searchParams.get("billing") === "success"
        ? "Checkout returned. Access unlocks only after payment is confirmed by the server."
        : "Your learning progress is unchanged. Open billing to check your subscription."
    }</p><button class="text-button">Check billing</button>`;
    banner.querySelector("button").onclick = () => account(context, api);
    document.querySelector(".page-heading").after(banner);
  }
}
async function pricing(ctx, api) {
  const d = dialog("A plan for your memorization journey", "pricing-dialog"),
    root = d.querySelector("[data-billing-content]");
  let annual = false, ent = null;
  root.textContent = "Loading plan availability…";
  try {
    ent = await api.entitlements();
  } catch (e) {
    status(d, e.message, true);
  }
  if (!d.isConnected) return;
  const draw = () => {
    root.innerHTML =
      `<p>Keep learning, at your pace. Free Juz Amma and all existing free features stay free.</p><p class="billing-library-note"><strong>Available today: Al-Fatihah and all of Juz Amma.</strong> Juz 29 (11 surahs, 431 ayahs) is prepared for private deployment and owner review in Passage memorization. Premium playback requires the private library to be deployed. Other additional juz remain unavailable. AI services are not currently offered.</p><div class="billing-cadence" role="group" aria-label="Billing period"><button class="text-button" data-cadence="monthly" aria-pressed="${!annual}">Monthly</button><button class="text-button" data-cadence="annual" aria-pressed="${annual}">Annual</button></div><div class="pricing-grid">${
        plans.map(([id, monthly, yearly, tag, features]) => {
          const disabled = id === "free" || !ent?.checkoutEnabled ||
            (id === "guardian" && !ent?.guardianEnabled);
          return `<article class="pricing-card ${
            id === "pathfinder" ? "pricing-featured" : ""
          }"><span class="eyebrow">${esc(tag)}</span><h3>${
            names[id]
          }</h3><p class="plan-price">$${
            Number(annual ? yearly : monthly).toFixed(2)
          }<span>${
            id === "free" ? " forever" : annual ? " / year" : " / month"
          }</span></p><ul>${
            features.map((f) => `<li>${esc(f)}</li>`).join("")
          }</ul><button class="${
            id === "pathfinder" ? "primary" : "text-button"
          }" data-plan="${id}" ${
            disabled ? "disabled data-permanent-disabled" : ""
          }>${
            id === "free"
              ? "Always available"
              : id === "guardian" && !ent?.guardianEnabled
              ? "Not available yet"
              : !ent?.checkoutEnabled
              ? "Checkout not activated"
              : ctx.user
              ? "Choose " + names[id]
              : "Sign in to choose"
          }</button></article>`;
        }).join("")
      }</div><p>USD. Annual plans bill the full annual amount. Any applicable tax is shown in Stripe Checkout. Manage payment details, plan changes, and cancellation in Stripe’s hosted portal. Cancellation never deletes learning progress.</p>`;
    root.querySelectorAll("[data-cadence]").forEach((b) =>
      b.onclick = () => {
        annual = b.dataset.cadence === "annual";
        draw();
      }
    );
    root.querySelectorAll("[data-plan]:not([disabled])").forEach((b) =>
      b.onclick = () => {
        if (!ctx.user) {
          d.close();
          d.remove();
          ctx.signIn();
          return;
        }
        action(d, async () => {
          const result = await api.invoke("checkout", {
            plan: b.dataset.plan,
            cadence: annual ? "annual" : "monthly",
          });
          location.assign(stripeRedirect(result.url, "checkout"));
        });
      }
    );
  };
  draw();
}
async function account(ctx, api) {
  const d = dialog("Subscription & billing"),
    root = d.querySelector("[data-billing-content]");
  if (!ctx.user) {
    root.innerHTML =
      '<p>Sign in to view your private subscription. Free learning needs no subscription.</p><button class="primary" data-signin>Sign in</button>';
    root.querySelector("button").onclick = () => {
      d.close();
      d.remove();
      ctx.signIn();
    };
    return;
  }
  root.textContent = "Checking your server-verified subscription…";
  async function load(ent) {
    if (!d.isConnected) return;
    root.innerHTML =
      `<section class="billing-summary"><span class="eyebrow">YOUR SUBSCRIPTION</span><h3>${
        names[ent.plan]
      }</h3><p>${
        ent.mode === "test"
          ? "Stripe test environment · no real payments"
          : "Live billing"
      }</p><p>${
        ent.plan === "free"
          ? "Free access is available without a payment."
          : `${
            ent.cancelAtPeriodEnd
              ? "Cancellation scheduled. Access continues until"
              : "Paid access through"
          } ${date(ent.accessUntil)}.`
      }</p></section><div class="billing-actions"><button class="primary" data-portal>Manage billing in Stripe</button><button class="text-button" data-refresh>Refresh billing status</button><button class="text-button" data-plans>See plans</button></div><p>Update cards, change plans, or cancel through Stripe’s secure portal. Payment failures do not delete progress; premium access lasts only through the paid period. Your free features remain available.</p><details><summary>Before deleting your account</summary><p>Cancel in Stripe first. After the cancellation takes effect, close billing here before deleting your account in My account. Closing billing removes saved payment methods and cannot be undone here; it does not delete learning progress.</p><button class="text-button" data-close-billing>Close billing for account deletion</button></details>${
        ent.plan === "explorer"
          ? `<fieldset class="juz-choices"><legend>Choose up to five additional juz</legend><p>These choices reserve access as content becomes available. Juz Amma is always free.</p><div>${
            Array.from({ length: 29 }, (_, i) => i + 1).map((j) =>
              `<label><input type="checkbox" value="${j}" ${
                ent.selectedJuz.includes(j) ? "checked" : ""
              }> Juz ${j}</label>`
            ).join("")
          }</div><button class="primary" data-save-juz>Save my five choices</button></fieldset>`
          : ""
      }`;
    root.querySelector("[data-portal]").onclick = () =>
      action(d, async () => {
        const result = await api.invoke("portal");
        location.assign(stripeRedirect(result.url, "portal"));
      });
    root.querySelector("[data-refresh]").onclick = () =>
      action(d, async () => {
        await api.invoke("refresh");
        await load(await api.entitlements());
        status(d, "Billing status refreshed from the server.");
      });
    root.querySelector("[data-close-billing]").onclick = () => {
      if (
        confirm(
          "Close your Stripe billing account and remove its payment methods? Your subscription must already be canceled. Learning progress stays unchanged.",
        )
      ) {
        action(d, async () => {
          await api.invoke("close", { confirm: true });
          status(
            d,
            "Billing closed. You can now delete your account through My account.",
          );
        });
      }
    };
    root.querySelector("[data-plans]").onclick = () => pricing(ctx, api);
    root.querySelector("[data-save-juz]")?.addEventListener(
      "click",
      () =>
        action(d, async () => {
          const selected = [
            ...root.querySelectorAll(".juz-choices input:checked"),
          ].map((el) => Number(el.value));
          if (selected.length > 5) {
            throw new Error("Choose no more than five additional juz.");
          }
          await load(await api.chooseJuz(selected));
          status(d, "Your juz choices are saved.");
        }),
    );
  }
  try {
    await load(await api.entitlements());
  } catch (e) {
    status(d, e.message, true);
    root.textContent =
      "Your subscription could not be checked. Free learning remains available.";
  }
}
async function passages(ctx, api) {
  const library=ctx.library||surahs;
  const d = dialog("Passage Builder"),
    root = d.querySelector("[data-billing-content]");
  const studio = document.createElement("button");
  studio.className = "primary";
  studio.textContent = "Open memorization studio";
  studio.onclick = () => {
    d.close();
    d.remove();
    openPassageStudio(ctx);
  };
  root.before(studio);
  if (!ctx.user) {
    root.innerHTML =
      '<p>Save named passages with Explorer or Pathfinder. The existing Ayah Chain remains free.</p><button class="primary">Sign in</button>';
    root.querySelector("button").onclick = () => {
      d.close();
      d.remove();
      ctx.signIn();
    };
    return;
  }
  async function load() {
    root.textContent = "Loading your passages…";
    const ent = await api.entitlements();
    const saved = await api.invoke("passages", { action: "list" });
    if (!d.isConnected) return;
    root.innerHTML =
      `<p>Save a named ayah range, then open its word puzzles and practice the sequence. Existing saved passages remain accessible after your subscription ends.</p>${
        ent.features.passageBuilder
          ? `<form data-passage-form><label>Passage name<input name="title" required maxlength="80" autocomplete="off"></label><label>Surah<select name="surah">${
            library.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`)
              .join("")
          }</select></label><div class="passage-range"><label>First ayah<input name="first" type="number" min="1" value="1" required></label><label>Last ayah<input name="last" type="number" min="1" value="2" required></label></div><button class="primary">Save passage</button></form>`
          : "<p>Explorer or Pathfinder is required to save new passages. Use the free Ayah Chain for unlimited practice.</p>"
      }<h3>Your saved passages</h3><div class="saved-passages">${
        saved.map((p) =>
          `<article><h4>${esc(p.title)}</h4><p>${
            esc(
              library.find((s) => s.id === p.surah)?.name || "Surah " + p.surah,
            )
          } · ${p.first_ayah}–${p.last_ayah}</p><button class="primary small" data-open-passage="${
            esc(p.id)
          }">Practice passage</button><button class="text-button" data-delete-passage="${
            esc(p.id)
          }">Remove saved passage</button></article>`
        ).join("") || "<p>No saved passages yet.</p>"
      }</div>`;
    root.querySelector("[data-passage-form]")?.addEventListener(
      "submit",
      (e) => {
        e.preventDefault();
        const f = e.target;
        action(d, async () => {
          await api.invoke("passages", {
            action: "save",
            title: f.elements.title.value,
            surah: Number(f.elements.surah.value),
            firstAyah: Number(f.elements.first.value),
            lastAyah: Number(f.elements.last.value),
          });
          await load();
          status(d, "Passage saved.");
        });
      },
    );
    root.querySelectorAll("[data-open-passage]").forEach((b) =>
      b.onclick = () => {
        const p = saved.find((p) => p.id === b.dataset.openPassage);
        d.close();
        d.remove();
        ctx.onPassage?.(p);
      }
    );
    root.querySelectorAll("[data-delete-passage]").forEach((b) =>
      b.onclick = () =>
        action(d, async () => {
          await api.invoke("passages", {
            action: "delete",
            id: b.dataset.deletePassage,
          });
          await load();
        })
    );
  }
  try {
    await load();
  } catch (e) {
    status(d, e.message, true);
    root.textContent =
      "Passage Builder is unavailable. Your existing free practice and saved learning progress are unchanged.";
  }
}
async function insights(ctx, api) {
  const d = dialog("Advanced revision & memory analytics"),
    root = d.querySelector("[data-billing-content]");
  try {
    if (!ctx.user) throw new Error("Sign in to use your subscription.");
    const ent = await api.entitlements();
    if (!ent.features.advancedRevision || !ent.features.memoryAnalytics) {
      root.innerHTML =
        "<p>Pathfinder unlocks a revision planner and deeper memory summaries. Your existing Daily Quests, basic spaced revision, achievements, and activity tracker remain free.</p>";
      return;
    }
    const records = Object.values(ctx.learning.snapshot().records),
      now = Date.now();
    const due = records.filter((r) =>
      r.memory.nextReview && Date.parse(r.memory.nextReview) <= now
    ).sort((a, b) =>
      Date.parse(a.memory.nextReview) - Date.parse(b.memory.nextReview)
    );
    const history = records.flatMap((r) => r.memory.history || []).filter((h) =>
      h.independent
    );
    root.innerHTML =
      `<p>Based on your saved self-assessed recall history. These summaries do not verify spoken recitation or change the FSRS schedule.</p><div class="billing-metrics"><div><strong>${history.length}</strong> Independent recall attempts</div><div><strong>${
        records.filter((r) => r.memory.stage === "retained").length
      }</strong> Retained ayahs</div><div><strong>${
        records.reduce((n, r) => n + (r.memory.lapses || 0), 0)
      }</strong> Recorded lapses</div></div><h3>Plan your revision</h3><label>Review batch size<select data-batch><option>5</option><option>10</option><option>20</option></select></label><p>${due.length} ayahs due now. Prioritize the oldest due dates without changing their schedules.</p><div data-revision-list></div><h3>Next seven days</h3><div class="revision-week">${
        Array.from({ length: 7 }, (_, i) => {
          const day = new Date();
          day.setDate(day.getDate() + i);
          day.setHours(0, 0, 0, 0);
          const end = new Date(day);
          end.setDate(end.getDate() + 1);
          return `<p><span>${
            day.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          }</span><strong>${
            records.filter((r) =>
              r.memory.nextReview &&
              Date.parse(r.memory.nextReview) >= day.getTime() &&
              Date.parse(r.memory.nextReview) < end.getTime()
            ).length
          } scheduled</strong></p>`;
        }).join("")
      }</div><p>AI assistance is ${
        ent.features.ai
          ? "feature-enabled, but no AI service is connected yet"
          : "disabled"
      }. No recordings are sent to an AI provider.</p>`;
    const draw = () => {
      root.querySelector("[data-revision-list]").innerHTML =
        due.slice(0, Number(root.querySelector("[data-batch]").value)).map(
          (r) =>
            `<button class="text-button" data-due="${esc(r.key)}">Review ${
              esc(r.key)
            } · due ${date(r.memory.nextReview)}</button>`,
        ).join("") ||
        "<p>No reviews due. Continue your normal spaced schedule.</p>";
      root.querySelectorAll("[data-due]").forEach((b) =>
        b.onclick = () => {
          d.close();
          d.remove();
          ctx.onRecall?.(b.dataset.due);
        }
      );
    };
    root.querySelector("[data-batch]").onchange = draw;
    draw();
  } catch (e) {
    status(d, e.message, true);
    root.textContent =
      "Your free Daily Quests and basic revision remain available.";
  }
}
