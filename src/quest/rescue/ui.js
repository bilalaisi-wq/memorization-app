import { esc } from "../../ui/dom.js";
import { catalog } from "../../content/library.js";
import {
  activeProfileId,
  profileStorage,
} from "../../learner/profile-storage.js";
import {
  createPassageMemory,
  PASSAGE_MEMORY_KEY,
} from "../../passage/memory.js";
import { openPassageStudio } from "../../passage/ui.js";
import { rescueMap, dailyRoute, savedReview } from "./model.js";
import { verifyRescueUnit } from "./content.js";
import "./rescue.css";
let activeRescue = null;
const stateLabels = {
  upcoming: "Upcoming",
  due: "Ready today",
  overdue: "Waiting for review",
};
export function openRescue(ctx = {}) {
  activeRescue?.close();
  const owner = ctx.user?.id || null;
  let disposed = false,
    studio = null,
    request = 0,
    selected = null,
    page = 0,
    filter = "all",
    limit = 5,
    route = null,
    feedback = null,
    skipMotion = false,
    loading = false;
  const seenAttempts = new Set(),
    restored = new Map(),
    pendingRestorations = new Set(),
    blockedIds = new Set();
  const root = document.createElement("section");
  root.className = "constellation-rescue";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Constellation Rescue");
  root.tabIndex = -1;
  function guard() {
    if (disposed || activeProfileId() !== owner)
      throw Error("Account changed. Reopen Constellation Rescue.");
  }
  guard();
  window.dispatchEvent(
    new CustomEvent("ayah-quest-surface", { detail: { name: "rescue" } }),
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
  const before = document.activeElement,
    blocked = [...document.body.children]
      .filter((el) => el.tagName !== "SCRIPT")
      .map((el) => [el, el.inert]);
  blocked.forEach(([el]) => (el.inert = true));
  document.body.append(root);
  const controller = new AbortController(),
    media = matchMedia("(prefers-reduced-motion: reduce)");
  let projection = null,
    documentState = null,
    warning = "";
  const listen = (target, type, handler) =>
    target.addEventListener(type, handler, { signal: controller.signal });
  function memory() {
    return createPassageMemory(storage);
  }
  function read() {
    guard();
    const store = memory();
    warning = store.warning;
    documentState = store.snapshot();
    projection = rescueMap(documentState);
  }
  function notice(text, error = false) {
    if (disposed) return;
    const node = root.querySelector("[data-cr-status]");
    node.textContent = text;
    node.dataset.error = String(error);
  }
  function motion() {
    root.dataset.motionOff = String(skipMotion || media.matches);
    if (skipMotion || media.matches)
      root.getAnimations({ subtree: true }).forEach((a) => a.cancel());
  }
  function close() {
    if (disposed) return;
    request++;
    loading = false;
    disposed = true;
    studio?.close();
    studio = null;
    controller.abort();
    media.removeEventListener("change", motion);
    clearInterval(timer);
    root.remove();
    blocked.forEach(([el, inert]) => {
      if (el.isConnected) el.inert = inert;
    });
    before?.focus?.();
    if (activeRescue?.close === close) activeRescue = null;
  }
  function title(unit) {
    const first = unit.refs[0],
      surah = Number(first.split(":")[0]);
    return `${catalog.chapters.find((c) => c.id === surah)?.name || "Quran"} · ${unit.type === "passage" ? "Passage" : unit.type === "segment" ? "Reviewed portion" : "Ayah"}`;
  }
  function refs(unit) {
    return unit.refs.join(" → ");
  }
  function date(value) {
    return value
      ? new Date(value).toLocaleString(undefined, {
          timeZone: projection.timeZone,
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not independently scheduled";
  }
  function exportData() {
    try {
      const raw = storage.getItem(PASSAGE_MEMORY_KEY),
        url = URL.createObjectURL(
          new Blob([raw || "{}"], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "ayah-passage-review-recovery.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notice(e.message, true);
    }
  }
  root.innerHTML = `<header class="cr-header"><button data-cr-close>← Your space</button><div class="cr-brand"><span aria-hidden="true">✦</span><span>AYAH QUEST<small>CONSTELLATION RESCUE</small></span></div><button data-cr-motion aria-pressed="false">Skip animations</button></header><p data-cr-status class="cr-status" role="status" aria-live="polite"></p><div data-cr-body></div>`;
  const body = root.querySelector("[data-cr-body]");
  root.querySelector("[data-cr-close]").onclick = close;
  root.querySelector("[data-cr-motion]").onclick = (e) => {
    skipMotion = !skipMotion;
    e.currentTarget.setAttribute("aria-pressed", String(skipMotion));
    e.currentTarget.textContent = skipMotion
      ? "Animations off"
      : "Skip animations";
    motion();
  };
  motion();
  media.addEventListener("change", motion);
  listen(window, "ayahprofilechange", () => {
    if (activeProfileId() !== owner) close();
  });
  listen(window, "ayah-developer-mode", close);
  listen(window, "pagehide", close);
  listen(window, "ayah-quest-surface", (e) => {
    if (e.detail?.name !== "rescue") close();
  });
  listen(window, "storage", (e) => {
    if (e.key?.endsWith(PASSAGE_MEMORY_KEY) && !studio) refresh();
  });
  listen(root, "keydown", (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const controls = [
      ...root.querySelectorAll("button:not(:disabled),select,a[href]"),
    ].filter((el) => el.getClientRects().length);
    if (e.key === "Tab") {
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key) &&
      e.target.closest("[data-cr-star]")
    ) {
      e.preventDefault();
      const nodes = [...root.querySelectorAll("[data-cr-star]")],
        i = nodes.indexOf(e.target.closest("[data-cr-star]")),
        delta =
          { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key] ||
          0;
      nodes[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? nodes.length - 1
            : Math.max(0, Math.min(nodes.length - 1, i + delta))
      ]?.focus();
    }
  });
  function render() {
    const focused = document.activeElement?.dataset.crStar;
    const { stars, queue, counts } = projection;
    if (!selected || !stars.some((s) => s.id === selected))
      selected = queue[0]?.id || stars[0]?.id || null;
    const filtered = stars.filter(
        (s) =>
          filter === "all" ||
          (filter === "ready" && s.state !== "upcoming") ||
          s.state === filter,
      ),
      pages = Math.max(1, Math.ceil(filtered.length / 24));
    page = Math.min(page, pages - 1);
    const visible = filtered.slice(page * 24, page * 24 + 24);
    const waiting =
      route?.ids.filter(
        (id) =>
          !route.done.has(id) &&
          !route.skip.has(id) &&
          queue.some((s) => s.id === id),
      ) || [];
    body.innerHTML = `<section class="cr-intro"><p class="cr-kicker">YOUR REVISION SKY</p><h1>Return to your stars.</h1><p>A calm route through the passages you have recalled independently.<br>Each star follows its saved review date. Its brightness is not a judgment of your memory.</p></section>${warning ? `<section class="cr-recovery" role="alert"><h2>Saved reviews need recovery</h2><p>${esc(warning)}</p><button data-cr-export>Export the original review document</button><button data-cr-classic>Open Classic Passage Builder</button></section>` : ""}<section class="cr-summary" aria-label="Saved review schedule"><div><strong>${counts.due}</strong><span>Ready today</span></div><div><strong>${counts.overdue}</strong><span>Waiting from earlier days</span></div><div><strong>${counts.upcoming}</strong><span>Upcoming</span></div><p>There is no penalty for missing a day.<br>Come back when you can.</p></section><div class="cr-layout"><section class="cr-sky-panel"><div class="cr-map-heading"><div><p class="cr-kicker">${stars.length} INDEPENDENTLY RECALLED UNITS</p><h2>Your constellation</h2></div><label>Show<select data-cr-filter><option value="all">All stars</option><option value="ready">Due &amp; waiting</option><option value="upcoming">Upcoming</option></select></label></div><p class="cr-fine">Positions are decorative. Dates come from your existing passage scheduler.</p><div class="cr-sky" role="group" aria-label="Passage revision stars">${visible.length ? `<svg data-cr-lines aria-hidden="true"><path/></svg><div class="cr-star-grid">${visible.map((s) => `<button data-cr-star="${esc(s.id)}" class="cr-star ${s.state} ${s.id === selected ? "is-selected" : ""} ${restored.has(s.id) && Date.now() - restored.get(s.id) < 2500 ? "was-reviewed" : ""}" aria-pressed="${s.id === selected}" aria-label="${esc(title(s.unit) + " " + refs(s.unit) + " · " + stateLabels[s.state] + " · " + date(s.due))}"><span class="cr-star-icon" aria-hidden="true">✦</span><strong>${esc(s.unit.refs.length > 2 ? s.unit.refs[0] + " + " + (s.unit.refs.length - 1) : refs(s.unit))}</strong><small>${stateLabels[s.state]}</small></button>`).join("")}</div>` : `<div class="cr-empty"><span aria-hidden="true">☾</span><h3>${stars.length ? "No stars in this view yet." : "Your sky starts with real recall."}</h3><p>${stars.length ? "Choose All stars to see your saved units." : "Complete an independent self-assessment in Passage Builder or Passage Expedition. Puzzle wins and listening alone do not create a review star."}</p><button data-cr-expedition>Begin a Passage Expedition</button></div>`}</div><div class="cr-map-footer"><p>Teal: ready · Violet: upcoming · Gold outline: waiting<br>Waiting does not mean forgotten.</p>${pages > 1 ? `<div><button data-cr-prev ${page === 0 ? "disabled" : ""}>Previous stars</button><span>${page + 1} / ${pages}</span><button data-cr-next ${page + 1 === pages ? "disabled" : ""}>Next stars</button></div>` : ""}</div></section><aside class="cr-detail" data-cr-detail></aside></div><section class="cr-route"><div><p class="cr-kicker">A LITTLE REVISION, AT YOUR PACE</p><h2>${route ? "Your guided route" : "Today’s gentle route"}</h2><p>${route ? `${route.done.size} scheduled reviews recorded in this route · ${waiting.length} ready steps remain.` : `${queue.length} units are due now. Start with the oldest saved due date.`}</p><p class="cr-fine">Estimated focus: about two minutes per unit. Dates and grades stay with the existing scheduler.</p></div><label>Route size<select data-cr-limit><option value="3">Up to 3 units</option><option value="5">Up to 5 units</option><option value="10">Up to 10 units</option><option value="15">Up to 15 units</option></select></label><button class="cr-primary" data-cr-start ${!queue.length || loading || warning ? "disabled" : ""}>${route && waiting.length ? "Continue route →" : route ? "Start another due route" : "Start due-review route →"}</button>${route ? `<button data-cr-skip ${!waiting.includes(selected) || (documentState.active && !documentState.active.graded) ? "disabled" : ""}>Skip selected unit for this route</button>` : ""}<ol class="cr-queue">${
      queue
        .slice(0, 50)
        .map(
          (s) =>
            `<li><button data-cr-queue="${esc(s.id)}"><span aria-hidden="true">✧</span><span><b>${esc(title(s.unit))}</b><small>${esc(refs(s.unit))} · Scheduled ${esc(date(s.due))}</small></span><em>${stateLabels[s.state]}</em></button></li>`,
        )
        .join("") ||
      '<li class="cr-fine">Nothing is due right now. Upcoming stars will be ready on their saved dates. Early practice keeps those dates unchanged unless you explicitly self-grade Again.</li>'
    }</ol>${queue.length > 50 ? "<p>Showing the first 50 queued units; completed reviews reveal the next ones.</p>" : ""}</section>${projection.unavailable.length ? `<p class="cr-fine">${projection.unavailable.length} saved units await supported source availability. Their records and dates are preserved.</p>` : ""}${projection.notYet.length ? `<p class="cr-fine">${projection.notYet.length} other study records do not yet have both a saved schedule and a successful independent recall. They are preserved, but do not create stars.</p>` : ""}<footer class="cr-bottom"><button data-cr-export>Export passage review history</button><button data-cr-classic>Classic Passage Builder</button><button data-cr-expedition>Passage Expedition</button><p>Self-assessed recitation, not automatic speech or tajweed verification. Puzzle progress remains separate.</p></footer>`;
    root.querySelector("[data-cr-filter]").value = filter;
    root.querySelector("[data-cr-filter]").onchange = (e) => {
      filter = e.target.value;
      page = 0;
      render();
    };
    root.querySelector("[data-cr-limit]").value = String(limit);
    root.querySelector("[data-cr-limit]").onchange = (e) => {
      limit = Number(e.target.value);
    };
    root.querySelectorAll("[data-cr-star],[data-cr-queue]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.crStar || b.dataset.crQueue;
          filter = "all";
          page = Math.floor(
            projection.stars.findIndex((s) => s.id === selected) / 24,
          );
          render();
        }),
    );
    root.querySelector("[data-cr-prev]")?.addEventListener("click", () => {
      page--;
      render();
    });
    root.querySelector("[data-cr-next]")?.addEventListener("click", () => {
      page++;
      render();
    });
    root.querySelector("[data-cr-start]").onclick = () => {
      if (!route || !waiting.length)
        route = {
          ids: dailyRoute(projection, { limit, skip: [...blockedIds] }),
          done: new Set(),
          skip: new Set(),
        };
      const id = route.ids.find(
        (id) =>
          !route.done.has(id) &&
          !route.skip.has(id) &&
          projection.queue.some((s) => s.id === id) &&
          !blockedIds.has(id),
      );
      if (id) review(projection.stars.find((s) => s.id === id).unit);
      else
        notice(
          "No accessible due units remain in this route. Your saved dates are unchanged.",
        );
    };
    root.querySelector("[data-cr-skip]")?.addEventListener("click", () => {
      route.skip.add(selected);
      render();
      notice(
        "Skipped for this route only. No due date, grade or memory record changed.",
      );
    });
    root
      .querySelectorAll("[data-cr-export]")
      .forEach((b) => (b.onclick = exportData));
    root
      .querySelectorAll("[data-cr-classic]")
      .forEach((b) => (b.onclick = () => classic()));
    root.querySelectorAll("[data-cr-expedition]").forEach(
      (b) =>
        (b.onclick = async () => {
          const { openExpedition } = await import("../expedition/ui.js");
          if (disposed) return;
          close();
          openExpedition(ctx);
        }),
    );
    detail();
    connect();
    if (focused)
      [...root.querySelectorAll("[data-cr-star]")]
        .find((b) => b.dataset.crStar === focused)
        ?.focus({ preventScroll: true });
  }
  function detail() {
    const panel = root.querySelector("[data-cr-detail]"),
      star = projection.stars.find((s) => s.id === selected);
    if (!star) {
      panel.innerHTML =
        '<p class="cr-kicker">A KINDER RETURN</p><h2>No missed-day penalties.</h2><p>Independent recall creates the schedule. Showing this dashboard never changes a card, adds a lapse or awards memorization.</p><p>Begin with supported study, then recite and compare when ready.</p>';
      return;
    }
    const current = feedback?.id === star.id ? feedback : null;
    panel.innerHTML = `<p class="cr-kicker">${stateLabels[star.state].toUpperCase()}</p><h2>${esc(title(star.unit))}</h2><p class="cr-refs">${esc(refs(star.unit))}</p>${star.unit.type === "segment" ? `<p class="cr-fine">Reviewed words ${star.unit.firstWord}–${star.unit.lastWord}. Source and boundary revision will be checked before opening.</p>` : ""}<dl><dt>Saved next review</dt><dd data-cr-due>${esc(date(star.due))}</dd><dt>Last self-assessment</dt><dd>${esc(star.latestGrade || "—")} · ${esc(date(star.lastReviewed))}</dd><dt>Independent attempts recorded</dt><dd>${star.independentReviews}</dd></dl><p class="cr-fine">This date is read directly from your passage review card. A star’s display state does not diagnose forgetting.</p>${current ? `<p class="cr-review-result" role="status">${esc(current.message)}</p>` : ""}${blockedIds.has(star.id) ? '<p class="cr-warning">Source access is unavailable. Saved progress remains intact.</p>' : ""}<button class="cr-primary" data-cr-review ${loading || warning ? "disabled" : ""}>${star.state === "upcoming" ? "Open early self-assessment" : "Recite from memory →"}</button><button data-cr-practice ${loading || warning ? "disabled" : ""}>${star.needsPractice ? "Corrective practice · listen & rebuild" : "Listen & rebuild in practice"}</button>${star.needsPractice ? '<p class="cr-practice-tip">Again or Hard? Revisit the words, say them aloud after the reciter, connect the passage, then return for independent recall. Assistance is welcome and never a missed-day penalty.</p>' : ""}<p class="cr-fine">Private source access is verified on the server each time. Listening before declaring recall makes that assessment assisted.</p>`;
    panel.querySelector("[data-cr-review]").onclick = () => review(star.unit);
    panel.querySelector("[data-cr-practice]").onclick = () =>
      practice(star.unit);
  }
  function connect() {
    const svg = root.querySelector("[data-cr-lines]");
    if (!svg) return;
    const grid = root.querySelector(".cr-star-grid"),
      rect = grid.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${grid.clientWidth} ${grid.scrollHeight}`);
    svg.style.height = grid.scrollHeight + "px";
    svg.style.transform = `translateY(${-grid.scrollTop}px)`;
    grid.onscroll = () => {
      svg.style.transform = `translateY(${-grid.scrollTop}px)`;
    };
    svg.querySelector("path").setAttribute(
      "d",
      [...grid.querySelectorAll(".cr-star-icon")]
        .map((s, i) => {
          const r = s.getBoundingClientRect();
          return `${i ? "L" : "M"} ${r.left - rect.left + r.width / 2} ${r.top - rect.top + grid.scrollTop + r.height / 2}`;
        })
        .join(" "),
    );
  }
  function refresh() {
    if (disposed) return;
    try {
      read();
      render();
    } catch (e) {
      notice(e.message, true);
    }
  }
  function handleSaved() {
    if (disposed) return;
    try {
      guard();
      const data = memory().snapshot(),
        active = data.active,
        event = savedReview(data, active?.id);
      if (!event || seenAttempts.has(event.attempt.attemptId)) {
        refresh();
        return;
      }
      seenAttempts.add(event.attempt.attemptId);
      const independent = event.attempt.independent,
        scheduled = event.attempt.scheduled;
      let message =
        independent && scheduled
          ? `${event.attempt.grade} self-assessment saved. Next review: ${date(event.nextReview)}.`
          : independent
            ? `Early self-assessment saved. Your existing review date is preserved: ${date(event.nextReview)}.`
            : "Assisted self-assessment saved. Independent recall was not scheduled; your prior due date is preserved.";
      if (["Again", "Hard"].includes(event.attempt.grade))
        message += " Gentle corrective practice is available.";
      feedback = { id: event.id, message };
      selected = event.id;
      filter = "all";
      if (independent && scheduled) {
        pendingRestorations.add(event.id);
        if (route?.ids.includes(event.id)) route.done.add(event.id);
      }
      refresh();
      notice(message);
    } catch (e) {
      notice(e.message, true);
    }
  }
  function afterStudioClose() {
    studio = null;
    if (disposed) return;
    for (const id of pendingRestorations) restored.set(id, Date.now());
    pendingRestorations.clear();
    try {
      read();
      const index = projection.stars.findIndex((s) => s.id === selected);
      if (index >= 0) page = Math.floor(index / 24);
      render();
      const anchor =
        [...root.querySelectorAll("[data-cr-star]")].find(
          (b) => b.dataset.crStar === selected,
        ) || root.querySelector("[data-cr-close]");
      anchor?.focus();
    } catch (e) {
      notice(e.message, true);
    }
  }
  async function review(unit) {
    if (loading || disposed) return;
    guard();
    read();
    const pending = documentState.active;
    if (pending && !pending.graded) {
      unit = documentState.records[pending.unitId].unit;
      notice(
        "Resuming your unfinished self-assessment before starting another unit.",
      );
    }
    loading = true;
    const token = ++request;
    render();
    notice(`Checking verified source access for ${refs(unit)}…`);
    try {
      await verifyRescueUnit(unit, ctx.client);
      if (disposed || token !== request) return;
      guard();
      loading = false;
      blockedIds.delete(unit.id);
      selected = unit.id;
      studio = openPassageStudio({
        ...ctx,
        coachTarget: { refs: unit.refs, unit },
        coachAction: "review",
        onAssessmentSaved: handleSaved,
        onClose: afterStudioClose,
      });
    } catch (e) {
      if (!disposed && token === request) {
        loading = false;
        blockedIds.add(unit.id);
        refresh();
        notice(
          e.message + " Your review history and due date are unchanged.",
          true,
        );
      }
    }
  }
  async function practice(unit) {
    if (loading || disposed) return;
    guard();
    loading = true;
    const token = ++request;
    render();
    notice("Checking the source for corrective practice…");
    try {
      await verifyRescueUnit(unit, ctx.client);
      if (disposed || token !== request) return;
      guard();
      loading = false;
      studio = openPassageStudio({
        ...ctx,
        coachTarget: { refs: unit.refs, unit },
        coachAction: "practice",
        onAssessmentSaved: handleSaved,
        onClose: afterStudioClose,
      });
    } catch (e) {
      if (!disposed && token === request) {
        loading = false;
        refresh();
        notice(e.message + " Saved reviews remain unchanged.", true);
      }
    }
  }
  function classic() {
    if (disposed) return;
    studio = openPassageStudio({
      ...ctx,
      onAssessmentSaved: handleSaved,
      onClose: afterStudioClose,
    });
  }
  listen(window, "resize", connect);
  const timer = setInterval(() => {
    if (!document.hidden && !studio && !loading) refresh();
  }, 30000);
  refresh();
  root.querySelector("[data-cr-close]").focus();
  return (activeRescue = { close, refresh });
}
