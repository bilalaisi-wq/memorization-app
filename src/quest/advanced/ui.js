import { canonicalSlice } from "../../../supabase/functions/_shared/segmentation.js";
import { esc } from "../../ui/dom.js";
import { catalog, availability, loadAudio } from "../../content/library.js";
import { surahs } from "../../data.js";
import {
  activeProfileId,
  profileStorage,
} from "../../learner/profile-storage.js";
import { createPassageMemory } from "../../passage/memory.js";
import { openPassageStudio } from "../../passage/ui.js";
import { verifyRescueUnit } from "../rescue/content.js";
import { createActivityScope } from "../accessibility.js";
import { createTransitions } from "../transitions.js";
import { createAudioManager } from "../../puzzles/arcade/services.js";
import { LAB_VOLUME_KEY, readLabVolume } from "../../puzzles/audio-level.js";
import { createRewardStore } from "../../rewards/store.js";
import {
  presets,
  survivalChoices,
  selectSurvival,
  buildRevisionPlan,
  verifyRevisionCheckpoint,
  discriminationOrder,
  revisionSummary,
  savedRevisionAssessment,
} from "./model.js";
import { createRevisionStore } from "./store.js";
import "./revision.css";
let active = null;
export function openAdvancedRevision(ctx = {}) {
  active?.close();
  const mode = ctx.mode === "survival" ? "survival" : "boss",
    title = mode === "boss" ? "Muraja’ah Boss Rush" : "Hifz Survival",
    owner = ctx.user?.id || null;
  let disposed = false,
    runId = null,
    studio = null,
    request = 0,
    loading = false,
    bundles = [],
    support = false,
    supportPage = 0,
    resource = null,
    audioRequest = 0,
    selection = new Set(),
    selectionPage = 0,
    setup = {};
  const guard = () => {
    if (disposed || activeProfileId() !== owner)
      throw Error("Account changed. Reopen advanced revision.");
  };
  guard();
  window.dispatchEvent(
    new CustomEvent("ayah-quest-surface", { detail: { name: "advanced" } }),
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
  const store = createRevisionStore({
      storage,
      owner,
      getOwner: activeProfileId,
    }),
    memory = () => createPassageMemory(storage);
  const root = document.createElement("section");
  root.className = `advanced-revision revision-${mode}`;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  root.tabIndex = -1;
  const before = document.activeElement,
    blocked = [...document.body.children]
      .filter((e) => e.tagName !== "SCRIPT")
      .map((e) => [e, e.inert]);
  blocked.forEach(([e]) => (e.inert = true));
  document.body.append(root);
  const scope = createActivityScope(root, {
      owner,
      getOwner: activeProfileId,
      onIdentityChange: () => close(),
    }),
    transition = createTransitions(root),
    audio = createAudioManager({
      owner: `revision-${mode}`,
      initialVolume: readLabVolume(localStorage),
    });
  function stop() {
    audioRequest++;
    audio.stop();
    resource?.revoke();
    resource = null;
  }
  function clear() {
    request++;
    loading = false;
    stop();
    bundles = [];
    support = false;
    supportPage = 0;
  }
  function close() {
    if (disposed) return;
    clear();
    disposed = true;
    studio?.close();
    scope.dispose();
    transition.dispose();
    audio.dispose();
    root.remove();
    blocked.forEach(([e, inert]) => {
      if (e.isConnected) e.inert = inert;
    });
    if (before?.isConnected) before.focus();
    if (active?.close === close) active = null;
  }
  scope.listen(window, "ayahprofilechange", () => {
    if (activeProfileId() !== owner) close();
  });
  scope.listen(window, "ayah-developer-mode", close);
  scope.listen(window, "pagehide", close);
  scope.listen(window, "ayah-quest-surface", (e) => {
    if (e.detail?.name !== "advanced") close();
  });
  scope.listen(document, "visibilitychange", () => {
    if (document.hidden) stop();
  });
  scope.listen(root, "keydown", (e) => {
    if (e.key === "Escape" && !studio) {
      e.preventDefault();
      close();
    }
    if (e.key === "Tab" && !studio) {
      const nodes = [
          ...root.querySelectorAll(
            'button:not(:disabled),input,select,a[href],[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length),
        first = nodes[0],
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
  function notice(text) {
    const el = root.querySelector("[data-rv-status]");
    if (el) el.textContent = text;
  }
  function shell() {
    root.innerHTML = `<header class="rv-header"><div><p class="rv-eyebrow">${mode === "boss" ? "FIVE GATES · A RISING CHALLENGE" : "REVISION TRAILS · COVERAGE & ENDURANCE"}</p><h2>${title}</h2><p>${mode === "boss" ? "Build from one opening to a complete independent passage." : "Carry your memorized passages through a steady, self-paced expedition."}</p></div><button data-rv-close>Close ✕</button></header><nav class="rv-nav"><button data-rv-lobby>← Choose a journey</button><label>Recitation volume <input type="range" min="0" max="1" step="0.05" value="${readLabVolume(localStorage)}" aria-label="Revision recitation volume" data-rv-volume></label><button data-rv-stop>Stop audio</button></nav><main data-rv-body></main><p role="status" data-rv-status></p>`;
    root.querySelector("[data-rv-close]").onclick = close;
    root.querySelector("[data-rv-lobby]").onclick = () => {
      runId = null;
      render();
      root.querySelector("[data-rv-close]").focus();
    };
    root.querySelector("[data-rv-stop]").onclick = stop;
    root.querySelector("[data-rv-volume]").oninput = (e) => {
      const level = Number(e.target.value);
      audio.setVolume(level);
      localStorage.setItem(LAB_VOLUME_KEY, String(level));
    };
    transition.enter();
  }
  const current = () => store.snapshot().runs[runId];
  function bind(selector, fn) {
    root.querySelector(selector)?.addEventListener("click", () =>
      Promise.resolve()
        .then(fn)
        .catch((e) => notice(e.message)),
    );
  }
  function runAction(fn) {
    guard();
    clear();
    fn();
    render();
    focusCurrent();
  }
  function render() {
    if (disposed) return;
    guard();
    const form = root.querySelector("[data-rv-form]");
    if (form) setup = Object.fromEntries(new FormData(form));
    clear();
    shell();
    try {
      if (runId) drawRun(current());
      else lobby();
    } catch (e) {
      notice(e.message);
      root.querySelector("[data-rv-body]").innerHTML =
        "<h3>Saved data is preserved</h3><p>Export your advanced revision data for recovery; do not reset existing learning records.</p><button data-rv-export>Export saved revision data</button>";
      bind("[data-rv-export]", () => {
        const blob = new Blob([store.exportRaw() || ""], {
            type: "application/json",
          }),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = "ayah-advanced-revision-recovery.json";
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }
  function lobby() {
    const body = root.querySelector("[data-rv-body]"),
      saved = Object.values(store.snapshot().runs)
        .filter((r) => r.plan.mode === mode)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 5);
    body.innerHTML = `<section class="rv-intro"><span class="rv-emblem" aria-hidden="true">${mode === "boss" ? "◈" : "⛺"}</span><h3>${mode === "boss" ? "Five gates. One honest final recall." : "Choose your material. Set your own pace."}</h3><p>${mode === "boss" ? "Opening → continuation → verified discrimination → consecutive ayahs → full independent recall. Again grades and wrong discrimination choices use game lives." : "Only existing independent Hard/Good/Easy recall records appear here. Due units are prioritized using saved dates, with no missed-day penalty."}</p><p>Self-assessed recitation is not speech certification. Navigation, assistance and time away never cost game lives. Actual recall grades use your existing scheduler.</p></section><form data-rv-form>${mode === "boss" ? bossForm() : survivalForm()}<label>Journey rules<select name="rules"><option value="practice">Practice · keep checkpoints</option><option value="classic">Classic · three charges for the run</option></select></label><button class="rv-primary" type="submit">${mode === "boss" ? "Enter the five gates" : "Start revision expedition"}</button></form><section><h3>Saved journeys</h3>${saved.length ? saved.map((r) => `<button class="rv-saved" data-rv-resume="${esc(r.id)}">${r.status === "paused" ? "Resume" : "Open"} · ${esc(r.plan.mode === "boss" ? r.plan.preset : r.plan.length)} · ${r.cursor}/${r.plan.checkpoints.length} stops · ${esc(r.status)}</button>`).join("") : "<p>No saved journeys yet.</p>"}</section>`;
    const form = body.querySelector("form");
    for (const [name, value] of Object.entries(setup)) {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      create(new FormData(form));
    };
    if (mode === "boss") {
      const s = form.querySelector("[name=surah]");
      s.onchange = () => {
        const first = consecutiveStart(Number(s.value));
        form.querySelector("[name=first]").value = first;
        form.querySelector("[name=last]").value = first + 1;
      };
    } else {
      body.querySelectorAll("[data-rv-unit]").forEach(
        (b) =>
          (b.onchange = () => {
            b.checked ? selection.add(b.value) : selection.delete(b.value);
            root.querySelector("[data-rv-selected]").textContent = String(
              selection.size,
            );
          }),
      );
      bind("[data-rv-due]", () => {
        selection = new Set(
          survivalChoices(memory().snapshot())
            .filter((r) => r.state !== "upcoming")
            .slice(0, 10)
            .map((r) => r.id),
        );
        render();
      });
      bind("[data-rv-prev]", () => {
        selectionPage = Math.max(0, selectionPage - 1);
        render();
      });
      bind("[data-rv-next]", () => {
        selectionPage++;
        render();
      });
    }
    body.querySelectorAll("[data-rv-resume]").forEach(
      (b) =>
        (b.onclick = () => {
          try {
            runId = b.dataset.rvResume;
            const r = current();
            if (r.status === "paused") store.resume(runId);
            render();
            root.querySelector("[data-rv-close]").focus();
          } catch (e) {
            notice(e.message);
          }
        }),
    );
  }
  const availableRefs = [
    ...new Set([
      ...surahs.flatMap((s) => s.verses.map((v) => `${s.id}:${v.id}`)),
      ...availability.premium.map((p) => p.key),
    ]),
  ];
  function consecutiveStart(surah) {
    const numbers = availableRefs
      .filter((k) => k.startsWith(`${surah}:`))
      .map((k) => Number(k.split(":")[1]))
      .sort((a, b) => a - b);
    return numbers.find((n, i) => numbers[i + 1] === n + 1);
  }
  function bossForm() {
    const chapters = catalog.chapters.filter((c) =>
      Number.isInteger(consecutiveStart(c.id)),
    );
    return `<label>Preset<select name="preset"><option value="beginner">Beginner · 2 choices, 2-ayah link</option><option value="standard">Standard · 3 choices, 3-ayah link</option><option value="expert">Expert · 4 choices, 4-ayah link</option></select></label><label>Surah<select name="surah">${chapters.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label>First ayah<input name="first" type="number" min="1" value="1" required></label><label>Last ayah<input name="last" type="number" min="2" value="2" required></label><p>Use material you have already studied. Only verified available references can launch. Private material still requires server authorization.</p>`;
  }
  function survivalForm() {
    const mem = memory(),
      choices = survivalChoices(mem.snapshot());
    selectionPage = Math.max(
      0,
      Math.min(selectionPage, Math.max(0, Math.ceil(choices.length / 20) - 1)),
    );
    return `<label>Route length<select name="length"><option value="short">Short · up to 3 units</option><option value="extended">Extended · up to 10 units, camps every 3</option></select></label>${mem.warning ? `<p role="alert">${esc(mem.warning)}</p>` : ""}<p><span data-rv-selected>${selection.size}</span> selected. Units are ordered due-first, then by the saved next-review date. Early reviews retain existing scheduling rules.</p><button type="button" data-rv-due>Select oldest due units</button><div class="rv-unit-list">${
      choices
        .slice(selectionPage * 20, selectionPage * 20 + 20)
        .map(
          (r) =>
            `<label><input type="checkbox" data-rv-unit value="${esc(r.id)}" ${selection.has(r.id) ? "checked" : ""}><span>${esc(r.unit.refs.join(" → "))}<small>${esc(r.unit.type)} · ${r.state === "upcoming" ? "Upcoming" : "Due for review"} · ${esc(r.due)}</small></span></label>`,
        )
        .join("") ||
      "<p>No eligible memorized units yet. Complete independent self-assessed recall in Passage Builder first.</p>"
    }</div><div><button type="button" data-rv-prev ${selectionPage === 0 ? "disabled" : ""}>Previous units</button> Page ${selectionPage + 1} <button type="button" data-rv-next ${(selectionPage + 1) * 20 >= choices.length ? "disabled" : ""}>More units</button></div>`;
  }
  async function create(data) {
    if (loading) return;
    guard();
    loading = true;
    const token = ++request;
    notice("Checking verified material and building checkpoints…");
    try {
      const preset = data.get("preset") || "beginner",
        first = Number(data.get("first")),
        last = Number(data.get("last")),
        chapter = Number(data.get("surah"));
      if (
        mode === "boss" &&
        (!Number.isInteger(first) ||
          !Number.isInteger(last) ||
          first < 1 ||
          last < first ||
          last - first + 1 > presets[preset].max)
      )
        throw Error(
          "Choose a valid consecutive range for the selected preset.",
        );
      const options =
        mode === "boss"
          ? {
              refs: Array.from(
                { length: last - first + 1 },
                (_, i) => `${chapter}:${first + i}`,
              ),
            }
          : {
              units: selectSurvival(memory().snapshot(), [...selection], {
                length: data.get("length"),
              }),
            };
      const { plan } = await buildRevisionPlan({
        mode,
        preset,
        rules: data.get("rules"),
        length: data.get("length") || "short",
        client: ctx.client,
        ...options,
      });
      if (disposed || token !== request) return;
      guard();
      runId = store.create(plan).id;
      render();
      root.querySelector("[data-rv-close]").focus();
    } catch (e) {
      if (!disposed && token === request) {
        loading = false;
        notice(e.message);
      }
    }
  }
  function drawRun(r) {
    const body = root.querySelector("[data-rv-body]"),
      c = r.plan.checkpoints[r.cursor],
      summary = revisionSummary(r);
    body.innerHTML = `<div class="rv-hud"><strong>${mode === "boss" ? "Gate" : "Route stop"} ${Math.min(r.cursor + 1, r.plan.checkpoints.length)} / ${r.plan.checkpoints.length}</strong><span class="rv-lanterns" aria-label="${r.charges} of 3 ${mode === "boss" ? "lives" : "lantern charges"}">${Array.from({ length: 3 }, (_, i) => `<span class="${i < r.charges ? "lit" : "spent"}" aria-hidden="true">${mode === "boss" ? "◆" : "✺"}</span>`).join("")}</span><span>${esc(r.plan.rules)} · ${summary.coverage} recall units covered</span></div>${mode === "boss" ? bossTower(r) : survivalTrail(r)}`;
    if (["won", "lost", "ended"].includes(r.status)) {
      body.innerHTML += endScreen(r);
      bind("[data-rv-retry]", () => runAction(() => store.retry(runId)));
      bind("[data-rv-repair]", async () => {
        const { openRepairWorkshop } = await import("../repair/ui.js");
        guard();
        openRepairWorkshop(ctx);
      });
      bind("[data-rv-revision]", async () => {
        const { openRescue } = await import("../rescue/ui.js");
        guard();
        openRescue(ctx);
      });
      return;
    }
    if (r.status === "paused") {
      body.innerHTML +=
        '<section class="rv-station"><h3>Rest safely here</h3><p>No lantern charge is lost for time away. Your exact checkpoint is saved.</p><button data-rv-continue>Resume journey</button></section>';
      bind("[data-rv-continue]", () => runAction(() => store.resume(runId)));
      return;
    }
    if (r.status === "camp") {
      body.innerHTML += `<section class="rv-station"><span class="rv-emblem" aria-hidden="true">⛺</span><h3>Campsite & recovery station</h3><p>${r.cursor} route stops reached. ${r.plan.rules === "practice" ? "Rest, refill three lantern charges and carry on." : "Classic preserves your remaining charges across camps."} Recovery does not alter recall grades or due dates.</p><button class="rv-primary" data-rv-camp>${r.plan.rules === "practice" ? "Rest & refill lanterns" : "Save campsite & continue"}</button><button data-rv-pause>Save & rest for later</button><button data-rv-end>Finish this session</button></section>`;
      bind("[data-rv-camp]", () => runAction(() => store.camp(runId)));
      bindCommon();
      return;
    }
    body.innerHTML += `<section class="rv-challenge"><h3>${esc(c.title)}</h3><p>${c.kind === "recall" ? esc(c.unit.refs.join(" → ")) : "Choose the canonical passage opening belonging to " + esc(c.target)}</p><p>${c.kind === "recall" ? (c.requireIndependent ? "This final gate requires an independent Hard, Good or Easy self-grade. Assistance never costs a life; assisted results can be retried." : c.cue ? "Continue after " + esc(c.cue) + ". Recite the complete following ayah, then compare. No draft boundary is a recitation stop." : "Recite the complete specified ayah or passage from memory, then compare and self-grade.") : "Observed text discrimination only: a correct choice is not spoken recall or an FSRS review."}</p><div data-rv-task>${c.kind === "recall" ? `<button class="rv-primary" data-rv-recall>${pendingResult(r) ? "Apply saved self-assessment" : r.pending ? "Resume self-assessment" : "Begin self-assessed recall"}</button>${r.pending ? "<button data-rv-apply>Apply saved assessment</button>" : ""}` : r.choiceLocked ? "<p>That choice was not the target reference. One game life used; no recall grade was recorded.</p><button data-rv-unlock>Try the gate again</button>" : '<button class="rv-primary" data-rv-choices>Explore verified choices</button>'}</div><p class="rv-assistance">${r.assisted ? "Support used for this checkpoint: the next assessment is assisted." : "No journey support used for this checkpoint. The native assessment records its own listening/reference assistance."}</p><button data-rv-support>Study support · verified text & audio</button>${r.assisted && !r.pending ? "<button data-rv-fresh>Hide support & start a fresh attempt</button>" : ""}<div data-rv-support-panel></div><div class="rv-actions"><button data-rv-pause>Save & rest for later</button><button data-rv-end>Finish this session</button></div></section>`;
    bind("[data-rv-recall]", recall);
    bind("[data-rv-apply]", applySaved);
    bind("[data-rv-choices]", showChoices);
    bind("[data-rv-unlock]", () => runAction(() => store.unlock(runId)));
    bind("[data-rv-support]", showSupport);
    bind("[data-rv-fresh]", () => runAction(() => store.fresh(runId)));
    bindCommon();
    const last = r.results.at(-1);
    if (last?.kind === "recall" && last.checkpointId === c.id && !r.pending)
      notice(
        `${last.independent ? "Independent" : "Assisted"} ${last.grade} self-assessment saved. ${c.requireIndependent && !last.independent ? "Hide supports and try a fresh independent attempt; no life lost for assistance." : last.grade === "Again" ? "One game charge used. The actual review is saved." : "Continue at your own pace."}`,
      );
  }
  function bindCommon() {
    bind("[data-rv-pause]", () => runAction(() => store.pause(runId)));
    bind("[data-rv-end]", () => runAction(() => store.end(runId)));
  }
  function bossTower(r) {
    return `<ol class="rv-tower" aria-label="Five progressive gates">${r.plan.checkpoints
      .map((c, i) => {
        const result = r.results.filter((x) => x.checkpointId === c.id).at(-1);
        const outcome =
          result?.kind === "recall"
            ? `${result.independent ? "Independent" : "Assisted"} self-grade · ${result.grade}`
            : "Observed text choice · not recall";
        return `<li data-rv-gate="${i}" class="${i < r.cursor ? "cleared" : i === r.cursor ? "current" : ""}"><span aria-hidden="true">${i < r.cursor ? "✦" : "◈"}</span><strong>${i + 1}. ${esc(c.title)}</strong><small>${i < r.cursor ? esc(outcome) : i === r.cursor ? "Current challenge" : "Ahead"}</small></li>`;
      })
      .join("")}</ol>`;
  }
  function survivalTrail(r) {
    return `<div class="rv-trail" aria-label="Expedition trail">${r.plan.checkpoints.map((c, i) => `<span class="${i < r.cursor ? "visited" : i === r.cursor ? "current" : ""}"><b aria-hidden="true">${i < r.cursor ? "✦" : "○"}</b><small>${i + 1}</small>${(i + 1) % 3 === 0 ? '<em aria-label="Campsite">⛺</em>' : ""}</span>`).join("")}</div><p>Coverage trail: every stop is one saved recall unit. Lanterns measure this expedition, not your memory strength.</p>`;
  }
  function endScreen(r) {
    const s = revisionSummary(r);
    return `<section class="rv-summary ${r.status === "won" ? "rv-victory" : ""}"><span class="rv-emblem" aria-hidden="true">${r.status === "won" ? "✦" : r.status === "lost" ? "◇" : "⛺"}</span><h3>${r.status === "won" ? (mode === "boss" ? "Five gates complete" : "Expedition complete") : r.status === "lost" ? "Time to recover" : "Session saved and finished"}</h3><p>${r.status === "lost" ? "Three game charges used. Your actual reviews and progress remain saved. Retry at a Practice checkpoint or restart Classic; there is no penalty for taking a break." : mode === "boss" ? "Gate outcomes below separate text discrimination, supported self-assessment and independent self-assessment." : "Your expedition emphasizes material covered, not a claim of certified memorization."}</p><div class="rv-summary-stats"><span>${s.coverage} distinct recall units covered</span><span>${s.independent} independent self-assessments</span><span>${s.assisted} assisted self-assessments</span><span>${s.difficult} Again / Hard results</span><span>${s.scheduled} actual scheduled reviews</span><span>${r.supportUses} support visits</span></div><details><summary>Recorded outcomes (${r.results.length})</summary><ol>${r.results.map((x) => `<li>${esc(x.kind === "recall" ? `${x.unitId} · ${x.grade} · ${x.independent ? "independent" : "assisted"} · ${x.scheduled ? "scheduled" : "due date preserved"}` : `Text discrimination · ${x.correct ? "correct" : "incorrect"} · not a recall grade`)}</li>`).join("")}</ol></details>${r.status === "lost" ? '<button class="rv-primary" data-rv-retry>Recover & retry</button>' : ""}<div class="rv-actions">${s.difficult ? "<button data-rv-repair>Repair difficult connections</button>" : ""}<button data-rv-revision>Open due-review constellation</button></div><p>Game lives never rewrite FSRS outcomes. No automatic speech or tajweed certification is performed.</p></section>`;
  }
  async function verified() {
    const r = current(),
      index = r.cursor;
    const token = ++request;
    loading = true;
    notice("Checking current verified source and access…");
    const all = await verifyRevisionCheckpoint(r.plan, index, ctx.client);
    if (disposed || token !== request) return null;
    guard();
    loading = false;
    bundles = all;
    return { r, index, c: r.plan.checkpoints[index], all, token };
  }
  async function showChoices() {
    if (loading) return;
    try {
      const v = await verified();
      if (!v) return;
      const task = root.querySelector("[data-rv-task]");
      task.innerHTML = `<p>${esc(v.c.similarity)}. These are exact canonical opening previews, not approved recitation stops.</p><div class="rv-choices">${discriminationOrder(
        v.r.plan,
        v.index,
      )
        .map((key, i) => {
          const b = v.all.find((b) => b.key === key),
            words = b.words.slice(0, 12);
          return `<button data-rv-choice="${esc(key)}" aria-label="Choose continuation ${i + 1}"><span class="arabic" dir="rtl" lang="ar">${esc(canonicalSlice(b, 1, words.length))}</span><small>Words 1–${words.length}${b.words.length > 12 ? " of " + b.words.length + " (opening preview)" : ""}</small></button>`;
        })
        .join("")}</div>`;
      task.querySelectorAll("[data-rv-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            try {
              guard();
              const r = current(),
                c = r.plan.checkpoints[r.cursor];
              if (b.dataset.rvChoice === c.target)
                createRewardStore(storage).award({
                  mode: "passage",
                  unit: c.target,
                  action: "boss-discrimination",
                  xp: 4,
                  receiptId: c.id,
                });
              store.choose(runId, b.dataset.rvChoice);
              render();
              focusCurrent();
            } catch (e) {
              notice(e.message);
            }
          }),
      );
    } catch (e) {
      loading = false;
      notice(e.message);
    }
  }
  async function showSupport() {
    if (loading) return;
    try {
      const v = await verified();
      if (!v) return;
      store.assist(runId);
      // Record exposure before showing text, including a declared unfinished attempt.
      const memoryStore = memory(),
        snapshot = memoryStore.snapshot(),
        pending = snapshot.active;
      if (
        pending &&
        !pending.graded &&
        snapshot.records[pending.unitId].unit.refs.some((key) =>
          v.all.some((b) => b.key === key),
        )
      )
        memoryStore.update("abandon");
      support = true;
      supportPage = 0;
      root.querySelector(".rv-assistance").textContent =
        "Support used: the next matching assessment will be assisted. You can hide supports and begin a fresh attempt after finishing any pending assessment.";
      drawSupport();
    } catch (e) {
      loading = false;
      notice(e.message);
    }
  }
  function drawSupport() {
    if (!support || !bundles.length) return;
    const panel = root.querySelector("[data-rv-support-panel]"),
      b = bundles[supportPage];
    panel.innerHTML = `<section class="rv-support"><h4>Supported study · ${esc(b.key)}</h4><p class="arabic" dir="rtl" lang="ar">${esc(b.textUthmani)}</p><p>Complete verified ayah. Visual workspaces are not guidance about recitation stops.</p><button data-rv-listen>Listen to full ayah</button><button data-rv-support-prev ${supportPage === 0 ? "disabled" : ""}>Previous ayah</button><button data-rv-support-next ${supportPage === bundles.length - 1 ? "disabled" : ""}>Next ayah</button><button data-rv-hide>Hide study panel</button></section>`;
    bind("[data-rv-listen]", async () => {
      const token = ++request;
      stop();
      const audioToken = audioRequest;
      const asset = await loadAudio(b, ctx.client);
      if (disposed || token !== request || audioToken !== audioRequest) {
        asset.revoke();
        return;
      }
      guard();
      resource = asset;
      const played = await audio.play(asset.url);
      if (
        !played &&
        !disposed &&
        token === request &&
        audioToken === audioRequest
      )
        notice(
          "Recitation could not play. Continue without audio; no game charge was used.",
        );
    });
    bind("[data-rv-support-prev]", () => {
      stop();
      request++;
      supportPage--;
      drawSupport();
    });
    bind("[data-rv-support-next]", () => {
      stop();
      request++;
      supportPage++;
      drawSupport();
    });
    bind("[data-rv-hide]", () => {
      stop();
      request++;
      support = false;
      panel.replaceChildren();
      render();
    });
  }
  function pendingResult(r) {
    if (!r.pending) return false;
    try {
      const result = savedRevisionAssessment(memory().snapshot(), r);
      return !store.snapshot().consumed.includes(result.attemptId);
    } catch {
      return false;
    }
  }
  async function recall() {
    if (loading) return;
    try {
      const v = await verified();
      if (!v) return;
      if (pendingResult(v.r)) {
        store.apply(runId, memory().snapshot());
        render();
        focusCurrent();
        notice(
          "Saved self-assessment applied once. No new grade was recorded.",
        );
        return;
      }
      const mem = memory().snapshot(),
        a = mem.active;
      if (a && !a.graded && a.unitId !== v.c.unit.id) {
        notice(
          "A different self-assessment is unfinished. Finish it first; it will not clear this gate.",
        );
        const other = mem.records[a.unitId].unit;
        await verifyRescueUnit(other, ctx.client);
        if (disposed || v.token !== request) return;
        studio = openPassageStudio({
          ...ctx,
          coachTarget: { refs: other.refs, unit: other },
          coachAction: "review",
          onClose: afterStudio,
        });
        return;
      }
      store.begin(runId);
      stop();
      studio = openPassageStudio({
        ...ctx,
        coachTarget: { refs: v.c.unit.refs, unit: v.c.unit },
        coachAction: "review",
        assessmentAssisted: current().assisted,
        onAssessmentSaved: () => {
          try {
            store.apply(runId, memory().snapshot());
          } catch (e) {
            notice(
              `${e.message} The actual recall result is saved. Use Apply saved assessment to retry.`,
            );
          }
        },
        onClose: afterStudio,
      });
    } catch (e) {
      loading = false;
      notice(e.message);
    }
  }
  function focusCurrent() {
    const target =
      root.querySelector("[data-rv-recall]") ||
      root.querySelector("[data-rv-choices]") ||
      root.querySelector("[data-rv-unlock]") ||
      root.querySelector("[data-rv-camp]") ||
      root.querySelector("[data-rv-continue]") ||
      root.querySelector(".rv-summary") ||
      root.querySelector("[data-rv-close]");
    if (target && !target.matches("button,input,select")) target.tabIndex = -1;
    target?.focus();
  }
  function afterStudio() {
    studio = null;
    if (disposed) return;
    render();
    focusCurrent();
  }
  async function applySaved() {
    if (loading) return;
    try {
      const v = await verified();
      if (!v) return;
      store.apply(runId, memory().snapshot());
      render();
      focusCurrent();
    } catch (e) {
      loading = false;
      notice(e.message);
    }
  }
  render();
  root.querySelector("[data-rv-close]").focus();
  return (active = { close });
}
