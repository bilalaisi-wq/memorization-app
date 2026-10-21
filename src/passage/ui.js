import {
  canonicalSlice,
  studySegmentation,
} from "../../supabase/functions/_shared/segmentation.js";
import { esc } from "../ui/dom.js";
import {
  loadAudio,
  loadBundle,
  localBundle,
  reference,
  referenceOptions,
} from "../content/library.js";
import {
  reviewedSegments,
  segmentAudioReviewed,
} from "../../supabase/functions/_shared/content-policy.js";
import {
  correct,
  hiddenWord,
  recallUnit,
  shuffled,
  WINDOW_SIZE,
  wordWindow,
} from "./model.js";
import { createPassageMemory, PASSAGE_MEMORY_KEY } from "./memory.js";
import { scopedStorage } from "../learner/profile-storage.js";
import {
  studyAudioStart,
  studyAudioStop,
  successCue,
} from "../ui/encouragement.js";
import "./passage.css";
export function openPassageStudio(ctx) {
  const d = document.createElement("dialog");
  d.className = "account-dialog passage-studio";
  const storage = ctx.user ? scopedStorage(ctx.user.id) : localStorage,
    memory = createPassageMemory(storage);
  const options = referenceOptions();
  let bundle = null,
    page = 0,
    level = 0,
    segmentId = "full",
    selectedRefs = ["1:1"],
    chain = [],
    orders = {},
    bank = [],
    windowSequence = [],
    audio = null,
    audioResource = null,
    generation = 0,
    assessmentBundles = null;
  const cache = new Map();
  let loading = false,
    work = { version: 1, records: {}, refs: ["1:1"] },
    workWarning = "";
  try {
    const saved = JSON.parse(storage.getItem("ayah-passage-workspaces-v1"));
    if (saved) {
      if (
        saved.version !== 1 || !saved.records || !Array.isArray(saved.refs) ||
        saved.refs.length > 10
      ) throw Error();
      work = saved;
      selectedRefs = saved.refs.map((k) => reference(k).key);
    }
  } catch {
    workWarning =
      "Saved workspace needs recovery; it has not been overwritten.";
  }
  const workKey = () =>
    `${bundle.key}:${segmentId}:${bundle.contentRevision || "free-v1"}:${
      bundle.segmentationReview?.version || "draft-0.1"
    }`;
  function persistWork() {
    if (workWarning || !bundle) return;
    work.records[workKey()] = { page, orders, windowSequence, level };
    work.refs = selectedRefs;
    try {
      storage.setItem("ayah-passage-workspaces-v1", JSON.stringify(work));
    } catch {
      note(
        "Workspace could not save. Passage review history is separate.",
        true,
      );
    }
  }
  function restoreWork() {
    const previous = work.records[workKey()];
    if (
      previous && Number.isInteger(previous.page) &&
      Array.isArray(previous.windowSequence) && previous.orders &&
      [0, 1, 2].includes(previous.level)
    ) {
      page = previous.page;
      orders = previous.orders;
      windowSequence = previous.windowSequence;
      level = previous.level;
    }
  }

  d.innerHTML =
    '<button class="text-button" data-close>Close ×</button><h2>Passage Builder · memorization studio</h2><div data-studio></div><p data-studio-status role="status" aria-live="polite"></p>';
  const root = d.querySelector("[data-studio]"),
    status = d.querySelector("[data-studio-status]");
  const note = (text, error = false) => {
    status.textContent = text;
    status.dataset.tone = error ? "error" : "info";
  };
  function stop() {
    generation++;
    audio?.pause();
    if (audio) audio.src = "";
    audio = null;
    audioResource?.revoke();
    audioResource = null;
    studyAudioStop("passage");
  }
  const close = () => {
    stop();
    d.close();
    d.remove();
  };
  d.querySelector("[data-close]").onclick = close;
  d.oncancel = close;
  const get = async (key) => {
    if (cache.has(key)) return cache.get(key);
    const b = await loadBundle(key, ctx.client);
    cache.set(key, b);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return b;
  };
  async function select(key) {
    stop();
    loading = true;
    note("Loading validated content…");
    const request = generation;
    try {
      const b = await get(key);
      if (!d.isConnected || request !== generation) return;
      bundle = b;
      segmentId = "full";
      page = 0;
      orders = {};
      windowSequence = [];
      assessmentBundles = null;
      restoreWork();
      draw();
      note(
        "Repeat aloud after the reciter. Visual workspace boundaries are not recitation stops.",
      );
    } catch (e) {
      draw();
      note(e.message, true);
    } finally {
      loading = false;
    }
  }
  async function play(b = bundle, seg = null) {
    if (!b || loading) return;
    if (seg?.kind === "reviewed" && !segmentAudioReviewed(seg, b)) {
      return note(
        "Segment audio timings are not reviewed yet. Listen to the whole ayah in practice.",
        true,
      );
    }
    const active = memory.snapshot().active;
    if (active && !active.graded) memory.update("assisted");
    stop();
    const request = generation;
    studyAudioStart("passage");
    try {
      const resource = await loadAudio(b, ctx.client);
      if (request !== generation || !d.isConnected) {
        resource.revoke();
        return;
      }
      audioResource = resource;
      audio = new Audio(resource.url);
      if (seg?.kind === "reviewed") {
        audio.currentTime = seg.startMs / 1000;
        audio.ontimeupdate = () => {
          if (audio && audio.currentTime >= seg.endMs / 1000) stop();
        };
      }
      audio.onended = () => stop();
      audio.onerror = () => {
        stop();
        note("Recitation could not play. Try again.", true);
      };
      await audio.play();
    } catch (e) {
      stop();
      note(e.message, true);
    }
  }
  const currentSegment = () =>
    bundle?.segments.find((s) => s.id === segmentId) || null;
  function currentWindow() {
    return wordWindow(
      bundle,
      page,
      segmentId === "full" ? null : currentSegment(),
    );
  }
  function resetWindow() {
    const w = currentWindow();
    orders[page] ??= [];
    bank = shuffled(
      w.words.filter((x) => !orders[page].includes(x.position)).map((w) =>
        w.position
      ),
    );
    if (!windowSequence.length) {
      windowSequence = shuffled(Array.from({ length: w.count }, (_, i) => i));
    }
  }
  function draw() {
    d.dataset.recallActive = "false";
    const active = memory.snapshot().active;
    if (active && !active.graded) {
      drawAssessment();
      return;
    }
    if (!bundle) {
      root.innerHTML =
        '<p>Build a passage from the verified library. Free ayahs work without an account.</p><button class="primary" data-start>Start with Al-Fatihah</button>';
      root.querySelector("[data-start]").onclick = () => select("1:1");
      return;
    }
    resetWindow();
    persistWork();
    const w = currentWindow(),
      selected = orders[page] || [],
      textAt = (id) => bundle.words.find((x) => x.position === id)?.text || "";
    root.innerHTML =
      `<p>Work a few words at a time, reconstruct the full ayah, then recite independently. <strong>Visual pages are not approved recitation stops.</strong> Full-ayah audio continues across visual pages.</p><div class="passage-toolbar"><label>Ayah<select data-reference>${
        options.map((o) =>
          `<option value="${o.key}" ${o.key === bundle.key ? "selected" : ""}>${
            esc(o.label)
          }</option>`
        ).join("")
      }</select></label><button class="text-button" data-add-ref>Add to my passage</button></div><p>Current: ${bundle.key} · Juz ${bundle.juz} · ${bundle.words.length} words</p><details data-full-reference><summary>Full verified ayah and translation</summary><p class="arabic" lang="ar" dir="rtl">${
        esc(bundle.textUthmani)
      }</p><p>${esc(bundle.translation)}</p><p>${
        bundle.sources.map((s) =>
          `<a href="${
            esc(s.url)
          }" target="_blank" rel="noopener noreferrer">Source</a>`
        ).join(" · ")
      }</p></details><div class="passage-toolbar"><button class="primary" data-listen>Listen to full ayah</button><button class="text-button" data-stop>Stop audio</button><label>Recitation unit<select data-segment>${
        reviewedSegments(bundle).map((s) =>
          `<option value="${esc(s.id)}" ${
            s.id === segmentId ? "selected" : ""
          }>${
            s.kind === "whole-ayah"
              ? "Whole ayah"
              : `Reviewed segment: words ${s.firstWord}–${s.lastWord}`
          }</option>`
        ).join("")
      }</select></label>${
        segmentId !== "full" && segmentAudioReviewed(currentSegment(), bundle)
          ? '<button class="text-button" data-segment-audio>Listen to reviewed segment</button>'
          : ""
      }</div>${
        reviewedSegments(bundle).length === 1
          ? "<p>No internal recitation segments are approved for this ayah. Practice visual windows while listening to the complete ayah.</p>"
          : ""
      }<div class="passage-toolbar"><button class="text-button" data-prev ${
        w.page === 0 ? "disabled" : ""
      }>Previous workspace</button><strong>Visual workspace ${
        w.page + 1
      } / ${w.count} · Phrase ${w.phrase} / ${w.phraseCount}</strong><button class="text-button" data-next ${
        w.page + 1 === w.count ? "disabled" : ""
      }>Next workspace</button><label>Word hints<select data-hints><option value="0" ${
        level === 0 ? "selected" : ""
      }>All visible</option><option value="1" ${
        level === 1 ? "selected" : ""
      }>Some hidden</option><option value="2" ${
        level === 2 ? "selected" : ""
      }>All hidden</option></select></label><button class="text-button" data-reveal>Reveal this workspace</button></div><p class="arabic phrase-context" lang="ar" dir="rtl">${
        level === 0
          ? esc(canonicalSlice(bundle, w.startWord, w.endWord))
          : "Phrase reference hidden with word hints"
      }</p><p>${
        w.continuation
          ? "Continue the phrase into the next workspace; this is not recitation stop guidance."
          : "Study boundary only. Full-ayah recitation remains continuous."
      }</p><p>Say each word as you move it. Hidden pieces are practice, not an independent recall assessment.</p><div class="passage-piece-zone" data-place="built" dir="rtl">${
        selected.map((id, i) =>
          `<span class="passage-token"><button draggable="true" data-word="${id}" aria-label="Return piece ${
            i + 1
          }">${
            hiddenWord(id, level)
              ? '<span aria-hidden="true">✧</span>'
              : `<span lang="ar">${esc(textAt(id))}</span>`
          }</button><button class="text-button" data-move="${id}:-1" aria-label="Move piece earlier">←</button><button class="text-button" data-move="${id}:1" aria-label="Move piece later">→</button></span>`
        ).join("") || "<p>Move words here in order.</p>"
      }</div><div class="passage-piece-zone passage-word-bank" data-place="bank" dir="rtl">${
        bank.map((id) =>
          `<button class="passage-token" draggable="true" data-word="${id}" aria-label="Add word piece">${
            hiddenWord(id, level)
              ? "✧"
              : `<span lang="ar">${esc(textAt(id))}</span>`
          }</button>`
        ).join("")
      }</div><button class="primary" data-check-window>Check workspace</button><h3>Full-ayah reconstruction</h3><p>Arrange completed visual workspaces in ayah order, then check the whole ayah. Each card is an excerpt, not a recitation stop.</p><div class="workspace-chain">${
        windowSequence.map((p, i) => {
          const words = wordWindow(
            bundle,
            p,
            segmentId === "full" ? null : currentSegment(),
          ).words;
          return `<div><span class="arabic" dir="rtl" lang="ar">${
            esc(words[0].text)
          } … ${
            esc(words.at(-1).text)
          }</span><button class="text-button" data-window-move="${i}:-1" aria-label="Move workspace earlier">↑</button><button class="text-button" data-window-move="${i}:1" aria-label="Move workspace later">↓</button></div>`;
        }).join("")
      }</div><button class="primary" data-check-whole>${
        segmentId === "full" ? "Check full ayah" : "Check reviewed segment"
      } reconstruction</button><div class="passage-toolbar"><button class="primary" data-recall>Independent ${
        segmentId === "full" ? "ayah" : "segment"
      } recall</button></div><section class="passage-chain-config"><h3>My passage and Passage Chain</h3><p>Selected references: ${
        selectedRefs.join(", ")
      }. Canonical surah/ayah order is used; gaps remain explicit.</p><button class="text-button" data-clear-refs>Use current ayah only</button><button class="primary" data-chain>Challenge the ayah sequence</button><button class="primary" data-passage-recall>Independent passage recall</button><div data-chain-cards></div></section><section><h3>Passage review schedule</h3>${
        Object.values(memory.snapshot().records).map((r) =>
          `<p>${esc(r.unit.type)} ${esc(r.unit.refs.join(", "))} · ${
            r.card
              ? "Next review " + new Date(r.card.due).toLocaleString()
              : "Not independently scheduled"
          }</p>`
        ).join("") ||
        "<p>No passage reviews yet. Reconstruction alone does not schedule recall.</p>"
      }<button class="text-button" data-sync>Sync private passage reviews</button><button class="text-button" data-export>Export passage review data</button></section>`;
    root.querySelector("[data-reference]").onchange = (e) =>
      select(e.target.value);
    root.querySelector("[data-add-ref]").onclick = () => {
      if (selectedRefs.length >= 10) {
        return note("Choose up to ten ayahs per passage.", true);
      }
      if (!selectedRefs.includes(bundle.key)) selectedRefs.push(bundle.key);
      selectedRefs.sort((a, b) => {
        const x = reference(a), y = reference(b);
        return x.surah - y.surah || x.ayah - y.ayah;
      });
      draw();
    };
    root.querySelector("[data-clear-refs]").onclick = () => {
      selectedRefs = [bundle.key];
      draw();
    };
    root.querySelector("[data-listen]").onclick = () => play();
    root.querySelector("[data-stop]").onclick = stop;
    root.querySelector("[data-segment-audio]")?.addEventListener(
      "click",
      () => play(bundle, currentSegment()),
    );
    root.querySelector("[data-segment]").onchange = (e) => {
      stop();
      segmentId = e.target.value;
      page = 0;
      orders = {};
      windowSequence = [];
      restoreWork();
      draw();
    };
    root.querySelector("[data-prev]").onclick = () => {
      page--;
      draw();
    };
    root.querySelector("[data-next]").onclick = () => {
      page++;
      draw();
    };
    root.querySelector("[data-hints]").onchange = (e) => {
      level = Number(e.target.value);
      draw();
    };
    root.querySelector("[data-reveal]").onclick = () => {
      level = 0;
      draw();
      note("Hint revealed. Use independent recall later to assess memory.");
    };
    root.querySelectorAll("[data-word]").forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.word);
        if (selected.includes(id)) {
          orders[page] = selected.filter((x) => x !== id);
        } else orders[page] = [...selected, id];
        draw();
      };
      b.ondragstart = (e) =>
        e.dataTransfer.setData("text/plain", b.dataset.word);
      b.ondragover = (e) => e.preventDefault();
      b.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!w.words.some((x) => x.position === id)) return;
        const next = selected.filter((x) => x !== id);
        next.splice(Math.max(0, next.indexOf(Number(b.dataset.word))), 0, id);
        orders[page] = next;
        draw();
      };
    });
    root.querySelectorAll("[data-place]").forEach((zone) => {
      zone.ondragover = (e) => e.preventDefault();
      zone.ondrop = (e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (!w.words.some((x) => x.position === id)) return;
        orders[page] = zone.dataset.place === "bank"
          ? selected.filter((x) => x !== id)
          : [...selected.filter((x) => x !== id), id];
        draw();
      };
    });
    root.querySelectorAll("[data-move]").forEach((b) =>
      b.onclick = () => {
        const [id, delta] = b.dataset.move.split(":").map(Number),
          next = [...selected],
          i = next.indexOf(id),
          j = i + delta;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        orders[page] = next;
        draw();
      }
    );
    root.querySelector("[data-check-window]").onclick = () => {
      const good = correct(selected, w.words);
      note(
        good
          ? "Workspace correct. Keep connecting the ayah."
          : "Reorder the pieces and try again.",
        !good,
      );
      if (good) {
        successCue(
          `passage-window-${bundle.key}-${page}`,
          "Beautiful work. Connect what you remember.",
        );
      }
    };
    root.querySelectorAll("[data-window-move]").forEach((b) =>
      b.onclick = () => {
        const [i, delta] = b.dataset.windowMove.split(":").map(Number),
          j = i + delta;
        if (j < 0 || j >= windowSequence.length) return;
        [windowSequence[i], windowSequence[j]] = [
          windowSequence[j],
          windowSequence[i],
        ];
        draw();
      }
    );
    root.querySelector("[data-check-whole]").onclick = () => {
      const whole = windowSequence.flatMap((p) => orders[p] || []),
        target = bundle.words.slice(
          (segmentId === "full" ? 1 : currentSegment().firstWord) - 1,
          segmentId === "full"
            ? bundle.words.length
            : currentSegment().lastWord,
        ),
        good = correct(whole, target);
      note(
        good
          ? "Reconstruction correct. Now try reciting independently."
          : "Complete each workspace and check their sequence.",
        !good,
      );
      if (good) {
        successCue(
          `passage-whole-${bundle.key}`,
          "Ayah connected. Keep growing.",
        );
      }
    };
    root.querySelector("[data-recall]").onclick = () =>
      beginRecall([bundle], segmentId === "full" ? null : currentSegment());
    root.querySelector("[data-passage-recall]").onclick = async () => {
      try {
        note("Loading the selected passage…");
        const all = await Promise.all(selectedRefs.map(get));
        beginRecall(all);
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-chain]").onclick = async () => {
      try {
        const all = await Promise.all(selectedRefs.map(get));
        chain = shuffled(all.map((b) => b.key));
        drawChain(all);
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-sync]").onclick = async () => {
      try {
        note(await memory.sync(ctx.client, ctx.user?.id));
        draw();
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-export]").onclick = () => {
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(memory.snapshot(), null, 2)], {
            type: "application/json",
          }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "ayah-passage-reviews.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  function drawChain(all) {
    const area = root.querySelector("[data-chain-cards]");
    area.innerHTML =
      chain.map((key, i) =>
        `<div><p class="arabic" lang="ar" dir="rtl">${
          esc(
            all.find((b) => b.key === key).words.slice(0, 4).map((w) => w.text)
              .join(" "),
          )
        } …</p><button class="text-button" data-chain-move="${i}:-1">Move earlier</button><button class="text-button" data-chain-move="${i}:1">Move later</button></div>`
      ).join("") +
      '<button class="primary" data-check-chain>Check Passage Chain</button>';
    area.querySelectorAll("[data-chain-move]").forEach((b) =>
      b.onclick = () => {
        const [i, delta] = b.dataset.chainMove.split(":").map(Number),
          j = i + delta;
        if (j < 0 || j >= chain.length) return;
        [chain[i], chain[j]] = [chain[j], chain[i]];
        drawChain(all);
      }
    );
    area.querySelector("[data-check-chain]").onclick = () => {
      const good = chain.every((k, i) => k === selectedRefs[i]);
      note(
        good
          ? "Passage Chain correct. Try independent passage recall next."
          : "The ayah sequence needs another look.",
        !good,
      );
      if (good) successCue("passage-chain", "Your passage is connected.");
    };
  }
  async function beginRecall(all, segment = null) {
    try {
      stop();
      assessmentBundles = all;
      const unit = await recallUnit(all, segment);
      memory.begin(unit);
      drawAssessment();
      note(
        "Self-assessed recitation. No automatic speech verification is performed.",
      );
    } catch (e) {
      note(e.message, true);
    }
  }
  async function drawAssessment() {
    d.dataset.recallActive = "true";
    stop();
    const a = memory.snapshot().active;
    if (!a || a.graded) {
      draw();
      return;
    }
    const unit = memory.snapshot().records[a.unitId].unit;
    // Never render the word bank/reference while attempting independent recall.
    root.innerHTML = `<h3>Independent ${esc(unit.type)} recall</h3><p>Recite ${
      esc(unit.refs.join(", "))
    }${
      unit.type === "segment"
        ? ` · reviewed words ${unit.firstWord}–${unit.lastWord}`
        : ""
    } from memory. This is self-assessed recitation, not automatic speech verification.</p><button class="primary" data-declare ${
      a.declared ? "disabled" : ""
    }>I recited from memory</button><button class="text-button" data-compare>Reveal verified text and compare</button><button class="text-button" data-recall-listen>Listen to reciter (study assistance)</button><button class="text-button" data-abandon>Return to practice</button><div data-comparison></div><div data-grades></div>`;
    root.querySelector("[data-declare]").onclick = () => {
      try {
        memory.update("declared");
        drawAssessment();
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-compare]").onclick = async () => {
      try {
        assessmentBundles = assessmentBundles ||
          await Promise.all(unit.refs.map(get));
        if (unit.type === "segment") {
          const s = assessmentBundles[0].segments.find((s) =>
            s.id === unit.segment
          );
          if (!s || (await recallUnit(assessmentBundles, s)).id !== unit.id) {
            throw Error(
              "This segment review changed. Start a new assessment after checking the reviewed boundaries.",
            );
          }
        }
        memory.update("compared");
        showComparison();
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-recall-listen]").onclick = async () => {
      try {
        const b = await get(unit.refs[0]);
        await play(
          b,
          unit.type === "segment"
            ? b.segments.find((s) => s.id === unit.segment)
            : null,
        );
        note(
          "Listening before declaring recall makes this assessment assisted. For a multi-ayah passage, compare each complete ayah after revealing.",
        );
      } catch (e) {
        note(e.message, true);
      }
    };
    root.querySelector("[data-abandon]").onclick = () => {
      try {
        memory.update("abandon");
        memory.update("compared");
        const current = memory.snapshot().active;
        memory.grade(current.id, "Again");
        assessmentBundles = null;
        draw();
        note(
          "Returned to practice. Assisted attempts do not schedule independent recall.",
        );
      } catch (e) {
        note(e.message, true);
      }
    };
    if (a.compared) {
      try {
        assessmentBundles = assessmentBundles ||
          await Promise.all(unit.refs.map(get));
        if (unit.type === "segment") {
          const s = assessmentBundles[0].segments.find((s) =>
            s.id === unit.segment
          );
          if (!s || (await recallUnit(assessmentBundles, s)).id !== unit.id) {
            throw Error(
              "This segment review changed. Start a new assessment after checking reviewed boundaries.",
            );
          }
        }
        showComparison();
      } catch (e) {
        note(e.message, true);
      }
    }
  }
  function showComparison() {
    const a = memory.snapshot().active,
      unit = memory.snapshot().records[a.unitId].unit,
      area = root.querySelector("[data-comparison]");
    if (!area) return;
    area.innerHTML = assessmentBundles.map((b) =>
      `<section><h4>${b.key}</h4><p class="arabic" lang="ar" dir="rtl">${
        esc(
          unit.type === "segment"
            ? b.words.slice(unit.firstWord - 1, unit.lastWord).map((w) =>
              w.text
            ).join(" ")
            : b.textUthmani,
        )
      }</p><p>${
        unit.type === "segment"
          ? "Excerpt of the referenced ayah; see the full ayah in practice."
          : esc(b.translation)
      }</p><button class="text-button" data-compare-audio="${b.key}">Listen to ${b.key}</button></section>`
    ).join("");
    area.querySelectorAll("[data-compare-audio]").forEach((b) =>
      b.onclick = () =>
        play(
          assessmentBundles.find((x) => x.key === b.dataset.compareAudio),
          unit.type === "segment"
            ? assessmentBundles[0].segments.find((s) => s.id === unit.segment)
            : null,
        )
    );
    root.querySelector("[data-grades]").innerHTML = [
      "Again",
      "Hard",
      "Good",
      "Easy",
    ].map((grade) =>
      `<button class="primary" data-grade="${grade}">${grade}</button>`
    ).join("");
    root.querySelectorAll("[data-grade]").forEach((b) =>
      b.onclick = () => {
        try {
          stop();
          const result = memory.grade(a.id, b.dataset.grade);
          assessmentBundles = null;
          draw();
          note(
            `${
              result.independent ? "Independent" : "Assisted"
            } self-assessment saved. ${
              result.scheduled
                ? "Next review " + new Date(result.nextReview).toLocaleString()
                : result.independent
                ? "The existing due date is preserved."
                : "Independent recall was not scheduled."
            }`,
          );
        } catch (e) {
          note(e.message, true);
        }
      }
    );
  }
  document.body.append(d);
  d.showModal();
  draw();
  if (memory.warning || workWarning) note(memory.warning || workWarning, true);
}
