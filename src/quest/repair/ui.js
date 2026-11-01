import { esc } from "../../ui/dom.js";
import {
  activeProfileId,
  profileStorage,
} from "../../learner/profile-storage.js";
import { createPassageMemory } from "../../passage/memory.js";
import { createLearningStore } from "../../learning-store.js";
import { createPuzzleStore } from "../../puzzles/puzzle-store.js";
import { catalog, availability, reference } from "../../content/library.js";
import { surahs } from "../../data.js";
import { openPassageStudio } from "../../passage/ui.js";
import { verifyRescueUnit } from "../rescue/content.js";
import { repairAnalysis, repairCategories } from "./model.js";
import { prepareRepairMission, launchRepairMission } from "./mission.js";
import "./repair.css";
let activeWorkshop = null;
export function openRepairWorkshop(ctx = {}) {
  activeWorkshop?.close();
  const owner = ctx.user?.id || null;
  let disposed = false,
    mission = null,
    studio = null,
    request = 0,
    selected = null,
    analysis = null,
    page = 0,
    loading = false,
    activityScope = null;
  const guard = () => {
    if (disposed || activeProfileId() !== owner)
      throw Error("Account changed. Reopen Memory Repair Workshop.");
  };
  guard();
  window.dispatchEvent(
    new CustomEvent("ayah-quest-surface", { detail: { name: "repair" } }),
  );
  const storage = {
    getItem: (k) => {
      guard();
      return profileStorage.getItem(k);
    },
    setItem: (k, v) => {
      guard();
      profileStorage.setItem(k, v);
    },
  };
  const refs = [
    ...surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
    ...availability.premium.map((p) => p.key),
  ];
  const library = catalog.chapters.map((c) => ({
    id: c.id,
    verses: refs
      .filter((k) => reference(k).surah === c.id)
      .map((k) => ({ id: reference(k).ayah })),
  }));
  const root = document.createElement("section");
  root.className = "memory-repair";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Memory Repair Workshop");
  root.tabIndex = -1;
  const before = document.activeElement,
    blocked = [...document.body.children]
      .filter((el) => el.tagName !== "SCRIPT")
      .map((el) => [el, el.inert]);
  blocked.forEach(([el]) => (el.inert = true));
  document.body.append(root);
  const controller = new AbortController(),
    listen = (target, type, fn) =>
      target.addEventListener(type, fn, { signal: controller.signal });
  const memory = () => createPassageMemory(storage);
  function clear() {
    request++;
    activityScope?.abort();
    activityScope = null;
    mission?.dispose();
    mission = null;
    loading = false;
  }
  function close() {
    if (disposed) return;
    clear();
    disposed = true;
    studio?.close();
    controller.abort();
    root.remove();
    blocked.forEach(([el, value]) => (el.inert = value));
    if (before?.isConnected) before.focus();
    if (activeWorkshop?.close === close) activeWorkshop = null;
  }
  listen(window, "ayahprofilechange", () => {
    if (activeProfileId() !== owner) close();
  });
  listen(window, "ayah-developer-mode", close);
  listen(window, "pagehide", close);
  listen(window, "ayah-quest-surface", (e) => {
    if (e.detail?.name !== "repair") close();
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden) mission?.pause();
  });
  listen(root, "keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (studio) return;
      close();
    }
    if (e.key === "Tab" && !studio) {
      const nodes = [
        ...root.querySelectorAll(
          'button:not(:disabled),select,a[href],[tabindex="0"]',
        ),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  function status(text) {
    const node = root.querySelector("[data-repair-status]");
    if (node) node.textContent = text;
  }
  function shell() {
    root.innerHTML = `<header><div><p class="eyebrow">SUPPORTED PRACTICE · HONEST EVIDENCE</p><h2>Memory Repair Workshop</h2><p>Reconnect your study pathways, one calm practice session at a time.</p></div><button data-repair-close aria-label="Close Memory Repair Workshop">Close ✕</button></header><nav><button data-repair-back>← Workshop map</button></nav><main data-repair-body></main><p role="status" data-repair-status></p>`;
    root.querySelector("[data-repair-close]").onclick = close;
    root.querySelector("[data-repair-back]").onclick = () => {
      clear();
      render();
      root.querySelector("[data-repair-close]").focus();
    };
  }
  function render() {
    guard();
    clear();
    shell();
    const passage = memory(),
      lab = createPuzzleStore(storage, library);
    analysis = repairAnalysis({
      memory: passage.snapshot(),
      lab: lab.snapshot(),
    });
    const body = root.querySelector("[data-repair-body]"),
      items = analysis.recommendations;
    page = Math.max(
      0,
      Math.min(page, Math.max(0, Math.ceil(items.length / 12) - 1)),
    );
    body.innerHTML = `${passage.warning || lab.warning ? `<p role="alert">${esc(passage.warning || lab.warning)} Saved records have not been reset. Use the existing recovery/export tools.</p>` : ""}<p class="repair-note">These connections represent practice suggestions, not a diagnosis of forgotten Qur’an. Completing a repair never changes your recall schedule.</p><div class="repair-stats"><span>⌁ ${items.length} practice suggestions</span><span>✥ ${analysis.diagnostics.motorEvents.length} motor events · excluded from memory evidence</span></div><div class="repair-map">${items
      .slice(page * 12, page * 12 + 12)
      .map(
        (r, i) =>
          `<button class="repair-node" data-repair-node="${i}"><span aria-hidden="true" class="repair-link">✦ ┄ ◇</span><strong>${esc(r.title)}</strong><span>${esc(r.key)}</span><small>${r.evidence.length} evidence record(s) · inspect source</small></button>`,
      )
      .join(
        "",
      )}</div>${!items.length ? "<h3>No recorded repair evidence yet</h3><p>Play a learning activity or complete a self-assessed recall. We will not invent weaknesses.</p><button data-repair-study>Open supported study</button>" : ""}<div class="repair-pages"><button data-repair-prev ${page === 0 ? "disabled" : ""}>Previous</button><span>Page ${page + 1} of ${Math.max(1, Math.ceil(items.length / 12))}</span><button data-repair-next ${(page + 1) * 12 >= items.length ? "disabled" : ""}>Next</button></div><details><summary>Evidence and limitations</summary><ul>${analysis.limitations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p>Independent externally graded recall: no supported evidence source connected. Unverified audio/transcription: excluded.</p><p>Categories without evidence: ${
      Object.entries(repairCategories)
        .filter(([key]) => !items.some((r) => r.category === key))
        .map(([, v]) => esc(v.title))
        .join(", ") || "none"
    }.</p><p>Audio use alone is not a failure or proof of dependence. Old generic sequence errors remain generic.</p></details>`;
    body
      .querySelectorAll("[data-repair-node]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            detail(items[page * 12 + Number(b.dataset.repairNode)])),
      );
    body.querySelector("[data-repair-prev]").onclick = () => {
      page--;
      render();
    };
    body.querySelector("[data-repair-next]").onclick = () => {
      page++;
      render();
    };
    body
      .querySelector("[data-repair-study]")
      ?.addEventListener("click", () => study());
  }
  function detail(r) {
    selected = r;
    clear();
    shell();
    const body = root.querySelector("[data-repair-body]");
    body.innerHTML = `<section class="repair-detail"><span class="repair-link" aria-hidden="true">✦ ┄ ◇ ┄ ✦</span><h3>${esc(r.title)} · ${esc(r.key)}</h3><p>${esc(r.tip)}</p><p>Recommendation rule: this recorded category maps to ${esc(r.game)} at a slow beginner pace. A registered alternative or bounded supported practice is used if unavailable.</p><button data-repair-launch>Start corrective mission</button><button data-repair-recall>Try independent recall</button><h4>Why this suggestion?</h4><p>${r.evidence.length} source record(s). Showing the latest 20; dates and references come from saved records.</p><ol>${r.evidence
      .slice(-20)
      .map(
        (e) =>
          `<li><strong>${esc(e.source)}</strong> · ${esc(e.at || "Date unavailable")}<p>${esc(e.detail)}</p><small>Record: ${esc(e.record)}${e.unitId ? ` · Unit: ${esc(e.unitId)}` : ""}</small>${e.expected ? `<p>Expected source positions: ${esc(e.expected.join(", "))}<br>Selected source positions: ${esc(e.selected.join(", "))}</p>` : ""}</li>`,
      )
      .join("")}</ol></section>`;
    body.querySelector("[data-repair-launch]").onclick = () => launch(r);
    body.querySelector("[data-repair-recall]").onclick = () => study(r, true);
    body.querySelector("[data-repair-launch]").focus();
  }
  async function launch(r) {
    if (loading) return;
    clear();
    loading = true;
    const token = request;
    status("Checking verified content and preparing a bounded workspace…");
    try {
      const prepared = await prepareRepairMission({
        recommendation: r,
        client: ctx.client,
      });
      if (disposed || token !== request) return;
      guard();
      shell();
      const body = root.querySelector("[data-repair-body]");
      body.innerHTML = `<h3>${esc(r.title)} · ${esc(r.key)}</h3><p>Words ${prepared.workspace.firstWord}–${prepared.workspace.lastWord}: a visual study workspace, not an approved recitation stop. Use full-ayah audio and say each word aloud.</p><div data-repair-game></div>`;
      activityScope = new AbortController();
      const scope = activityScope;
      mission = await launchRepairMission({
        prepared,
        root: body.querySelector("[data-repair-game]"),
        storage,
        learning: createLearningStore(storage, library),
        lab: createPuzzleStore(storage, library),
        owner,
        getOwner: activeProfileId,
        client: ctx.client,
        signal: scope.signal,
        onComplete: (result) => summary(r, result),
        onExit: () => detail(r),
        onPractice: () => study(r),
        onRecall: () => study(r, true),
      });
      if (disposed || token !== request) {
        mission?.dispose();
        return;
      }
      loading = false;
    } catch (e) {
      if (!disposed && token === request) {
        loading = false;
        status(`${e.message} Saved history and review dates are unchanged.`);
      }
    }
  }
  function summary(r, result) {
    clear();
    shell();
    const body = root.querySelector("[data-repair-body]");
    body.innerHTML = `<section class="repair-summary"><span aria-hidden="true" class="repair-mended">✦ ━ ✦</span><h3>Connection practised</h3><p>Visual workspace ${esc(result.key)}, words ${result.workspace.firstWord}–${result.workspace.lastWord} · ${esc(result.game)}</p><p>${result.xp} XP on this saved receipt · ${result.mistakes} sequence mistakes · ${result.motorErrors} motor events · ${result.assistance} assistance uses</p><p>Replays do not add the same receipt’s XP again.</p><p>This is a practice result, not proof of memorization or a verified repair. Your FSRS schedule has not changed. The connection animation is cosmetic.</p><button data-repair-new-recall>Try a new independent recall</button><button data-repair-again>Practise again</button><button data-repair-home>Back to workshop</button></section>`;
    body.querySelector("[data-repair-new-recall]").onclick = () =>
      study(r, true);
    body.querySelector("[data-repair-again]").onclick = () => launch(r);
    body.querySelector("[data-repair-home]").onclick = render;
    body.querySelector("[data-repair-new-recall]").focus();
  }
  async function study(r = null, recall = false) {
    if (loading) return;
    clear();
    loading = true;
    const token = request;
    let unit =
      r?.evidence.find((e) => e.unit)?.unit ||
      (r ? { id: `ayah:${r.key}`, type: "ayah", refs: [r.key] } : null);
    // The existing unfinished assessment must resume rather than be overwritten.
    const snapshot = memory().snapshot();
    if (recall && snapshot.active && !snapshot.active.graded)
      unit = snapshot.records[snapshot.active.unitId].unit;
    try {
      if (unit) await verifyRescueUnit(unit, ctx.client);
      if (disposed || token !== request) return;
      guard();
      loading = false;
      studio = openPassageStudio({
        ...ctx,
        ...(unit
          ? {
              coachTarget: { refs: unit.refs, unit },
              coachAction: recall ? "review" : "practice",
            }
          : {}),
        onClose: () => {
          studio = null;
          if (!disposed) {
            render();
            root.querySelector("[data-repair-close]").focus();
          }
        },
      });
    } catch (e) {
      if (!disposed && token === request) {
        loading = false;
        status(`${e.message} No review was changed.`);
      }
    }
  }
  render();
  root.querySelector("[data-repair-close]").focus();
  return (activeWorkshop = { close, refresh: render });
}
