import {
  THEMES,
  APPEARANCE_KEY,
  validAppearance,
  defaultAppearance,
} from "./registry.js";
import { profileStorage, profileKey } from "../learner/profile-storage.js";
let preference = defaultAppearance(),
  account = {},
  previewing = false,
  listening = false,
  generation = 0;
export const appearance = () => ({ ...preference });
export function celestialMotion(value = preference) {
  let experience;
  try {
    experience = JSON.parse(localStorage.getItem("ayah-experience-v1"));
  } catch {}
  return (
    !value.reduceEffects &&
    experience?.motion !== false &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
function apply(value) {
  document.documentElement.dataset.theme = value.theme;
  document.documentElement.dataset.celestialMotion =
    value.reduceEffects || !celestialMotion(value) ? "reduced" : "full";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEMES[value.theme].color);
  document.dispatchEvent(
    new CustomEvent("ayahappearancechange", { detail: value }),
  );
}
function readLocal() {
  try {
    const value = JSON.parse(profileStorage.getItem(APPEARANCE_KEY));
    return validAppearance(value) ? value : defaultAppearance();
  } catch {
    return defaultAppearance();
  }
}
export function initializeAppearance(context = {}) {
  const requestGeneration = ++generation;
  account = context;
  preference = readLocal();
  apply(preference);
  if (!listening) {
    listening = true;
    window.addEventListener("ayahprofilechange", () => {
      generation++;
      account = {};
      previewing = false;
      document.querySelectorAll(".appearance-dialog").forEach((dialog) => {
        dialog.close();
        dialog.remove();
      });
      preference = readLocal();
      apply(preference);
    });
    window.addEventListener("storage", (event) => {
      if (event.key === profileKey(APPEARANCE_KEY) && !previewing) {
        preference = readLocal();
        apply(preference);
      }
    });
    document.addEventListener("ayahmotionchange", () => apply(preference));
    document.addEventListener("visibilitychange", () => {
      document.documentElement.dataset.skyVisible = document.hidden
        ? "false"
        : "true";
    });
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      () => apply(preference),
    );
  }
  if (context.client && context.userId) {
    let before;
    try {
      before = profileStorage.getItem(APPEARANCE_KEY);
    } catch {
      return;
    }
    context.client
      .from("learner_appearance")
      .select("settings")
      .eq("user_id", context.userId)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (
          error ||
          requestGeneration !== generation ||
          previewing ||
          profileStorage.getItem(APPEARANCE_KEY) !== before
        )
          return;
        if (data?.settings && !validAppearance(data.settings)) return;
        if (
          validAppearance(data?.settings) &&
          Date.parse(data.settings.updatedAt) > Date.parse(preference.updatedAt)
        ) {
          try {
            profileStorage.setItem(
              APPEARANCE_KEY,
              JSON.stringify(data.settings),
            );
            preference = data.settings;
            apply(preference);
          } catch {}
        } else if (
          preference.updatedAt !== defaultAppearance().updatedAt &&
          (!data?.settings ||
            Date.parse(preference.updatedAt) >
              Date.parse(data.settings.updatedAt))
        ) {
          // Reconcile a previously saved/offline profile preference independently of progress sync.
          await context.client
            .from("learner_appearance")
            .upsert({
              user_id: context.userId,
              settings: preference,
              updated_at: preference.updatedAt,
            });
        }
      })
      .catch(() => {});
  }
}

export async function saveAppearance(value) {
  const next = {
    version: 1,
    theme: value.theme,
    reduceEffects: !!value.reduceEffects,
    updatedAt: new Date().toISOString(),
  };
  if (!validAppearance(next)) throw new Error("Choose an available theme.");
  profileStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); // Apply only after a confirmed local write.
  preference = next;
  apply(preference);
  if (account.client && account.userId) {
    try {
      const { error } = await account.client.from("learner_appearance").upsert({
        user_id: account.userId,
        settings: next,
        updated_at: next.updatedAt,
      });
      if (error) throw error;
      return "Appearance saved to your account.";
    } catch {
      return "Appearance saved on this device. Account appearance sync is unavailable; your learning sync is unaffected.";
    }
  }
  return "Appearance saved on this device.";
}
export function openAppearance() {
  const original = appearance(),
    dialog = document.createElement("dialog");
  dialog.className = "appearance-dialog";
  previewing = true;
  dialog.innerHTML = `<button class="text-button" data-appearance-cancel>Cancel ×</button><h2>Appearance</h2><p>Preview a theme. Your learning, Arabic text, audio, and progress stay the same.</p><div class="theme-options" role="group" aria-label="Theme">${Object.values(
    THEMES,
  )
    .filter((theme) => theme.enabled !== false)
    .map(
      (theme) =>
        `<button class="theme-preview theme-preview-${theme.id}" data-theme-choice="${theme.id}" aria-pressed="${theme.id === original.theme}"><span class="theme-swatch" aria-hidden="true">${theme.id === "night-sky" ? "☾ · ✦" : "✧"}</span><strong>${theme.name}</strong><span>${theme.description}</span></button>`,
    )
    .join(
      "",
    )}</div><label><input type="checkbox" data-reduce-celestial ${original.reduceEffects ? "checked" : ""}> Reduce celestial effects</label><p>System reduced-motion preferences always take priority. No additional sounds are added.</p><button class="primary" data-appearance-apply>Apply theme</button><p data-appearance-status role="status"></p>`;
  document.body.append(dialog);
  let selected = { ...original };
  const close = () => {
    previewing = false;
    dialog.close();
    dialog.remove();
  };
  const cancel = () => {
    apply(original);
    close();
  };
  dialog.querySelector("[data-appearance-cancel]").onclick = cancel;
  dialog.oncancel = (event) => {
    event.preventDefault();
    cancel();
  };
  dialog.querySelectorAll("[data-theme-choice]").forEach(
    (button) =>
      (button.onclick = () => {
        selected.theme = button.dataset.themeChoice;
        apply(selected);
        dialog
          .querySelectorAll("[data-theme-choice]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      }),
  );
  dialog.querySelector("[data-reduce-celestial]").onchange = (event) => {
    selected.reduceEffects = event.target.checked;
    apply(selected);
  };
  dialog.querySelector("[data-appearance-apply]").onclick = async () => {
    const button = dialog.querySelector("[data-appearance-apply]");
    button.disabled = true;
    try {
      const status = await saveAppearance(selected);
      close();
      const existing = document.querySelector("[data-settings-status]");
      if (existing) existing.textContent = status;
    } catch {
      dialog.querySelector("[data-appearance-status]").textContent =
        "Appearance could not be saved. Your previous setting remains saved; retry or cancel.";
      button.disabled = false;
    }
  };
  dialog.showModal();
}
export function mountAppearanceSettings(dialog) {
  const section = document.createElement("section");
  section.className = "appearance-settings";
  section.innerHTML =
    '<h3>Appearance</h3><p>Choose Simple or Night Sky.</p><button class="text-button" data-open-appearance>Choose theme</button>';
  section.querySelector("button").onclick = openAppearance;
  dialog.querySelector("h2").after(section);
}
