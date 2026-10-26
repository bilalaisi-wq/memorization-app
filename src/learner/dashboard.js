import { rewardSummary } from "../rewards/store.js";
import { esc } from "../ui/dom.js";
import { profileStorage } from "./profile-storage.js";
import {
  readGoals,
  saveGoals,
  summarizeActivity,
  nextStep,
  achievements,
  preserveAchievements,
} from "./insights.js";
const badge = (type) => {
  const drawings = {
    footstep: '<path d="M35 20q-15 20 0 35t5 28M65 12q15 20 0 35t-5 28"/>',
    voice:
      '<rect x="40" y="15" width="20" height="45" rx="10"/><path d="M30 42v8a20 20 0 0 0 40 0v-8M50 70v15M36 85h28"/>',
    sprout:
      '<path d="M50 85V45Q15 45 20 20q30-5 30 30 0-35 30-30 5 30-30 30"/>',
    surah:
      '<path d="M20 25q20-12 30 0 10-12 30 0v55q-20-12-30 0-10-12-30 0zM50 25v55"/><text x="50" y="59" text-anchor="middle" stroke="none" fill="currentColor" font-size="30">1</text>',
    flame:
      '<path d="M50 12q-5 20-20 32-25 36 20 44 40-5 25-35-5 15-15 15 8-30-10-56z"/>',
    stars:
      '<path d="m50 15 10 22 25 3-18 18 4 26-21-12-21 12 4-26-18-18 25-3z"/><text x="50" y="59" text-anchor="middle" stroke="none" fill="currentColor" font-size="20">10</text>',
  };
  return `<svg class="achievement-badge" viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${drawings[type]}</svg>`;
};
export function mountLearnerDashboard(root, store, surahs, callbacks) {
  const area = document.createElement("section");
  area.className = "learner-dashboard";
  root.prepend(area);
  const draw = () => {
    const state = store.snapshot(),
      goals = readGoals(profileStorage),
      activity = summarizeActivity(state, profileStorage),
      suggestion = nextStep(state, store.daily(), goals, surahs);
    const chapter = surahs.find(
      (s) => s.id === Number(suggestion.key?.split(":")[0]),
    );
    const weekStart = new Date(
      Date.parse(`${activity.today}T12:00:00Z`) - 6 * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const week = Object.entries(activity.days).filter(
      ([day]) => day >= weekStart && day <= activity.today,
    );
    const weekly = {
      days: week.length,
      puzzles: week.reduce((n, [, v]) => n + v.puzzles, 0),
      recalls: week.reduce((n, [, v]) => n + v.recalls, 0),
    };
    area.innerHTML = `<p class="study-xp-total">✦ ${rewardSummary(store).xp} total learning XP across all modes · Nature Companions is in the menu.</p><section class="goal-card"><div><span class="eyebrow">YOUR LEARNING PLAN</span><h2>${goals ? "Small steps toward your goals" : "Make a plan that fits your life"}</h2><p>${goals ? `${goals.minutes} minutes · ${goals.days} days each week · ${esc({ daily: "A steady daily habit", surahs: "Memorize selected surahs", review: "Strengthen what I know" }[goals.aim])}` : "Choose what you want to learn and what you already know. Your starting point is self-reported; it never awards mastery."}</p></div><button class="primary small" data-edit-goals>${goals ? "Edit my goals" : "Set my goals"}</button></section>
    <section class="recommendation-card"><h3>${esc(suggestion.title)}</h3><p>${esc(suggestion.reason)}</p><p><strong>${esc(chapter?.name || "")} · Ayah ${esc(suggestion.key?.split(":")[1] || "")}</strong></p><button class="primary small" data-next-step>Start suggested step →</button><fieldset class="confidence-check"><legend>How does your memory feel?</legend>${[
      ["new", "Still learning"],
      ["shaky", "A little shaky"],
      ["ready", "Ready to recite"],
    ]
      .map(
        ([value, label]) =>
          `<button class="text-button" data-confidence="${value}" aria-pressed="${goals?.confidence === value}">${label}</button>`,
      )
      .join(
        "",
      )}</fieldset><p>Practice → Puzzle Quest → spoken recall → spaced reviews. Record during self-assessment to listen to your progress; recordings stay in the tab.</p></section>
    <section class="streak-grid"><article><span class="streak-flame" aria-hidden="true">🔥</span><h3>${activity.current} day${activity.current === 1 ? "" : "s"} active in a row</h3><p>Best: ${activity.best} days · ${Object.keys(activity.days).length} active days total</p><p>A break is okay. Earned XP and awards stay yours.</p></article><article><h3>Your weekly intention</h3><p>${weekly.days} active days · ${weekly.puzzles} completed puzzles · ${weekly.recalls} recalls in the last 7 days</p><p>${goals ? `${goals.days} days of short, focused study` : "Choose a realistic number of study days in your goals."}</p><p>Listen, speak, build, and retrieve. Start with due reviews before adding new material.</p></article></section>
    <section class="achievements-section"><h2>Your achievements</h2><p>Game progress and retained, self-assessed memory are shown separately. Gray badges show your next milestones. Earned badges stay yours; keep reviewing even after earning them.</p><div class="achievement-grid">${preserveAchievements(
      profileStorage,
      achievements(state, surahs, activity),
    )
      .map(
        (a) =>
          `<article class="achievement-card ${a.value >= a.target ? "earned" : "locked"}" data-achievement="${a.id}">${badge(a.icon)}<h3>${esc(a.title)}</h3><strong>${a.value >= a.target ? "Earned" : "In progress"} · ${Math.min(a.value, a.target)} / ${a.target}</strong><progress max="${a.target}" value="${Math.min(a.value, a.target)}" aria-label="${esc(a.title)} progress"></progress><p>${esc(a.detail)}</p></article>`,
      )
      .join("")}</div></section>
    <section class="activity-section"><h2>Activity history</h2><p>Study interactions, completed puzzles, and self-assessed recalls. Viewing a page alone does not count. Dates use ${esc(state.timeZone)}.</p><label>Month <input type="month" id="activity-month" value="${activity.today.slice(0, 7)}" max="${activity.today.slice(0, 7)}"></label><div data-activity-details></div></section><p data-plan-status role="status"></p>`;
    const renderActivity = (month) => {
      const entries = Object.entries(activity.days)
        .filter(([d]) => d.startsWith(month))
        .sort(([a], [b]) => a.localeCompare(b));
      const count = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      ).getUTCDate();
      const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        .map(
          (day) =>
            `<span class="activity-weekday" aria-hidden="true">${day}</span>`,
        )
        .join("");
      const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
      const blanks = '<span aria-hidden="true"></span>'.repeat(offset);
      const cells = Array.from({ length: count }, (_, i) => {
        const day = `${month}-${String(i + 1).padStart(2, "0")}`,
          a = activity.days[day];
        return `<span class="activity-day ${a ? "active" : ""}" title="${day}: ${a ? `${a.study} study entries, ${a.puzzles} puzzles, ${a.recalls} recalls` : "No recorded activity"}" aria-label="${day}: ${a ? "Active" : "No recorded activity"}">${i + 1}</span>`;
      }).join("");
      area.querySelector("[data-activity-details]").innerHTML =
        `<div class="activity-calendar" aria-label="Monthly activity">${weekdays}${blanks}${cells}</div><div class="activity-table-scroll"><table><caption>Daily activity details for ${esc(month)}</caption><thead><tr><th>Date</th><th>Ayahs</th><th>Study</th><th>Puzzles</th><th>Recalls</th><th>Independent</th><th>XP</th><th>Stars</th></tr></thead><tbody>${entries.map(([d, a]) => `<tr><th>${d}</th><td>${a.ayahs.length}</td><td>${a.study}</td><td>${a.puzzles}</td><td>${a.recalls}</td><td>${a.independent}</td><td>${a.xp}</td><td>${a.stars}</td></tr>`).join("") || '<tr><td colspan="8">No activity recorded for this month yet.</td></tr>'}</tbody></table></div>`;
    };
    renderActivity(activity.today.slice(0, 7));
    area.querySelector("#activity-month").onchange = (e) => {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) renderActivity(e.target.value);
    };
    area.querySelector("[data-next-step]").onclick = () =>
      suggestion.mode === "review"
        ? callbacks.onRecall(suggestion.key)
        : callbacks.onRecommended(suggestion.key, suggestion.mode);
    area.querySelector("[data-edit-goals]").onclick = () => editGoals(goals);
    area.querySelectorAll("[data-confidence]").forEach(
      (button) =>
        (button.onclick = () => {
          try {
            saveGoals(
              profileStorage,
              {
                aim: "daily",
                minutes: 10,
                days: 5,
                targets: [chapter?.id || 1],
                known: [],
                ...goals,
                confidence: button.dataset.confidence,
              },
              surahs,
            );
            draw();
          } catch {
            area.querySelector("[data-plan-status]").textContent =
              "Your preference could not be saved. Please check browser storage.";
          }
        }),
    );
  };
  function editGoals(goals) {
    const dialog = document.createElement("dialog");
    dialog.className = "goals-dialog";
    dialog.innerHTML = `<button class="text-button" data-close>Close ×</button><h2>My memorization goals</h2><form><label>My main aim<select name="aim"><option value="daily">Build a steady habit</option><option value="surahs">Memorize specific surahs</option><option value="review">Strengthen what I know</option></select></label><label>Minutes per study day<select name="minutes">${[5, 10, 15, 20, 30].map((n) => `<option>${n}</option>`).join("")}</select></label><label>Days each week<select name="days">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option>${n}</option>`).join("")}</select></label><label>How I feel<select name="confidence"><option value="new">Still learning</option><option value="shaky">A little shaky</option><option value="ready">Ready to recite</option></select></label><p>Select surahs below. “Already know” is self-reported and does not grant retained mastery.</p><div class="goals-surahs">${surahs.map((s) => `<fieldset><legend>${esc(s.name)}</legend><label><input type="checkbox" name="target" value="${s.id}" ${goals?.targets.includes(s.id) ? "checked" : ""}> Want to learn / review</label><label><input type="checkbox" name="known" value="${s.id}" ${goals?.known.includes(s.id) ? "checked" : ""}> Already know</label></fieldset>`).join("")}</div><button class="primary" type="submit">Save my plan</button><p data-goal-error role="alert"></p></form>`;
    area.append(dialog);
    const form = dialog.querySelector("form");
    for (const name of ["aim", "minutes", "days", "confidence"])
      form.elements[name].value =
        goals?.[name] ||
        { aim: "daily", minutes: 10, days: 5, confidence: "new" }[name];
    const close = () => {
      dialog.close();
      dialog.remove();
      area.querySelector("[data-edit-goals]")?.focus();
    };
    dialog.querySelector("[data-close]").onclick = close;
    dialog.oncancel = (e) => {
      e.preventDefault();
      close();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (data.get("aim") === "surahs" && !data.getAll("target").length) {
        dialog.querySelector("[data-goal-error]").textContent =
          "Choose at least one target surah.";
        return;
      }
      try {
        saveGoals(
          profileStorage,
          {
            aim: data.get("aim"),
            minutes: data.get("minutes"),
            days: data.get("days"),
            confidence: data.get("confidence"),
            targets: data.getAll("target"),
            known: data.getAll("known"),
          },
          surahs,
        );
        close();
        draw();
      } catch {
        dialog.querySelector("[data-goal-error]").textContent =
          "Your plan could not be saved. Existing progress is unchanged.";
      }
    };
    dialog.showModal();
  }
  draw();
}
