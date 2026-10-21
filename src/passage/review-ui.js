import "./passage.css";
import { esc } from "../ui/dom.js";
import {
  availability,
  loadAudio,
  loadBundle,
  localBundle,
  referenceOptions,
} from "../content/library.js";
import {
  canonicalSlice,
  draftSegments,
  validatePartition,
} from "../../supabase/functions/_shared/segmentation.js";
export async function openReview(ctx, initialRole) {
  const worklist = referenceOptions().filter((o) => {
    const local = localBundle(o.key);
    return local
      ? local.words.length > 12
      : availability.premium.find((p) => p.key === o.key)?.wordCount > 12;
  });
  const d = window.document.createElement("dialog");
  d.className = "account-dialog passage-studio";
  d.innerHTML =
    `<button class="text-button" data-close>Close ×</button><h2>Teacher / scholar segmentation review</h2><p>Draft study boundaries are not certified recitation stops. Approve visual chunking, waqf, restart positions and audio timings separately. Canonical Arabic is read-only.</p><label>Reference<select data-review-ref>${
      worklist.map((o) => `<option value="${o.key}">${esc(o.label)}</option>`)
        .join("")
    }</select></label><div data-review-body></div><p data-review-status role="status"></p>`;
  const root = d.querySelector("[data-review-body]"),
    status = d.querySelector("[data-review-status]");
  let bundle,
    reviewDoc,
    head,
    history = [],
    role = initialRole,
    audioResource = null;
  const close = () => {
    d.querySelector("audio")?.pause();
    audioResource?.revoke();
    d.close();
    d.remove();
  };
  d.querySelector("[data-close]").onclick = close;
  d.oncancel = close;
  window.document.body.append(d);
  d.showModal();
  const note = (text) => status.textContent = text;
  async function load(key) {
    root.textContent = "Loading authoritative text and review history…";
    try {
      const permissions = await ctx.client.rpc("my_quran_review_role");
      role = permissions.data;
      if (!role) {
        root.textContent =
          "A project administrator must assign a qualified, enabled teacher/scholar role. Developer login alone cannot certify recitation stops.";
        return;
      }
      bundle = await loadBundle(key, ctx.client);
      reviewDoc = draftSegments(bundle);
      const result = await ctx.client.rpc("get_segmentation_review", {
        reference: key,
      });
      if (result.error) {
        throw Error(
          "Review service is not deployed or your reviewer role is unavailable.",
        );
      }
      head = result.data.head;
      history = result.data.history || [];
      if (head?.source_hash !== bundle.contentRevision) {
        throw Error(
          "Review registry and canonical source hash differ. An administrator must register the new source; existing approvals are preserved in the audit history.",
        );
      }
      if (history.length) {
        const latest = history[0];
        reviewDoc = {
          ...reviewDoc,
          version: latest.version,
          sourceEdition: latest.source_edition,
          riwayah: latest.riwayah,
          segments: latest.segments.map((s) => ({ ...s })),
        };
      }
      draw();
      note("No change is saved until you submit a new review revision.");
    } catch (e) {
      root.textContent = "Review could not be loaded.";
      note(e.message);
    }
  }
  const statusOptions = (value) =>
    ["pending_review", "approved", "rejected"].map((s) =>
      `<option value="${s}" ${s === value ? "selected" : ""}>${
        s.replace("_", " ")
      }</option>`
    ).join("");
  function draw() {
    const source = draftSegments(bundle);
    root.innerHTML = `<p><strong>${esc(role.name)}</strong> · ${
      esc(role.role)
    } · ${
      esc(role.credentials)
    }</p><p>Source: ${bundle.key}; ${bundle.words.length} orthographic words; current revision ${
      reviewDoc.version || 0
    }. Word indices are 1-based and inclusive. This form never edits the Qur’anic text.</p><label>Source Mushaf edition<input data-edition value="${
      esc(reviewDoc.sourceEdition)
    }" maxlength="250" required></label><label>Riwāyah<input data-riwayah value="${
      esc(reviewDoc.riwayah)
    }" maxlength="150" required></label><details><summary>Read the complete canonical ayah</summary><p class="arabic" lang="ar" dir="rtl">${
      esc(bundle.textUthmani)
    }</p></details><button class="text-button" data-review-audio>Load full source recitation for timing review</button><audio controls data-timing-player></audio><div class="review-segments">${
      reviewDoc.segments.map((s, i) => {
        const origin = source.segments.find((r) => r.id === s.id),
          actual = (canonicalSlice(bundle, s.endWord, s.endWord).match(
            /[\u06d6-\u06dc]/g,
          ) || []).at(-1) ||
            (s.endWord === bundle.words.length ? "end_of_ayah" : "none");
        return `<fieldset data-review-row="${i}"><legend>Study phrase ${s.id} · words ${s.startWord}–${s.endWord}</legend><p class="arabic" lang="ar" dir="rtl">${
          esc(canonicalSlice(bundle, s.startWord, s.endWord))
        }</p><p>${
          bundle.words.slice(s.startWord - 1, s.endWord).map((w) =>
            `<span class="word-id"><b>${w.position}</b> <span lang="ar" dir="rtl">${
              esc(w.text)
            }</span></span>`
          ).join(" ")
        }</p><p>Draft mark: ${
          esc(origin?.pauseMark || s.pauseMark || "none")
        } · Actual source: ${esc(actual)} ${
          (origin?.symbolMismatch ||
              (origin?.pauseMark || s.pauseMark || "none") !== actual)
            ? '<strong role="status">Symbol mismatch — manual review required.</strong>'
            : ""
        }</p><label>End word<input type="number" data-field="endWord" min="${s.startWord}" max="${
          i === reviewDoc.segments.length - 1
            ? bundle.words.length
            : reviewDoc.segments[i + 1].endWord - 1
        }" value="${s.endWord}" ${
          i === reviewDoc.segments.length - 1 ? "readonly" : ""
        }></label><label>Visual chunking<select data-field="displayStatus">${
          statusOptions(s.displayStatus)
        }</select></label><label>Waqf / recitation stop<select data-field="stopStatus">${
          statusOptions(s.stopStatus)
        }</select></label><label>Individually approved restart word<input type="number" data-field="restartWord" min="1" max="${bundle.words.length}" value="${
          s.restartWord || ""
        }"></label><label>Recitation portion audio start (ms)<input type="number" data-field="audioStartMs" min="0" value="${
          s.audioStartMs ?? ""
        }"></label><label>Recitation portion audio end (ms)<input type="number" data-field="audioEndMs" min="0" value="${
          s.audioEndMs ?? ""
        }"></label><label><input type="checkbox" data-field="audioApproved" ${
          s.audioApproved ? "checked" : ""
        }> I checked these timings against the exact Alafasy recording, including the approved restart.</label><label>Review note<input data-field="note" maxlength="500" value="${
          esc(s.note || "")
        }"></label></fieldset>`;
      }).join("")
    }</div><button class="primary" data-save-review>Submit new review revision</button><h3>Revision history</h3>${
      history.map((h) =>
        `<details><summary>Revision ${h.version} · ${esc(h.reviewer_name)} · ${
          esc(h.reviewed_at)
        }</summary><p>${esc(h.reviewer_credentials)} · ${
          esc(h.source_edition)
        } · ${esc(h.riwayah)}</p><pre>${
          esc(JSON.stringify(h.segments, null, 2))
        }</pre></details>`
      ).join("") || "<p>No review decisions have been published.</p>"
    }`;
    root.querySelector("[data-review-audio]").onclick = async () => {
      try {
        audioResource?.revoke();
        audioResource = await loadAudio(bundle, ctx.client);
        if (!d.isConnected) {
          audioResource.revoke();
          return;
        }
        root.querySelector("audio").src = audioResource.url;
      } catch (e) {
        note(e.message);
      }
    };
    root.querySelector("[data-edition]").oninput = (e) =>
      reviewDoc.sourceEdition = e.target.value;
    root.querySelector("[data-riwayah]").oninput = (e) =>
      reviewDoc.riwayah = e.target.value;
    root.querySelectorAll("[data-review-row]").forEach((row) => {
      row.querySelectorAll("[data-field]").forEach((input) =>
        input.onchange = () => {
          const i = Number(row.dataset.reviewRow),
            s = reviewDoc.segments[i],
            name = input.dataset.field;
          const value = name === "audioApproved"
            ? input.checked
            : ["endWord", "restartWord", "audioStartMs", "audioEndMs"].includes(
                name,
              )
            ? (input.value === "" ? null : Number(input.value))
            : input.value;
          s[name] = value;
          if (name === "endWord" && reviewDoc.segments[i + 1]) {
            reviewDoc.segments[i + 1].startWord = value + 1;
            reviewDoc.segments[i + 1].displayStatus = "pending_review";
            reviewDoc.segments[i + 1].stopStatus = "pending_review";
            reviewDoc.segments[i + 1].audioApproved = false;
          }
          if (["endWord", "restartWord"].includes(name)) {
            s.stopStatus = "pending_review";
            s.audioApproved = false;
          }
          if (
            ["endWord", "restartWord", "audioStartMs", "audioEndMs"].includes(
              name,
            )
          ) {
            if (name.startsWith("audio")) s.audioApproved = false;
            draw();
          }
        }
      );
    });
    root.querySelector("[data-save-review]").onclick = async () => {
      try {
        reviewDoc.sourceEdition = root.querySelector("[data-edition]").value
          .trim();
        reviewDoc.riwayah = root.querySelector("[data-riwayah]").value.trim();
        validatePartition(reviewDoc.segments, bundle.words.length);
        const segments = reviewDoc.segments.map((s) =>
          Object.fromEntries(
            Object.entries(s).filter(([k]) =>
              [
                "id",
                "startWord",
                "endWord",
                "displayStatus",
                "stopStatus",
                "restartWord",
                "pauseMark",
                "boundaryType",
                "topic",
                "audioStartMs",
                "audioEndMs",
                "audioApproved",
                "note",
              ].includes(k)
            ),
          )
        );
        const result = await ctx.client.rpc("submit_segmentation_review", {
          reference: bundle.key,
          expected_revision: head.revision,
          source_hash: head.source_hash,
          source_edition: reviewDoc.sourceEdition,
          riwayah: reviewDoc.riwayah,
          segments,
        });
        if (result.error) {
          throw Error(
            result.error.message ||
              "Review rejected. Check indices, restart words, permissions and revision.",
          );
        }
        await load(bundle.key);
        note(
          "Review revision saved with your verified reviewer identity and server timestamp. Reopen learning to load the new decisions.",
        );
      } catch (e) {
        note(e.message);
      }
    };
  }
  d.querySelector("[data-review-ref]").onchange = (e) => load(e.target.value);
  load(worklist.some((o) => o.key === "2:255") ? "2:255" : worklist[0].key);
  d.querySelector("[data-review-ref]").value =
    worklist.some((o) => o.key === "2:255") ? "2:255" : worklist[0].key;
}
