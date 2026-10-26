import {
  compareTranscript,
  COMPARISON_VERSION,
  MAX_AUDIO_BYTES,
  POLICY_VERSION,
} from "../../supabase/functions/_shared/recitation-core.js";
import { esc } from "../ui/dom.js";
// Results, corrections and audio are ephemeral; this module never writes learning state.
export function createAiPanel() {
  const element = document.createElement("section");
  element.className = "experimental-recitation";
  element.innerHTML =
    `<details><summary>Experimental AI word comparison · adult pilot</summary><p>This is uncertain speech transcription, not certified Quran or tajweed grading. It cannot assess makharij, madd or ghunnah. Puzzle correctness, your self-assessment and AI observations are separate. AI never awards mastery, XP or stars.</p><p>Record and listen first. Submit only your own adult voice, without other people in the background. Child recordings must not be uploaded. Operator-approved adult pilot access and an AI-enabled subscription are required.</p><p>With your permission, audio is sent through our server to OpenAI for transcription. Our app does not save audio or transcripts. Provider processing and retention follow the operator’s published terms; deleting here cannot recall an upload already processed. Requests, including provider failures, consume one monthly allowance after reservation.</p><button class="text-button" data-ai-access>Check experimental access</button><p data-ai-access-status role="status"></p><label><input type="checkbox" data-ai-consent> I am an adult, this is my own adult voice, and I consent to this upload and provider processing.</label><p>For private local practice, leave this unchecked.</p><button class="primary small" data-ai-submit disabled>Compare recording experimentally</button><button class="text-button" data-ai-delete>Delete recording and analysis</button><p data-ai-status role="status" aria-live="polite"></p><div data-ai-result></div></details>`;
  const find = (s) => element.querySelector(s);
  let blob = null,
    context = null,
    enabled = false,
    disposed = false,
    pending = false,
    controller = null,
    generation = 0,
    result = null,
    client = null,
    clearRecording = () => {};
  const status = (text) => {
    find("[data-ai-status]").textContent = text;
  };
  const update = () => {
    find("[data-ai-submit]").disabled = !enabled || !blob || pending ||
      !context?.declaredRecited || !find("[data-ai-consent]").checked;
  };
  async function account() {
    const { appearanceAccount } = await import("../learner/accounts.js");
    const value = appearanceAccount();
    client = value.client;
    if (!client || !value.userId) {
      throw Error(
        "Sign in to an approved adult pilot account. Local recording needs no account.",
      );
    }
    return client;
  }
  find("[data-ai-access]").onclick = async () => {
    try {
      const c = await account(),
        response = await c.rpc("my_recitation_ai_access");
      if (response.error) {
        throw Error(
          "Experimental comparison is not configured for this account.",
        );
      }
      enabled = response.data?.enabled === true;
      find("[data-ai-access-status]").textContent = enabled
        ? `${response.data.used} / ${response.data.allowance} requests used this UTC calendar month. Declare “I’ve recited” before sending; listen to your recording first.`
        : "Experimental access is off. This requires operator-approved adult pilot access, privacy review and an AI-enabled subscription. Local recording and self-assessment remain available.";
    } catch (error) {
      enabled = false;
      find("[data-ai-access-status]").textContent = error.message;
    }
    update();
  };
  find("[data-ai-consent]").onchange = update;
  function display(comparison, transcript, corrected = false) {
    const target = find("[data-ai-result]");
    target.innerHTML = `<h4>${
      corrected
        ? "Your corrected transcript comparison"
        : "Uncertain AI transcription"
    }</h4><p>${
      comparison.status === "could_not_assess"
        ? "The recitation could not be assessed."
        : comparison.differences.length
        ? "Possible word differences — listen and check each one. The transcript may be wrong."
        : "No normalized word differences found. This does not confirm correct recitation."
    }</p><p lang="ar" dir="rtl" class="arabic">${esc(transcript)}</p><ul>${
      comparison.differences.map((d) =>
        `<li>${esc(d.type.replaceAll("_", " "))} · ${
          d.wordIndex ? `word ${d.wordIndex}` : `after word ${d.afterWord}`
        } <span lang="ar" dir="rtl">${esc(d.expected || "—")} / ${
          esc(d.heard || "—")
        }</span></li>`
      ).join("")
    }</ul><p>${
      comparison.uncertainty.map(esc).join(" ")
    }</p><p>Reference (unchanged verified text)</p><p class="arabic" lang="ar" dir="rtl">${
      esc(result.verifiedText)
    }</p><label>Correct an inaccurate transcript (local only)<textarea data-ai-correction lang="ar" dir="rtl" maxlength="12000"></textarea></label><button class="text-button" data-ai-recompare>Compare my corrected transcript</button><p>Corrected text is learner input, never Quran reference text or verified recitation.</p><label>Report analysis quality (category only)<select data-ai-feedback><option value="uncertain">Uncertain</option><option value="helpful">Helpful</option><option value="false_positive">Flagged a correct word</option><option value="false_negative">Missed an incorrect word</option><option value="inaccurate_transcript">Transcription was inaccurate</option></select></label><button class="text-button" data-ai-send-feedback>Send quality feedback</button><p>Model: ${
      esc(result.metadata.model)
    } · ${esc(result.metadata.modelVersion)} · ${
      esc(COMPARISON_VERSION)
    }. Teacher evaluation: not yet established.</p>`;
    find("[data-ai-correction]").value = transcript;
    find("[data-ai-recompare]").onclick = () => {
      const correctedText = find("[data-ai-correction]").value;
      display(
        compareTranscript(result.verifiedWords, correctedText),
        correctedText,
        true,
      );
      status(
        "Local learner correction only. Your saved memory assessment has not changed.",
      );
    };
    find("[data-ai-send-feedback]").onclick = async () => {
      try {
        const c = await account(),
          response = await c.rpc("recitation_ai_feedback", {
            p_request: result.requestId,
            p_feedback: find("[data-ai-feedback]").value,
          });
        if (response.error) throw Error("Could not save feedback.");
        status(
          "Quality category saved privately. No recording, transcript or correction was uploaded with this feedback.",
        );
      } catch (error) {
        status(error.message);
      }
    };
  }
  find("[data-ai-submit]").onclick = async () => {
    if (
      !enabled || pending || !blob || !context?.declaredRecited ||
      !find("[data-ai-consent]").checked
    ) return;
    if (blob.size > MAX_AUDIO_BYTES) {
      status(
        "Recording exceeds the 8 MiB upload limit. Record a shorter ayah (up to two minutes for AI).",
      );
      return;
    }
    const request = ++generation;
    pending = true;
    controller = new AbortController();
    update();
    try {
      const c = await account();
      if (disposed || request !== generation) return;
      const form = new FormData();
      form.set("audio", blob, "recitation");
      form.set("reference", context.key);
      form.set("requestId", crypto.randomUUID());
      form.set("consent", POLICY_VERSION);
      status(
        "Sending to the transcription provider. Do not use this result as a mastery grade.",
      );
      const response = await c.functions.invoke("recitation-compare", {
        body: form,
        signal: controller.signal,
      });
      if (disposed || request !== generation) return;
      if (response.error) {
        let message =
          "Comparison unavailable. Use local playback and self-assessment.";
        try {
          message = (await response.error.context.json()).error || message;
        } catch {}
        throw Error(message);
      }
      result = response.data;
      find("[data-ai-access-status]").textContent =
        `${result.usage.used} / ${result.usage.allowance} requests used this UTC calendar month.`;
      display(result.comparison, result.transcript);
      status(
        `Experimental comparison ready. ${result.usage.used} / ${result.usage.allowance} monthly requests used. Original reciter audio remains available above.`,
      );
    } catch (error) {
      if (!disposed && request === generation) status(error.message);
    } finally {
      if (request === generation) {
        pending = false;
        update();
      }
    }
  };
  function reset() {
    generation++;
    controller?.abort();
    controller = null;
    pending = false;
    blob = null;
    result = null;
    find("[data-ai-result]").replaceChildren();
    find("[data-ai-consent]").checked = false;
    status("");
    update();
  }
  find("[data-ai-delete]").onclick = async () => {
    reset();
    clearRecording();
    try {
      const c = await account(),
        response = await c.rpc("delete_my_recitation_analysis");
      if (response.error) {
        throw Error(
          "Local recording and analysis cleared. Server metadata deletion failed; retry when connected.",
        );
      }
      status(
        "Local recording, transcript and analysis cleared; server analysis metadata deleted. Non-content usage counters remain to enforce limits. Already submitted provider processing cannot be recalled.",
      );
    } catch (error) {
      status(
        error.message.startsWith("Sign in")
          ? "Local recording and analysis cleared. Sign in to delete any prior server analysis metadata."
          : error.message,
      );
    }
  };
  return {
    element,
    setRecording(value) {
      blob = value;
      update();
    },
    setContext(value) {
      if (context?.id !== value.id) reset();
      context = value;
      update();
    },
    onDelete(fn) {
      clearRecording = fn;
    },
    reset,
    dispose() {
      disposed = true;
      reset();
    },
  };
}
