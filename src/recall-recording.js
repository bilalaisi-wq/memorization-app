import {
  stopEncouragement,
  cancelTransitions,
  studyAudioStop,
} from "./ui/encouragement.js";
// Recordings stay in this tab's memory. Navigation releases the microphone and URLs.
let current = null;
export function isRecallRecordingBusy() {
  return !!current?.busy();
}
export function disposeRecallRecording() {
  current?.dispose();
  current = null;
}
export function stopRecallPlayback() {
  current?.stopPlayback();
}

export function createRecallRecording({ onReference, onChange }) {
  disposeRecallRecording();
  const element = document.createElement("section");
  element.className = "recall-recording";
  element.setAttribute("aria-label", "Recitation recording and comparison");
  element.innerHTML = `<h3>Hear your recall</h3><p>Record from memory, then compare with the reciter. Your recording stays in this tab and is cleared when you leave this session. Recording does not verify pronunciation.</p>
    <div class="record-actions"><button class="primary small" id="record-recall">● Record my recitation</button><button class="text-button" id="stop-recording" disabled>Stop recording</button><span id="recording-time" aria-label="Recording duration">0:00</span></div>
    <p id="recording-status" role="status" aria-live="polite">Ready to record. Microphone permission is requested when you start.</p>
    <div class="recording-tracks"><label>Your recitation<audio id="learner-recording" controls preload="metadata"></audio></label><label>Reciter<audio id="reference-recording" controls preload="none"></audio></label></div>
    <div class="record-actions"><button class="text-button" id="play-my-recording" disabled>Listen to my recitation</button><button class="text-button" id="recall-audio">♫ Listen first (study assistance)</button><button class="primary small" id="compare-recordings" disabled>Play both together</button><button class="text-button" id="stop-comparison">Stop playback</button></div>
    <div class="recording-volumes"><label>Your volume <input id="learner-volume" type="range" min="0" max="1" step="0.05" value="1"></label><label>Reciter volume <input id="reference-volume" type="range" min="0" max="1" step="0.05" value="0.7"></label></div><p class="recording-help">Both tracks start together. Use their individual players to replay or seek, and adjust the volumes to hear each voice. Timing is not automatically aligned. You can still self-assess without a microphone.</p>`;
  const find = (id) => element.querySelector(`#${id}`);
  const mine = find("learner-recording"),
    reference = find("reference-recording");
  reference.volume = 0.7;
  let recorder = null,
    stream = null,
    url = null,
    timer = null,
    started = 0,
    pending = false,
    disposed = false,
    context = null,
    generation = 0;
  const status = (message) => {
    find("recording-status").textContent = message;
  };
  const busy = () => pending || recorder?.state === "recording";
  const stopPlayback = () => {
    mine.pause();
    reference.pause();
    studyAudioStop(mine);
    studyAudioStop(reference);
  };
  const release = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  };
  const update = () => {
    find("record-recall").disabled = busy() || !!context?.graded;
    find("record-recall").textContent = url
      ? "● Record again"
      : "● Record my recitation";
    find("stop-recording").disabled = recorder?.state !== "recording";
    find("play-my-recording").disabled = !url || busy();
    find("compare-recordings").disabled = !url || busy();
    find("recall-audio").disabled = busy();
    mine.controls = reference.controls = !busy();
    onChange();
  };
  const clear = () => {
    generation++;
    clearInterval(timer);
    stopPlayback();
    if (recorder?.state === "recording") recorder.stop();
    recorder = null;
    release();
    pending = false;
    if (url) URL.revokeObjectURL(url);
    url = null;
    mine.removeAttribute("src");
    mine.load();
    find("recording-time").textContent = "0:00";
  };
  find("record-recall").onclick = async () => {
    if (busy() || disposed) return;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      status(
        "Recording is unavailable in this browser. Use a supported browser over HTTPS, or continue self-assessment without recording.",
      );
      return;
    }
    stopEncouragement();
    cancelTransitions();
    stopPlayback();
    pending = true;
    const request = ++generation;
    status("Waiting for microphone permission…");
    update();
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (disposed || request !== generation) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = acquired;
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const next = new MediaRecorder(stream, type ? { mimeType: type } : {});
      if (url) URL.revokeObjectURL(url);
      url = null;
      mine.removeAttribute("src");
      mine.load();
      recorder = next;
      const chunks = [];
      next.ondataavailable = (event) => {
        if (request === generation && event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        if (disposed || request !== generation) return;
        clearInterval(timer);
        release();
        const blob = new Blob(chunks, { type: next.mimeType });
        recorder = null;
        if (blob.size) {
          url = URL.createObjectURL(blob);
          mine.src = url;
          status(
            "Recording ready. After reciting, reveal the ayah and compare by ear.",
          );
        } else
          status("No audio was captured. Check your microphone and try again.");
        update();
      };
      next.onerror = () => {
        clear();
        status("Recording failed. Check your microphone and try again.");
        update();
      };
      started = Date.now();
      next.start(1000);
      pending = false;
      status(
        "Recording your recitation. Stop when you finish (maximum 5 minutes).",
      );
      timer = setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        find("recording-time").textContent =
          `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        if (seconds >= 300 && next.state === "recording") next.stop();
      }, 1000);
      update();
    } catch (error) {
      if (disposed || request !== generation) return;
      release();
      pending = false;
      status(
        error.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser to record, or continue without recording."
          : "Could not open the microphone. Check that it is connected and available, then try again.",
      );
      update();
    }
  };
  find("stop-recording").onclick = () => {
    if (recorder?.state === "recording") recorder.stop();
  };
  const play = async (tracks, withReference) => {
    if (busy() || disposed) return;
    try {
      stopPlayback();
      if (withReference) onReference();
      for (const track of tracks) track.currentTime = 0;
      await Promise.all(tracks.map((track) => track.play()));
      status(
        tracks.length === 2
          ? "Playing your recitation and the reciter together."
          : "Playing recitation.",
      );
    } catch {
      stopPlayback();
      status(
        "Playback could not start. Try again or use the individual audio players.",
      );
    }
  };
  find("play-my-recording").onclick = () => play([mine], false);
  find("recall-audio").onclick = () => play([reference], true);
  find("compare-recordings").onclick = () => play([mine, reference], true);
  find("stop-comparison").onclick = stopPlayback;
  reference.addEventListener("play", () => {
    try {
      onReference();
    } catch {
      stopPlayback();
      status("Could not save assistance status. Playback stopped; try again.");
    }
  });
  for (const track of [mine, reference])
    track.addEventListener("error", () =>
      status(
        "Audio could not load. You can still compare against the verified text.",
      ),
    );
  find("learner-volume").oninput = (event) => {
    mine.volume = Number(event.target.value);
  };
  find("reference-volume").oninput = (event) => {
    reference.volume = Number(event.target.value);
  };
  const controller = {
    element,
    busy,
    stopPlayback,
    setContext(next) {
      if (context && context.id !== next.id) clear();
      const changed = !context || context.id !== next.id;
      context = next;
      if (reference.getAttribute("src") !== next.audio)
        reference.src = next.audio;
      find("recall-audio").textContent =
        `♫ ${next.declaredRecited ? "Listen to compare" : "Listen first (study assistance)"}`;
      find("record-recall").disabled = busy() || !!next.graded;
      if (changed) {
        status(
          "Ready to record. Microphone permission is requested when you start.",
        );
        find("record-recall").textContent = "● Record my recitation";
        find("play-my-recording").disabled = true;
        find("compare-recordings").disabled = true;
      }
    },
    dispose() {
      disposed = true;
      clear();
      reference.removeAttribute("src");
      reference.load();
    },
  };
  current = controller;
  return controller;
}

globalThis.addEventListener?.("pagehide", disposeRecallRecording);
