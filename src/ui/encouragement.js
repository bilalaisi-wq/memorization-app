import { esc } from "./dom.js";
export const EXPERIENCE_KEY = "ayah-experience-v1";
let prefs = { sound: true, motion: true, volume: 0.25 },
  context = null,
  custom = null,
  defaultSound = null,
  nodes = [],
  generation = 0,
  busy = new Set(),
  isRecording = () => false;
const receipts = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(EXPERIENCE_KEY));
  if (
    saved &&
    typeof saved.sound === "boolean" &&
    typeof saved.motion === "boolean" &&
    typeof saved.volume === "number"
  )
    prefs = {
      sound: saved.sound,
      motion: saved.motion,
      volume: Math.max(0, Math.min(1, saved.volume)),
    };
} catch {}
const openMedia = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("ayah-feedback-media-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sounds");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function media(action, value) {
  const db = await openMedia();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "sounds",
        action === "get" ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("sounds");
      const req =
        action === "get"
          ? store.get("success")
          : action === "put"
            ? store.put(value, "success")
            : store.delete("success");
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
const loaded = media("get")
  .then((value) => (custom = value || null))
  .catch(() => {});
if (typeof window !== "undefined")
  fetch("/feedback-sounds.json")
    .then((r) => r.json())
    .then(async (config) => {
      if (
        config.schemaVersion !== 1 ||
        typeof config.success !== "string" ||
        !/^\/feedback-audio\/[a-zA-Z0-9_.-]+$/.test(config.success)
      )
        return;
      const response = await fetch(config.success);
      if (!response.ok) return;
      const blob = await response.blob();
      if (blob.size <= 5 * 1024 * 1024)
        defaultSound = { blob, name: config.success.split("/").at(-1) };
    })
    .catch(() => {});
export function configureExperience(recording) {
  isRecording = recording;
}
export function stopEncouragement() {
  generation++;
  for (const node of nodes) {
    try {
      node.stop();
    } catch {}
  }
  nodes = [];
  document.querySelector(".success-celebration")?.remove();
}
export function studyAudioStart(id) {
  busy.add(id);
  stopEncouragement();
  cancelTransitions();
}
export function studyAudioStop(id) {
  busy.delete(id);
}
export function cancelTransitions() {
  document.querySelector(".mode-transition")?.remove();
}
export function transitionCue() {
  cancelTransitions();
  if (
    !prefs.motion ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    busy.size ||
    isRecording()
  )
    return;
  const star = document.createElement("div");
  star.className = "mode-transition";
  star.setAttribute("aria-hidden", "true");
  star.textContent = "✦";
  document.body.append(star);
  setTimeout(() => star.remove(), 420);
}
export function successCue(id, message = "Beautiful work — keep growing!") {
  if (receipts.has(id)) return;
  receipts.add(id);
  if (receipts.size > 500) receipts.delete(receipts.values().next().value);
  if (busy.size || isRecording()) return;
  stopEncouragement();
  const run = generation;
  const toast = document.createElement("div");
  toast.className = "success-celebration";
  toast.setAttribute("role", "status");
  toast.textContent = `✦ ${message}`;
  if (!prefs.motion || matchMedia("(prefers-reduced-motion: reduce)").matches)
    toast.classList.add("still");
  (document.querySelector("dialog[open]") || document.body).append(toast);
  setTimeout(() => toast.remove(), 2200);
  if (!prefs.sound || prefs.volume === 0) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    const play = async () => {
      await context.resume();
      await loaded;
      if (run !== generation || busy.size || isRecording()) return;
      const gain = context.createGain();
      gain.gain.value = prefs.volume;
      gain.connect(context.destination);
      if (custom || defaultSound) {
        const buffer = await context.decodeAudioData(
          await (custom || defaultSound).blob.arrayBuffer(),
        );
        if (
          run !== generation ||
          busy.size ||
          isRecording() ||
          buffer.duration > 10
        )
          return;
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.connect(gain);
        nodes.push(node);
        node.start();
      } else
        for (const [i, hz] of [523.25, 659.25, 783.99].entries()) {
          const osc = context.createOscillator(),
            envelope = context.createGain(),
            at = context.currentTime + i * 0.09;
          osc.frequency.value = hz;
          envelope.gain.setValueAtTime(0, at);
          envelope.gain.linearRampToValueAtTime(0.25, at + 0.025);
          envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
          osc.connect(envelope);
          envelope.connect(gain);
          nodes.push(osc);
          osc.start(at);
          osc.stop(at + 0.32);
        }
    };
    play().catch(() => {});
  } catch {}
}
export function showFeedbackSettings() {
  const dialog = document.createElement("dialog");
  dialog.className = "experience-dialog";
  dialog.innerHTML = `<button class="text-button" data-close>Close ×</button><h2>Encouragement settings</h2><p>Choose your success sound and animations. These settings never change your learning progress.</p><label><input id="success-sound" type="checkbox" ${prefs.sound ? "checked" : ""}> Play a gentle success sound</label><label>Volume<input id="success-volume" type="range" min="0" max="1" step=".05" value="${prefs.volume}"></label><label><input id="experience-motion" type="checkbox" ${prefs.motion ? "checked" : ""}> Gentle celebrations and transitions</label><p>Reduced-motion preferences are always respected. Sounds and celebrations stop when recitation or recording begins.</p><label>Your encouragement sound<input id="success-upload" type="file" accept="audio/*"></label><p id="success-file">${custom ? esc(custom.name) : "Built-in chime"}</p><p>Upload an audio clip up to 5 MB and 10 seconds. It stays in this browser and is not uploaded to a server.</p><button class="text-button" id="reset-success-sound">Restore default sound</button><button class="primary small" id="preview-success">Preview encouragement</button><p data-settings-status role="status"></p>`;
  document.body.append(dialog);
  dialog.showModal();
  const status = dialog.querySelector("[data-settings-status]");
  const save = () => {
    try {
      const next = {
        sound: dialog.querySelector("#success-sound").checked,
        motion: dialog.querySelector("#experience-motion").checked,
        volume: Number(dialog.querySelector("#success-volume").value),
      };
      localStorage.setItem(EXPERIENCE_KEY, JSON.stringify(next));
      prefs = next;
      stopEncouragement();
      cancelTransitions();
      status.textContent = "Preferences saved.";
    } catch {
      status.textContent =
        "Preferences could not be saved. Existing settings are preserved.";
    }
  };
  for (const id of ["success-sound", "success-volume", "experience-motion"])
    dialog.querySelector("#" + id).onchange = save;
  dialog.querySelector("#preview-success").onclick = () =>
    successCue("preview-" + Date.now(), "A little progress, beautifully done.");
  dialog.querySelector("#success-upload").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.disabled = true;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error("Choose an audio clip smaller than 5 MB.");
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (buffer.duration > 10)
        throw Error("Choose a clip no longer than 10 seconds.");
      const value = { name: file.name, blob: file };
      await media("put", value);
      custom = value;
      dialog.querySelector("#success-file").textContent = file.name;
      status.textContent = "Your encouragement sound is saved in this browser.";
    } catch (e) {
      status.textContent =
        e.message || "That audio could not be saved. Try another file.";
    } finally {
      event.target.disabled = false;
      event.target.value = "";
    }
  };
  dialog.querySelector("#reset-success-sound").onclick = async () => {
    try {
      await media("delete");
      custom = null;
      dialog.querySelector("#success-file").textContent = "Built-in chime";
      status.textContent = "Default sound restored.";
    } catch {
      status.textContent = "The custom sound could not be removed. Try again.";
    }
  };
  dialog.querySelector("[data-close]").onclick = () => {
    stopEncouragement();
    dialog.close();
    dialog.remove();
  };
  dialog.oncancel = () => {
    stopEncouragement();
    dialog.remove();
  };
  loaded.then(() => {
    if (dialog.isConnected)
      dialog.querySelector("#success-file").textContent =
        custom?.name || "Built-in chime";
  });
}
if (typeof document !== "undefined") {
  document.addEventListener(
    "play",
    (event) => {
      if (event.target.tagName === "AUDIO") studyAudioStart(event.target);
    },
    true,
  );
  for (const type of ["pause", "ended", "error", "emptied"])
    document.addEventListener(
      type,
      (event) => {
        if (event.target.tagName === "AUDIO") studyAudioStop(event.target);
      },
      true,
    );
}
