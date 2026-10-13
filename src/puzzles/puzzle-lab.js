import { shuffled, verseAudio, wordAudio } from "../data.js";
import { outline } from "../illustrations.js";
import { esc, clearLearningView, uid } from "../ui/dom.js";
import { gameTypes } from "./puzzle-store.js";
let cleanup = null;
export function stopPuzzleLab() {
  cleanup?.();
  cleanup = null;
}
export const detectivePairs = [
  [113, 4, 5, 2],
  [109, 2, 4, 2],
  [1, 6, 7, 1],
];
export function checkedDetectivePairs(surahs) {
  return detectivePairs.map(([id, a, b, cue]) => {
    const surah = surahs.find((s) => s.id === id),
      first = surah?.verses.find((v) => v.id === a),
      second = surah?.verses.find((v) => v.id === b);
    if (
      !first ||
      !second ||
      first.words.length <= cue ||
      second.words.length <= cue
    )
      throw new Error("Detective source passage unavailable");
    return { surah, first, second, cue };
  });
}
export function mountPuzzleLab(
  main,
  surah,
  verse,
  learning,
  lab,
  callbacks,
  surahs,
) {
  stopPuzzleLab();
  clearLearningView(main);
  main.querySelector(".page-heading h1").textContent = "Puzzle Lab";
  const root = document.createElement("section");
  root.className = "puzzle-lab";
  main.append(root);
  const key = `${surah.id}:${verse.id}`,
    recommendation = lab.recommend(key, learning);
  root.innerHTML = `<div class="lab-intro"><span class="eyebrow">TRY ANOTHER WAY</span><h2>${esc(surah.name)} · Ayah ${verse.id}</h2><p>These games practice recognition, word order, and recall cues. Game XP is separate from independent spoken memorization and artwork checkpoints.</p><div class="lab-recommendation"><strong>Suggested next step</strong><p>${esc(recommendation.reason)}</p><button class="primary small" id="lab-recommended">${recommendation.game === "recall" ? "Independent recall assessment" : gameTypes.find((g) => g[0] === recommendation.game)[1]}</button></div></div><div class="lab-menu">${gameTypes.map(([id, title, description]) => `<button data-game="${id}" class="lab-game-card"><strong>${title}</strong><span>${description}</span></button>`).join("")}</div><div class="lab-settings"><label>Difficulty<select id="lab-level"><option value="1">1 · Visible words</option><option value="2">2 · Fewer cues</option><option value="3">3 · Concealed words</option><option value="4">4 · Minimal hints</option></select></label><label class="lab-timed-label"><input type="checkbox" id="lab-timed"> Timed descent (optional)</label><button class="text-button" id="lab-restart">Fresh round</button><button class="text-button" id="lab-replay">♫ Replay ayah</button><button class="text-button" id="lab-stop-audio">Stop audio</button></div><section class="lab-game" aria-label="Puzzle play area"></section><p data-status role="status" aria-live="polite"></p><div class="lab-after"><button class="text-button" id="lab-retry-save" hidden>Retry saving this result</button><button class="primary small" id="lab-next-level" hidden>Try fewer hints →</button><button class="text-button" id="lab-recall">Try independent self-assessment →</button></div>${lab.warning ? `<p role="alert">${esc(lab.warning)}</p>` : ""}`;
  const area = root.querySelector(".lab-game"),
    status = root.querySelector("[data-status]");
  let resultKey = key,
    game = "falling",
    level = 1,
    session = uid(),
    mistakes = 0,
    hinted = false,
    done = false,
    gameCleanup = null,
    audio = null,
    audioRun = 0,
    pauseGame = () => {};
  const say = (text) => {
    status.textContent = text;
  };
  const stopAudio = () => {
    audioRun++;
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
  };
  const playAudio = async (url, assistance = false) => {
    pauseGame();
    stopAudio();
    if (assistance) hinted = true;
    const run = audioRun;
    audio = new Audio(url);
    audio.onerror = () => {
      if (run === audioRun)
        say("Audio could not load. You can continue the puzzle.");
    };
    try {
      await audio.play();
    } catch {
      if (run === audioRun) say("Audio could not start. Try again.");
    }
  };
  const fail = (message) => {
    if (done) return;
    mistakes++;
    say(message || "Try another arrangement. No points are lost.");
  };
  const finish = () => {
    if (done) return;
    pauseGame();
    stopAudio();
    try {
      const reward = learning.recordLabPuzzle({
        key: resultKey,
        sessionId: session,
        game,
        mistakes,
        hinted,
      });
      lab.record({
        key: resultKey,
        sessionId: session,
        game,
        mistakes,
        hinted,
        xp: reward.xp,
      });
      done = true;
      root.querySelector("#lab-retry-save").hidden = true;
      callbacks.onWalletChange();
      say(
        `Challenge complete! +${reward.duplicate ? 0 : reward.xp} game XP. ${reward.xp && !reward.duplicate ? "" : "Today’s reward ceiling for this game is reached. "}This does not certify independent memorization.`,
      );
      area.querySelectorAll("button").forEach((b) => (b.disabled = true));
      root.querySelector("#lab-next-level").hidden =
        level >= 4 || ["match", "detective"].includes(game);
    } catch (e) {
      root.querySelector("#lab-retry-save").hidden = false;
      say(e.message + " Your result can be retried without duplicate XP.");
    }
  };
  const wordsHTML = (words) => words.map((w) => esc(w)).join(" ");
  const button = (index, text, attrs = "") =>
    `<button class="lab-word" data-choice="${index}" ${attrs}><span class="arabic" lang="ar" dir="rtl">${esc(text)}</span></button>`;
  function start(next = game) {
    gameCleanup?.();
    stopAudio();
    pauseGame = () => {};
    game = next;
    resultKey = key;
    level = Number(root.querySelector("#lab-level").value);
    session = uid();
    mistakes = 0;
    hinted = false;
    done = false;
    say("");
    root.querySelectorAll("[data-game]").forEach((b) => {
      b.classList.toggle("active", b.dataset.game === game);
      b.setAttribute("aria-pressed", String(b.dataset.game === game));
    });
    root.querySelector(".lab-timed-label").hidden = game !== "falling";
    root.querySelector("#lab-next-level").hidden = true;
    root.querySelector("#lab-retry-save").hidden = true;
    const levelControl = root.querySelector("#lab-level");
    levelControl.closest("label").hidden = ["match", "detective"].includes(
      game,
    );
    const labels = {
      falling: [
        "Visible words",
        "Some concealed",
        "All concealed",
        "All concealed",
      ],
      vanishing: ["25% hidden", "50% hidden", "75% hidden", "100% hidden"],
      jigsaw: [
        "Meanings and transliteration",
        "No meanings",
        "Concealed groups",
        "No positional hints",
      ],
      chain: [
        "Visible ayahs",
        "Visible ayahs",
        "Short opening cues",
        "One-word cues",
      ],
      continue: [
        "Opening phrase",
        "Opening phrase",
        "Shorter cue",
        "Shorter cue",
      ],
    }[game];
    if (labels)
      [...levelControl.options].forEach(
        (option, i) => (option.textContent = `${i + 1} · ${labels[i]}`),
      );
    if (game === "falling") falling();
    else if (game === "vanishing") vanishing();
    else if (game === "jigsaw") jigsaw();
    else if (game === "match") match();
    else if (game === "chain") chain();
    else if (game === "continue") continuation();
    else detective();
  }
  function falling() {
    let queue = shuffled(verse.words.length),
      cursor = 0,
      lane = 0,
      y = 0,
      paused = false,
      placed = Array(verse.words.length).fill(null),
      disposedGame = false;
    const timed = root.querySelector("#lab-timed").checked;
    area.innerHTML = `<h3>Falling Words</h3><p>Position 1 is on the right. Move the block, then place it. ${timed ? "Blocks descend gently and wait at the bottom; there is no penalty for slow placement." : "Untimed: use ↓ to lower the block whenever you are ready."}</p><div class="falling-scroll"><div class="falling-stage" tabindex="0" role="region" aria-label="Falling word board" aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown Space" style="--slots:${verse.words.length};min-width:${verse.words.length * 72}px"><div class="falling-block arabic" lang="ar" dir="rtl" role="status" aria-live="polite"></div><div class="falling-slots" dir="rtl">${verse.words.map((_, i) => `<button data-slot="${i}" aria-label="Place in position ${i + 1} from the right"><span>${i + 1}</span></button>`).join("")}</div></div></div><div class="falling-controls"><button class="text-button" id="fall-left" aria-label="Move block left">← Left</button><button class="text-button" id="fall-down">↓ Lower</button><button class="primary small" id="fall-place">Place · Space</button><button class="text-button" id="fall-right" aria-label="Move block right">Right →</button><button class="text-button" id="fall-pause">Pause</button><button class="text-button" id="fall-listen">♫ Hear this word</button></div><p class="falling-counter"></p>`;
    const stage = area.querySelector(".falling-stage"),
      block = area.querySelector(".falling-block");
    const paint = () => {
      if (disposedGame || done) return;
      const index = queue[cursor],
        hidden = level >= 3 || (level === 2 && cursor % 2 === 0);
      const text = hidden ? "؟" : verse.words[index];
      if (block.textContent !== text) block.textContent = text;
      block.dataset.index = index;
      block.dataset.lane = lane;
      block.style.right = `${(lane / verse.words.length) * 100}%`;
      block.style.width = `${100 / verse.words.length}%`;
      block.style.top = `${12 + y * 1.9}px`;
      area.querySelector(".falling-counter").textContent =
        `${placed.filter((x) => x !== null).length} / ${verse.words.length} words placed · ${paused ? "Paused" : "Ready"}`;
      area.querySelector("#fall-pause").textContent = paused
        ? "Resume"
        : "Pause";
    };
    const pause = () => {
      paused = true;
      paint();
    };
    pauseGame = pause;
    const move = (delta) => {
      if (paused || done) return;
      lane = Math.max(0, Math.min(verse.words.length - 1, lane + delta));
      paint();
      block.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    const place = (target = lane) => {
      if (paused || done) return;
      lane = target;
      if (placed[lane] !== null) {
        fail("That position is already filled. Choose an empty slot.");
        paint();
        return;
      }
      const source = queue[cursor];
      if (verse.words[source] !== verse.words[lane]) {
        fail("That word belongs in another position. Try again.");
        y = 0;
        paint();
        return;
      }
      placed[lane] = source;
      const slot = area.querySelector(`[data-slot="${lane}"]`);
      slot.classList.add("slot-filled");
      slot.innerHTML = `<span class="arabic" lang="ar" dir="rtl">${esc(verse.words[source])}</span>`;
      cursor++;
      y = 0;
      say(`Position ${lane + 1} fits!`);
      if (cursor === queue.length) {
        block.hidden = true;
        finish();
        return;
      }
      paint();
    };
    area
      .querySelectorAll("[data-slot]")
      .forEach((b) => (b.onclick = () => place(Number(b.dataset.slot))));
    area.querySelector("#fall-left").onclick = () => move(1);
    area.querySelector("#fall-right").onclick = () => move(-1);
    area.querySelector("#fall-down").onclick = () => {
      if (!paused) {
        y = Math.min(100, y + 20);
        paint();
      }
    };
    area.querySelector("#fall-place").onclick = () => place();
    area.querySelector("#fall-pause").onclick = () => {
      if (paused) stopAudio();
      paused = !paused;
      paint();
    };
    area.querySelector("#fall-listen").onclick = () =>
      playAudio(wordAudio(verse.id, queue[cursor], surah.id), true);
    stage.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowDown", " "].includes(event.key))
        return;
      if (event.target.tagName === "BUTTON" && event.key === " ") return;
      event.preventDefault();
      if (event.key === "ArrowLeft") move(1);
      if (event.key === "ArrowRight") move(-1);
      if (event.key === "ArrowDown" && !paused) {
        y = Math.min(100, y + 20);
        paint();
      }
      if (event.key === " ") place();
    };
    let dragging = false;
    block.onpointerdown = (e) => {
      if (paused || done) return;
      dragging = true;
      block.setPointerCapture(e.pointerId);
    };
    block.onpointermove = (e) => {
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      lane = Math.max(
        0,
        Math.min(
          verse.words.length - 1,
          Math.floor(((r.right - e.clientX) / r.width) * verse.words.length),
        ),
      );
      paint();
    };
    block.onpointerup = () => {
      if (dragging) {
        dragging = false;
        place();
      }
    };
    const timer = setInterval(() => {
      if (!paused && !done && timed) {
        y = Math.min(100, y + 1.25);
        paint();
      }
    }, 100);
    paint();
    gameCleanup = () => {
      disposedGame = true;
      clearInterval(timer);
      stage.onkeydown = null;
    };
  }
  function vanishing() {
    const fraction = [0.25, 0.5, 0.75, 1][level - 1],
      hide = new Set(
        shuffled(verse.words.length).slice(
          0,
          Math.ceil(verse.words.length * fraction),
        ),
      );
    const missing = [...hide].sort((a, b) => a - b),
      picked = [],
      remaining = new Set(missing);
    const draw = () => {
      area.innerHTML = `<h3>Vanishing Ayah · ${Math.round(fraction * 100)}% hidden</h3><p>Choose the missing words in order from right to left, before revealing the answer. Increase Difficulty for the next concealment step.</p><div class="vanishing-line" dir="rtl">${verse.words.map((w, i) => `<span class="arabic" lang="ar">${!hide.has(i) || picked.includes(i) ? esc(w) : "▢"}</span>`).join(" ")}</div><div class="lab-bank" dir="rtl">${shuffled(
        missing.length,
      )
        .map((p) => missing[p])
        .filter((i) => remaining.has(i))
        .map((i) => button(i, verse.words[i]))
        .join(
          "",
        )}</div><button class="text-button" id="vanish-reveal">Reveal answer (study help)</button>`;
      area.querySelectorAll("[data-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            const index = Number(b.dataset.choice),
              target = missing[picked.length];
            if (verse.words[index] !== verse.words[target]) {
              fail("Try a different missing word.");
              return;
            }
            remaining.delete(index);
            picked.push(target);
            draw();
            if (picked.length === missing.length) finish();
          }),
      );
      area.querySelector("#vanish-reveal").onclick = () => {
        hinted = true;
        area.querySelector(".vanishing-line").innerHTML =
          `<span class="arabic" lang="ar">${wordsHTML(verse.words)}</span>`;
        say("Answer revealed for study. Try rebuilding it in a fresh round.");
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function jigsaw() {
    const size = verse.words.length > 4 ? 3 : 2,
      groups = [];
    for (let i = 0; i < verse.words.length; i += size)
      groups.push({ words: verse.words.slice(i, i + size), start: i });
    const bank = shuffled(groups.length),
      selected = [];
    const draw = () => {
      const piece = (i) => {
        const group = groups[i],
          concealed = level >= 3 && i % 2 === 0;
        return `<button class="lab-group" data-group="${i}" style="--group-color:${["#f0d6a1", "#d4e8cd", "#d9dff1", "#f4d5d5"][i % 4]}">${level < 4 ? `<svg viewBox="0 0 180 140" aria-hidden="true"><path d="${outline(i, groups.length)}"/></svg>` : ""}<span class="arabic" lang="ar" dir="rtl">${concealed ? "؟" : wordsHTML(group.words)}</span>${level < 3 ? `<small>${esc(verse.roman.slice(group.start, group.start + size).join(" "))}</small>` : ""}${
          level === 1
            ? `<small>${esc(
                verse.meanings
                  .slice(group.start, group.start + size)
                  .map((m) => m[0])
                  .join(" · "),
              )}</small>`
            : ""
        }</button>`;
      };
      area.innerHTML = `<h3>Ayah Jigsaw</h3><p>Build larger word groups from right to left. Tap a built group to remove it.</p><div class="lab-build" dir="rtl">${selected.map(piece).join("") || "Your connected groups go here"}</div><div class="lab-bank" dir="rtl">${bank
        .filter((i) => !selected.includes(i))
        .map(piece)
        .join(
          "",
        )}</div><button class="primary small" id="jigsaw-check">Check grouped ayah</button><button class="text-button" id="jigsaw-reveal">Reveal group words</button>`;
      area.querySelectorAll("[data-group]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.group),
              p = selected.indexOf(i);
            if (p >= 0) selected.splice(p, 1);
            else selected.push(i);
            draw();
          }),
      );
      area.querySelector("#jigsaw-check").onclick = () => {
        if (
          selected.map((i) => groups[i].words.join(" ")).join(" ") ===
          verse.words.join(" ")
        )
          finish();
        else fail("The groups need another arrangement.");
      };
      area.querySelector("#jigsaw-reveal").onclick = () => {
        hinted = true;
        area
          .querySelectorAll("[data-group] .arabic")
          .forEach(
            (span) =>
              (span.textContent =
                groups[
                  Number(span.closest("[data-group]").dataset.group)
                ].words.join(" ")),
          );
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function match() {
    let subtype = "meaning",
      cards = [],
      flipped = [],
      matched = new Set();
    function setup() {
      const seen = new Set(),
        pairs = [];
      if (subtype === "continuation") {
        for (const v of surah.verses) {
          const n = Math.ceil(v.words.length / 2);
          if (n >= v.words.length) continue;
          const opening = v.words.slice(0, n).join(" "),
            tail = v.words.slice(n).join(" ");
          if (seen.has(opening) || seen.has(tail)) continue;
          seen.add(opening);
          seen.add(tail);
          pairs.push([
            { text: opening, arabic: true },
            { text: tail, arabic: true },
          ]);
          if (pairs.length === 4) break;
        }
      } else
        for (let i = 0; i < verse.words.length; i++) {
          if (seen.has(verse.words[i]) || seen.has(verse.meanings[i][0]))
            continue;
          seen.add(verse.words[i]);
          seen.add(verse.meanings[i][0]);
          pairs.push([
            { text: verse.words[i], arabic: true },
            {
              text:
                subtype === "audio" ? "♫ Hear the word" : verse.meanings[i][0],
              arabic: false,
              audio:
                subtype === "audio" ? wordAudio(verse.id, i, surah.id) : null,
            },
          ]);
          if (pairs.length === 4) break;
        }
      const all = pairs.flatMap((pair, id) =>
        pair.map((card) => ({ ...card, pair: id })),
      );
      cards = shuffled(all.length).map((i) => all[i]);
      flipped = [];
      matched = new Set();
      draw();
    }
    const draw = () => {
      area.innerHTML = `<h3>Memory Match</h3><p>A recognition game, including authentic audio or ayah continuations.</p><label>Pair type<select id="match-type"><option value="meaning">Word and meaning</option><option value="audio">Word and audio</option><option value="continuation">Opening and continuation</option></select></label><div class="match-grid">${cards.map((c, i) => `<button data-card="${i}" data-pair="${c.pair}" class="match-card ${matched.has(c.pair) ? "matched" : ""}" ${matched.has(c.pair) ? "disabled" : ""} aria-label="${matched.has(c.pair) ? "Matched: " + esc(c.text) : flipped.includes(i) ? esc(c.text) : `Turn card ${i + 1}`}">${matched.has(c.pair) || flipped.includes(i) ? `<span ${c.arabic ? 'class="arabic" lang="ar" dir="rtl"' : ""}>${esc(c.text)}</span>` : "✦"}</button>`).join("")}</div><button class="text-button" id="match-reset-pair" ${flipped.length === 2 ? "" : "hidden"}>Try another pair</button>`;
      area.querySelector("#match-type").value = subtype;
      area.querySelector("#match-type").onchange = (e) => {
        subtype = e.target.value;
        session = uid();
        done = false;
        mistakes = 0;
        hinted = false;
        stopAudio();
        setup();
      };
      area.querySelectorAll("[data-card]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.card);
            if (flipped.includes(i) || flipped.length === 2) return;
            flipped.push(i);
            if (cards[i].audio) playAudio(cards[i].audio);
            if (flipped.length === 2) {
              if (cards[flipped[0]].pair === cards[flipped[1]].pair) {
                matched.add(cards[i].pair);
                flipped = [];
              } else
                fail(
                  "Those cards do not form a pair. Listen or look, then try another pair.",
                );
            }
            draw();
            if (matched.size === cards.length / 2 && cards.length) finish();
          }),
      );
      area.querySelector("#match-reset-pair").onclick = () => {
        flipped = [];
        draw();
      };
    };
    setup();
    gameCleanup = () => {};
  }
  function chain() {
    const startIndex = Math.min(
        surah.verses.indexOf(verse),
        Math.max(0, surah.verses.length - 3),
      ),
      passage = surah.verses.slice(startIndex, startIndex + 5),
      bank = shuffled(passage.length),
      selected = [];
    const draw = () => {
      const card = (i) =>
        `<button class="chain-lab-card" data-chain="${i}"><span class="arabic" lang="ar" dir="rtl">${wordsHTML(level >= 3 ? passage[i].words.slice(0, level === 4 ? 1 : 2) : passage[i].words)}</span>${level >= 3 ? "<small>Opening cue only</small>" : ""}</button>`;
      area.innerHTML = `<h3>Broken Chain</h3><p>Restore ayahs ${passage[0].id}–${passage.at(-1).id} in their surah order. Tap a chosen ayah to undo it.</p><div class="lab-chain-build">${selected.map(card).join("") || "Choose the first ayah below"}</div><div class="lab-chain-bank">${bank
        .filter((i) => !selected.includes(i))
        .map(card)
        .join(
          "",
        )}</div><button class="primary small" id="chain-check">Check ayah sequence</button>`;
      area.querySelectorAll("[data-chain]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.chain),
              p = selected.indexOf(i);
            if (p >= 0) selected.splice(p, 1);
            else selected.push(i);
            draw();
          }),
      );
      area.querySelector("#chain-check").onclick = () => {
        if (
          selected.length === passage.length &&
          selected.every((v, i) => v === i)
        )
          finish();
        else fail("Try another ayah sequence.");
      };
    };
    draw();
    gameCleanup = () => {};
  }
  function continuation() {
    const cue = Math.max(
        1,
        Math.floor(verse.words.length / (level >= 3 ? 4 : 3)),
      ),
      opening = verse.words.slice(0, cue),
      tail = verse.words.slice(cue);
    if (!tail.length) {
      area.innerHTML =
        "<h3>Continue the Ayah</h3><p>This ayah is one word. Try full independent self-assessment using the button below, or choose another ayah for continuation practice.</p>";
      gameCleanup = () => {};
      return;
    }
    area.innerHTML = `<h3>Continue the Ayah</h3><p>Use this opening, then say the rest aloud or quietly before looking. This cued practice is self-assessed, not an independent mastery checkpoint.</p><p class="arabic lab-opening" lang="ar" dir="rtl">${wordsHTML(opening)}</p><button class="primary small" id="continue-compare">I tried the remainder — compare</button><div class="continue-answer" hidden><p class="arabic" lang="ar" dir="rtl">${wordsHTML(tail)}</p><button class="text-button" id="continue-again">I needed another cue</button><button class="primary small" id="continue-good">I recalled the remainder correctly</button></div>`;
    area.querySelector("#continue-compare").onclick = () => {
      area.querySelector(".continue-answer").hidden = false;
      area.querySelector("#continue-compare").disabled = true;
    };
    area.querySelector("#continue-again").onclick = () => {
      fail(
        "Opening difficulty recorded. Try a little study, then a fresh round.",
      );
      hinted = true;
      finish();
    };
    area.querySelector("#continue-good").onclick = finish;
    gameCleanup = () => {};
  }
  function detective() {
    const pairs = checkedDetectivePairs(surahs),
      local = pairs.find((p) => p.surah.id === surah.id),
      pair = local || pairs[Math.floor(Math.random() * pairs.length)];
    resultKey = `${pair.surah.id}:${pair.first.id}`;
    const options = shuffled(2),
      tails = [
        pair.first.words.slice(pair.cue),
        pair.second.words.slice(pair.cue),
      ];
    area.innerHTML = `<h3>Similar Ayah Detective</h3><p>Which continuation belongs to ${esc(pair.surah.name)}, ayah ${pair.first.id}? Both choices are actual passages from that surah, not invented Quran text.</p><p class="arabic lab-opening" lang="ar" dir="rtl">${wordsHTML(pair.first.words.slice(0, pair.cue))}</p><div class="detective-options">${options.map((i) => button(i, tails[i].join(" "))).join("")}</div><p class="detective-source" hidden>Verified library comparison: ${pair.surah.id}:${pair.first.id} and ${pair.surah.id}:${pair.second.id}</p>`;
    area.querySelectorAll("[data-choice]").forEach(
      (b) =>
        (b.onclick = () => {
          if (Number(b.dataset.choice) === 0) {
            area.querySelector(".detective-source").hidden = false;
            finish();
          } else
            fail(
              "That is a real continuation from the other ayah. Compare the opening and try again.",
            );
        }),
    );
    gameCleanup = () => {};
  }
  root.querySelectorAll("[data-game]").forEach(
    (b) =>
      (b.onclick = () => {
        start(b.dataset.game);
        area.scrollIntoView({ block: "start" });
        (
          area.querySelector(".falling-stage") || area.querySelector("button")
        )?.focus();
      }),
  );
  root.querySelector("#lab-level").onchange = () => start();
  root.querySelector("#lab-timed").onchange = () => start();
  root.querySelector("#lab-restart").onclick = () => start();
  root.querySelector("#lab-replay").onclick = () =>
    playAudio(verseAudio(verse.id, surah.id), true);
  root.querySelector("#lab-stop-audio").onclick = stopAudio;
  root.querySelector("#lab-retry-save").onclick = finish;
  root.querySelector("#lab-next-level").onclick = () => {
    root.querySelector("#lab-level").value = String(Math.min(4, level + 1));
    start();
    area.scrollIntoView({ block: "start" });
  };
  root.querySelector("#lab-recall").onclick = () => callbacks.onRecall(key);
  root.querySelector("#lab-recommended").onclick = () =>
    recommendation.game === "recall"
      ? callbacks.onRecall(key)
      : start(recommendation.game);
  start();
  cleanup = () => {
    gameCleanup?.();
    stopAudio();
  };
}
