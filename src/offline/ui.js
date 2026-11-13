import {isNativeApp} from "../native/platform.js";
import {
  createDownloadService,
  fetchManifest,
  FREE_CHAPTERS,
  offlineSelection,
  planDownload,
  readDownloaded,
  removeDownload,
} from "./model.js";
import { assetBytes, dbList } from "./store.js";
import { prepareOfflineShell } from "./shell.js";
import { esc } from "../ui/dom.js";
import "./offline.css";
const size = (n) =>
  n < 1024 * 1024
    ? `${Math.ceil(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
export function openDownloadManager() {
  const dialog = document.createElement("dialog");
  dialog.className = "account-dialog offline-manager";
  dialog.innerHTML =
    `<button data-offline-close class="text-button">Close ×</button><h2>Download Manager</h2><p>Take free Al-Fatihah and Juz Amma study with you. Downloads stay on this device and can be removed without deleting learning progress.</p><p class="offline-note">Premium materials require online authorization. No premium offline license is currently issued. Microphone recordings are never included or uploaded here.</p><label>Free material<select data-offline-selection><option value="juz:30">Juz Amma · all surahs 78–114</option>${
      FREE_CHAPTERS().map((s) =>
        `<option value="surah:${s.id}">${esc(s.name)}</option>`
      ).join("")
    }</select></label><label>Download type<select data-offline-audio><option value="text">Text only</option><option value="audio">Text + verified full-ayah and word audio</option></select></label><p>Text-only downloads support reading and compatible visual puzzles; audio requires a text + audio download. Distractor audio outside a downloaded surah may still need a connection.</p><div class="offline-actions"><button data-offline-estimate class="primary">Check download size</button><button data-offline-start class="primary" disabled>Download</button><button data-offline-cancel class="text-button" disabled>Pause download</button></div><p data-offline-size></p><progress data-offline-progress max="1" value="0" aria-label="Download progress"></progress><p data-offline-status role="status" aria-live="polite"></p><section data-offline-library aria-label="Downloaded materials"></section><section data-offline-reader hidden></section>`;
  document.body.append(dialog);
  dialog.showModal();
  if(isNativeApp()){const note=document.createElement("p");note.textContent="Free text and recitation are bundled with this app. Managed downloads are optional cached copies; removing them does not delete the bundled files.";dialog.querySelector("h2").after(note);}
  const select = dialog.querySelector("[data-offline-selection]"),
    audio = dialog.querySelector("[data-offline-audio]"),
    start = dialog.querySelector("[data-offline-start]"),
    estimate = dialog.querySelector("[data-offline-estimate]"),
    status = dialog.querySelector("[data-offline-status]"),
    progress = dialog.querySelector("progress"),
    cancel = dialog.querySelector("[data-offline-cancel]");
  let disposed = false,
    plan = null,
    busy = false,
    readerAudio = null,
    readerURL = null,
    readerEpoch = 0,
    estimateEpoch = 0;
  const cleanMedia = () => {
    readerEpoch++;
    readerAudio?.pause();
    readerAudio?.removeAttribute("src");
    readerAudio?.load();
    readerAudio = null;
    if (readerURL) URL.revokeObjectURL(readerURL);
    readerURL = null;
    if ("mediaSession" in navigator) {
      for (
        const key of ["play", "pause", "seekbackward", "seekforward", "stop"]
      ) {
        try {
          navigator.mediaSession.setActionHandler(key, null);
        } catch {}
      }
      navigator.mediaSession.metadata = null;
    }
  };
  const syncStatus = () => {
    if (!disposed) {
      status.textContent = navigator.onLine
        ? "Online · account progress uses your existing My Account sync preferences. Conflicting copies require your choice; no histories are automatically merged."
        : "Offline · progress stays safely on this device. Eligible account changes retry with existing sync preferences when connected.";
    }
  };
  const service = createDownloadService({
    onProgress: (p) => {
      if (disposed) return;
      progress.max = p.total;
      progress.value = p.completed;
      status.textContent = `${p.completed} / ${p.total} items · ${p.status}${
        p.failed.length ? ` · ${p.failed.length} need retry` : ""
      }`;
    },
  });
  const change = () => {
    estimateEpoch++;
    plan = null;
    start.disabled = true;
    dialog.querySelector("[data-offline-size]").textContent =
      "Check the size before downloading.";
  };
  select.onchange = audio.onchange = change;
  async function library() {
    if (disposed) return;
    const rows = await dbList("packages");
    if (disposed) return;
    const host = dialog.querySelector("[data-offline-library]");
    host.innerHTML = "<h3>On this device</h3>" +
      (!rows.length
        ? "<p>No offline downloads yet.</p>"
        : rows.map((p) =>
          `<article class="offline-package" data-package="${esc(p.id)}"><h4>${
            esc(p.label)
          }</h4><p>${esc(p.status)} · ${p.audio ? "text + audio" : "text"} · ${
            size(p.bytes || 0)
          }</p><p>${p.completed || 0} / ${p.total || 0} items</p>${
            p.failed?.length
              ? `<details><summary>Failed items</summary>${
                p.failed.map((f) => `<p>${esc(f.path)}: ${esc(f.error)}</p>`)
                  .join("")
              }</details>`
              : ""
          }<div class="offline-actions"><button data-offline-read="${
            esc(p.id)
          }">Read offline</button><button data-offline-retry="${
            esc(p.id)
          }">Update / retry</button><button data-offline-remove="${
            esc(p.id)
          }">Remove download</button></div></article>`
        ).join(""));
    host.querySelectorAll("[data-offline-remove]").forEach((b) =>
      b.onclick = async () => {
        if (busy) return;
        try {
          cleanMedia();
          await removeDownload(b.dataset.offlineRemove);
          await library();
          status.textContent =
            "Download removed. Your learning progress and FSRS schedules are unchanged.";
        } catch (e) {
          status.textContent = e.message;
        }
      }
    );
    host.querySelectorAll("[data-offline-retry]").forEach((b) =>
      b.onclick = () => {
        if (busy) return;
        const p = rows.find((p) => p.id === b.dataset.offlineRetry);
        select.value = p.id;
        audio.value = p.audio ? "audio" : "text";
        change();
        estimate.click();
      }
    );
    host.querySelectorAll("[data-offline-read]").forEach((b) =>
      b.onclick = () => read(rows.find((p) => p.id === b.dataset.offlineRead))
    );
  }
  async function read(pkg, index = 0) {
    try {
      cleanMedia();
      const epoch = readerEpoch;
      const b = await readDownloaded(pkg.refs[index]);
      if (disposed || epoch !== readerEpoch) return;
      const host = dialog.querySelector("[data-offline-reader]");
      host.hidden = false;
      host.innerHTML = `<h3>${
        esc(pkg.label)
      } · ${b.key}</h3><p class="offline-reading" dir="rtl" lang="ar">${
        esc(b.textUthmani)
      }</p><p>${esc(b.translation || "")}</p><p dir="ltr">${
        b.words.map((w) => esc(w.transliteration || "")).join(" ")
      }</p><div class="offline-actions"><button data-reader-prev ${
        index === 0 ? "disabled" : ""
      }>Previous ayah</button><button data-reader-next ${
        index >= pkg.refs.length - 1 ? "disabled" : ""
      }>Next ayah</button></div><p>This reader is supported study. Use Memorization Lab or Puzzle Lab for practice. Self-assessment and review schedules stay in the existing learning workflow.</p><div data-reader-audio></div>`;
      host.querySelector("[data-reader-prev]").onclick = () =>
        read(pkg, index - 1);
      host.querySelector("[data-reader-next]").onclick = () =>
        read(pkg, index + 1);
      const blob = await assetBytes(
        `/audio/${String(b.surah).padStart(3, "0")}${
          String(b.ayah).padStart(3, "0")
        }.mp3`,
      );
      if (disposed || epoch !== readerEpoch) return;
      if (blob) {
        readerURL = URL.createObjectURL(blob);
        readerAudio = document.createElement("audio");
        readerAudio.controls = true;
        readerAudio.src = readerURL;
        readerAudio.preload = "metadata";
        host.querySelector("[data-reader-audio]").append(readerAudio);
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `${pkg.label} ${b.key}`,
            artist: "Verified Qur’an recitation",
          });
          for (
            const [key, fn] of Object.entries({
              play: () => readerAudio?.play().catch(() => {}),
              pause: () => readerAudio?.pause(),
              stop: () => {
                readerAudio?.pause();
                if (readerAudio) readerAudio.currentTime = 0;
              },
              seekbackward: () => {
                if (readerAudio) {
                  readerAudio.currentTime = Math.max(
                    0,
                    readerAudio.currentTime - 10,
                  );
                }
              },
              seekforward: () => {
                if (readerAudio && Number.isFinite(readerAudio.duration)) {
                  readerAudio.currentTime = Math.min(
                    readerAudio.duration,
                    readerAudio.currentTime + 10,
                  );
                }
              },
            })
          ) {
            try {
              navigator.mediaSession.setActionHandler(key, fn);
            } catch {}
          }
        }
      } else {host.querySelector("[data-reader-audio]").textContent =
          "No downloaded audio for this ayah. Choose text + audio when connected.";}
      host.scrollIntoView({ block: "nearest" });
    } catch (e) {
      if (!disposed) status.textContent = e.message;
    }
  }
  estimate.onclick = async () => {
    if (busy) return;
    busy = true;
    const epoch = ++estimateEpoch,
      selection = select.value,
      audioChoice = audio.value;
    estimate.disabled = true;
    start.disabled = true;
    select.disabled = audio.disabled = true;
    try {
      const manifest = await fetchManifest(),
        [kind, n] = selection.split(":"),
        quota = await navigator.storage?.estimate?.();
      const next = await planDownload(
        kind === "juz" ? { juz: Number(n) } : { surah: Number(n) },
        { audio: audioChoice === "audio", manifest, quota, includeShell: !isNativeApp() },
      );
      if (disposed) return;
      if (
        epoch !== estimateEpoch || select.value !== selection ||
        audio.value !== audioChoice
      ) {
        plan = null;
        status.textContent =
          "Selection changed. Check the download size again before downloading.";
        return;
      }
      plan = next;
      dialog.querySelector("[data-offline-size]").textContent = `Up to ${
        size(plan.bytes)
      }: ${size(plan.contentBytes)} content + ${
        size(plan.shellBytes)
      } offline app files. Already saved valid items are reused. ${plan.refs.length} ayahs.`;
      start.disabled = false;
      status.textContent = "Ready. No content has been downloaded yet.";
    } catch (e) {
      if (!disposed) status.textContent = e.message;
    } finally {
      busy = false;
      if (!disposed) {
        estimate.disabled = false;
        select.disabled = audio.disabled = false;
      }
    }
  };
  start.onclick = async () => {
    if (busy || !plan) return;
    busy = true;
    start.disabled = true;
    estimate.disabled = true;
    cancel.disabled = false;
    select.disabled = audio.disabled = true;
    try {
      await service.download(plan, { prepareShell: prepareOfflineShell });
      await library();
    } catch (e) {
      if (!disposed) {
        status.textContent = e.name === "QuotaExceededError"
          ? "Device storage is full. Remove downloads or choose text only."
          : e.message;
      }
    } finally {
      busy = false;
      if (!disposed) {
        estimate.disabled = false;
        cancel.disabled = true;
        select.disabled = audio.disabled = false;
      }
    }
  };
  cancel.onclick = () => service.cancel();
  const accountChanged = () => {
    cleanMedia();
    service.cancel();
    if (!disposed) {
      dialog.querySelector("[data-offline-reader]").hidden = true;
      status.textContent =
        "Account changed. Free downloads stay on this device; your progress remains separately scoped.";
    }
  };
  window.addEventListener("ayahprofilechange", accountChanged);
  const close = () => {
    disposed = true;
    service.cancel();
    cleanMedia();
    window.removeEventListener("ayahprofilechange", accountChanged);
    window.removeEventListener("online", syncStatus);
    window.removeEventListener("offline", syncStatus);
    dialog.close();
    dialog.remove();
  };
  dialog.querySelector("[data-offline-close]").onclick = close;
  dialog.oncancel = (e) => {
    e.preventDefault();
    close();
  };
  window.addEventListener("online", syncStatus);
  window.addEventListener("offline", syncStatus);
  syncStatus();
  void library().catch((e) => {
    if (!disposed) status.textContent = e.message;
  });
  return { dispose: close };
}
