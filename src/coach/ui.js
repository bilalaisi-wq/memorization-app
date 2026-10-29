import {isDeveloperMode} from "../developer/access.js";
import { COACH_SETTINGS, coachSnapshot, materializePlan } from "./model.js";
import {
  COACH_CONSENT,
  DEFAULT_ADVICE,
  validateAdvice,
} from "../../supabase/functions/_shared/coach-core.js";
import { profileStorage } from "../learner/profile-storage.js";
import { surahs } from "../data.js";
import { esc } from "../ui/dom.js";
import "./coach.css";
export function openCoach(ctx) {
  const dialog = document.createElement("dialog");
  dialog.className = "account-dialog coach-dialog";
  dialog.innerHTML =
    '<button class="text-button" data-close>Close ×</button><span class="eyebrow">YOUR HIFZ COMPANION</span><h2>Hifz Coach</h2><div data-coach></div><p data-coach-status role="status" aria-live="polite"></p>';
  const root = dialog.querySelector("[data-coach]");
  let settings = {},
    advice = DEFAULT_ADVICE,
    ai = null,
    pending = false,
    disposed = false,
    controller = null,
    snapshot,
    generation = 0;
  const invalidate = () => {
    generation++;
    controller?.abort();
    pending = false;
  };
  try {
    const saved = JSON.parse(profileStorage.getItem(COACH_SETTINGS));
    if (saved?.version === 1) {
      settings = { minutes: saved.minutes, days: saved.days };
    }
  } catch {}
  const status = (text) => {
    dialog.querySelector("[data-coach-status]").textContent = text;
  };
  const close = () => {
    disposed = true;
    invalidate();
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector("[data-close]").onclick = close;
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  function draw() {
    snapshot = coachSnapshot(ctx.learning, profileStorage, surahs, settings);
    const plan = materializePlan(snapshot, advice), s = snapshot.summary;
    root.innerHTML =
      `<p>Suggestions are separate from puzzle correctness and self-assessed memory. No coach action changes FSRS dates, awards mastery or marks work complete.</p><section class="coach-hero"><span aria-hidden="true">✦</span><div><h3>${
        s.due ? "Make room for revision" : "A small, steady next step"
      }</h3><p>${s.due} due recall units · ${s.weak} weak units · ${s.repeated} repeatedly failed units</p><p>${s.retained} recorded retained units · ${s.independent} independent / ${s.assisted} assisted attempts in the last 14 days. These are learner assessments, not verified recitation.</p></div></section><form data-coach-settings><label>Available minutes per study day <input data-minutes type="number" min="5" max="60" step="1" value="${s.minutes}" required></label><label>Study days in the next week <input data-days type="number" min="1" max="7" step="1" value="${s.days}" required></label><button class="primary small">Update my plan</button></form><p>Your goal: ${
        esc(s.aim)
      } · confidence: ${
        esc(s.confidence)
      }. Goal targets remain on this device. Editing this plan does not rewrite your saved goals.</p><div class="coach-source">${
        ai
          ? `AI-selected planning options · ${esc(ai.metadata.model)} · ${
            ai.cached
              ? "cached; no additional AI request charged"
              : "new suggestion"
          } · ${ai.usage.used} / ${ai.usage.allowance} monthly requests used`
          : "Rules-based local plan · no external AI request made"
      }</div><h3>Today · ${plan.minutes} minutes planned</h3><p>${plan.remainingDue} due units remain outside this session. They remain due in FSRS.</p><div class="coach-tasks">${
        plan.tasks.map((t, i) =>
          `<article><h4>${
            esc(
              {
                review: "Due retrieval",
                repair: "Repair weak memory",
                transitions: "Connect passages",
                lab: "Corrective Puzzle Lab",
                new: "New memorization",
                practice: "Gentle practice",
              }[t.type],
            )
          }</h4><strong>${t.count} unit${
            t.count === 1 ? "" : "s"
          } · ${t.minutes} minutes</strong><p>${esc(t.reason)}</p><p>${
            t.targets.map((u) => esc(u.refs.join(" → "))).join(" · ")
          }</p><label><input type="checkbox" data-plan-tick="${i}"> I worked on this plan step (checklist only)</label><button class="text-button" data-start="${i}">Start this step</button></article>`
        ).join("")
      }</div><h3>Weekly intention</h3><p>Suggested study pattern: first ${s.days} of the next seven days. Rest days preserve your progress. Known future due dates only; new grades may change the workload.</p><div class="coach-week">${
        plan.weekly.map((d, i) =>
          `<article><strong>${snapshot.dates[i]}</strong><p>${
            d.study
              ? `${d.reviewUnits} review units · ${d.newUnits} new · up to ${s.minutes} minutes`
              : "Rest / optional light revision"
          }</p><small>${d.backlog} unallocated due units</small></article>`
        ).join("")
      }</div><h3>Why this plan?</h3>${
        plan.explanations.map((p) => `<p>${esc(p)}</p>`).join("")
      }<p>${
        plan.goalAdvice === "reduce"
          ? "Consider a revision-only week or fewer new ayahs. You choose; no goal has been changed."
          : "Maintain a small pace and adjust if it feels demanding."
      } ${
        plan.breakStyle === "spaced"
          ? "Split your available time into shorter sessions."
          : "Keep the session short and speak each word as you practice."
      }</p><h3>Suggested Puzzle Lab</h3><p>${
        !isDeveloperMode()
          ? "Ayah Blocks for visible word-order practice."
          : s.transitions
          ? "Broken Chain for recorded transition difficulties."
          : s.recentMistakes
          ? "Ayah Blocks for recent puzzle mistakes."
          : "Vanishing Ayah can support recall practice; it is not evidence of retention."
      } After practice, return to independent spoken recall and compare with the reciter.</p>${
        snapshot.warnings.map((w) => `<p role="status">${esc(w)}</p>`).join("")
      }<details><summary>Optional AI planning · adult pilot</summary><p>Only the aggregate counts shown below, goal type, confidence, time budget and seven due-count buckets are sent through our server to OpenAI. No Quran text, specific references, names, recordings, raw history or tafsir requests are sent. Learning aggregates can still reveal religious practice. AI can select only bounded planning options; it cannot override due-first rules or write your scheduler.</p><pre data-summary-preview>${
        esc(JSON.stringify(s, null, 2))
      }</pre><label><input type="checkbox" data-coach-consent> I am an approved adult and consent to sending these learning aggregates for AI planning.</label><button class="primary small" data-ai-plan ${
        pending ? "disabled" : ""
      }>${
        pending ? "Requesting…" : "Ask AI for planning options"
      }</button><p>Repeated identical daily summaries are cached for up to 24 hours. Provider failures consume a reserved request; there are no automatic retries. Usage resets each UTC calendar month.</p></details><button class="text-button" data-reset-advice>Use rules-based suggestions</button><button class="text-button" data-delete-coach>Delete coach settings and server cache</button>`;
    root.querySelector("[data-coach-settings]").onsubmit = (e) => {
      e.preventDefault();
      const minutes = Number(root.querySelector("[data-minutes]").value),
        days = Number(root.querySelector("[data-days]").value);
      if (
        !Number.isInteger(minutes) || minutes < 5 || minutes > 60 ||
        !Number.isInteger(days) || days < 1 || days > 7
      ) {
        status("Choose 5–60 whole minutes and 1–7 days.");
        return;
      }
      try {
        invalidate();
        profileStorage.setItem(
          COACH_SETTINGS,
          JSON.stringify({ version: 1, minutes, days }),
        );
        settings = { minutes, days };
        advice = DEFAULT_ADVICE;
        ai = null;
        draw();
        status(
          "Your plan preferences are saved locally. FSRS dates and existing goals are unchanged.",
        );
      } catch {
        status(
          "Could not save preferences; your learning records are unchanged.",
        );
      }
    };
    root.querySelectorAll("[data-start]").forEach((b) =>
      b.onclick = () => {
        const task = plan.tasks[Number(b.dataset.start)],
          target = task.targets[0];
        close();
        if (target?.passage) {
          ctx.onPassageStudio?.(
            target,
            task.type === "review" ? "review" : "practice",
          );
        } else if (task.type === "review" && target) {
          ctx.onRecall?.(
            target.refs[0],
          );
        } else if (
          task.type === "transitions" || task.type === "lab" ||
          task.type === "repair"
        ) {
          ctx.onCoachStep?.(
            target?.refs[0] || snapshot.candidates[0] || "1:1",
            "lab",
            task.game,
          );
        } else ctx.onCoachStep?.(target?.refs[0] || "1:1", "practice");
      }
    );
    root.querySelector("[data-reset-advice]").onclick = () => {
      invalidate();
      advice = DEFAULT_ADVICE;
      ai = null;
      draw();
      status("Using local rules. No learning records changed.");
    };
    root.querySelector("[data-ai-plan]").onclick = async () => {
      if (pending) return;
      if (!root.querySelector("[data-coach-consent]").checked) {
        status("Explicit aggregate-data consent is required.");
        return;
      }
      if (!ctx.client || !ctx.user) {
        status(
          "Sign in to an approved AI-enabled account. Local planning is still available.",
        );
        return;
      }
      const request = ++generation;
      pending = true;
      controller = new AbortController();
      const b = root.querySelector("[data-ai-plan]");
      b.disabled = true;
      status("Requesting bounded planning options…");
      try {
        const { data, error } = await ctx.client.functions.invoke(
          "hifz-coach",
          {
            body: { summary: snapshot.summary, consent: COACH_CONSENT },
            signal: controller.signal,
          },
        );
        if (disposed || request !== generation) return;
        if (error) {
          let message = "AI is unavailable. Continue with your local plan.";
          try {
            message = (await error.context.json()).error || message;
          } catch {}
          throw Error(message);
        }
        advice = validateAdvice(data.advice);
        ai = data;
        pending = false;
        draw();
        status(
          "AI suggestions are ready. You remain in control; no review dates or mastery results changed.",
        );
      } catch (e) {
        if (!disposed && request === generation) status(e.message);
      } finally {
        if (request === generation) pending = false;
        if (b.isConnected) b.disabled = false;
      }
    };
    root.querySelector("[data-delete-coach]").onclick = async () => {
      invalidate();
      try {
        profileStorage.removeItem(COACH_SETTINGS);
        settings = {};
        advice = DEFAULT_ADVICE;
        ai = null;
        draw();
        if (ctx.client && ctx.user) {
          const r = await ctx.client.rpc("delete_my_hifz_coach_cache");
          if (r.error) {
            throw Error(
              "Local preferences cleared; server cache deletion failed. Retry when connected.",
            );
          }
        }
        status(
          "Coach preferences and available server cache cleared. Usage counters and learning records remain. An upload already sent cannot be recalled from the provider.",
        );
      } catch (e) {
        status(e.message);
      }
    };
  }
  document.body.append(dialog);
  dialog.showModal();
  draw();
}
