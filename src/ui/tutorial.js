import { esc } from "./dom.js";
import { surahs, wordAudio } from "../data.js";
import { createDistractorPicker } from "../distractors.js";
import { bindPieceDrag, stopPieceDrag } from "./piece-drag.js";
import {
  showFeedbackSettings,
  studyAudioStart,
  studyAudioStop,
} from "./encouragement.js";
export const TUTORIAL_KEY = "ayah-tutorial-v1";
let dismissed = false;
try {
  dismissed = !!JSON.parse(localStorage.getItem(TUTORIAL_KEY))?.status;
} catch {}
const steps = [
  [
    "Practice",
    "Start with a word or a few. Tap a piece to add it, drag it into position, or use its arrows. Tap headphones to hear it. Try reordering the example below.",
  ],
  [
    "Puzzle Quest",
    "Build the ayah in order and leave extra words behind. Two unassisted wins unlock the next level. Blank pieces encourage recall; reveals are always available for study. Try selecting a correct word and an extra word.",
  ],
  [
    "Active Recall",
    "The reference and some words are hidden. Bring the words to mind before revealing them. This is puzzle practice, separate from independent spoken recall. Try revealing the hidden word.",
  ],
  [
    "Ayah Chain",
    "Choose the ayahs you want to connect. Build each ayah, arrange the cards in surah order, and listen to your chain or the canonical order. Try swapping the example cards.",
  ],
  [
    "Daily Quest",
    "Your dashboard separates puzzle progress from memorization mastery. Review due ayahs first, revisit weak ayahs, or choose suggested new memorization. Taking a break never costs points.",
  ],
  [
    "Self-assessed Recitation",
    "Recite without the text, optionally record yourself, then reveal and compare. Play your voice and the reciter separately or together. Self-grade Again, Hard, Good or Easy. The app does not automatically verify speech; listening or revealing first counts as assistance.",
  ],
  [
    "Puzzle Lab",
    "Seven games offer different ways to practice. Each includes authentic distractors with audio. Falling Words uses arrows and Space to place words, and D/Delete to discard extras. Games practice recognition and order; they do not certify memorization.",
  ],
  [
    "Mastery Gallery · Memory Gate",
    "An artwork section unlocks after correct independent scheduled recall on two distinct days. Puzzle wins and listening alone do not unlock sections. Unlocks stay earned after lapses; the separate Maintained award requires spaced reviews.",
  ],
  [
    "Mastery Gallery",
    "Revisit your permanent collectibles and see scheduled review dates. The initial Gallery covers thirteen surahs. Final artwork and tafsir narratives are awaiting editorial work; geometric previews are clearly labeled placeholders.",
  ],
  [
    "Encouragement and preferences",
    "Correct answers receive gentle encouragement. You can mute the chime, adjust its volume, upload your own short sound, or disable transitions. Reduced motion is respected, and sounds stop when recitation or recording begins.",
  ],
];
function save(status) {
  dismissed = true;
  try {
    localStorage.setItem(
      TUTORIAL_KEY,
      JSON.stringify({ schemaVersion: 1, status }),
    );
  } catch {}
}
export function showTutorial(callbacks) {
  callbacks.beforeTour?.();
  const dialog = document.createElement("dialog");
  dialog.className = "tutorial-dialog";
  document.body.append(dialog);
  let step = 0,
    sample = [1, 0],
    revealed = false,
    audio = null;
  const chapter = surahs.find(
    (s) => s.id === (callbacks.assessmentKey?.startsWith("1:") ? 112 : 1),
  );
  const verse = chapter.verses[0],
    extra = createDistractorPicker()(chapter.id, verse.words, 1)[0];
  const stop = () => {
    audio?.pause();
    if (audio) audio.src = "";
    audio = null;
    studyAudioStop("tutorial");
    stopPieceDrag();
  };
  const close = (status) => {
    stop();
    save(status);
    dialog.close();
    dialog.remove();
    callbacks.afterTour?.();
    document.querySelector(".tutorial-welcome")?.remove();
  };
  const draw = () => {
    stop();
    dialog.innerHTML = `<button class="text-button tutorial-skip" id="skip-tutorial">Skip tutorial ×</button><span class="eyebrow">GUIDED TOUR · ${step + 1} OF ${steps.length}</span><h2 tabindex="-1">${steps[step][0]}</h2><p>${steps[step][1]}</p><p class="tutorial-sandbox-label">Tutorial examples · no XP or learning progress is changed</p><div class="tutorial-demo"></div><div class="tutorial-navigation"><button class="text-button" id="tutorial-back" ${step ? "" : "disabled"}>Back</button><button class="primary small" id="tutorial-next">${step === steps.length - 1 ? "Finish tutorial" : "Next →"}</button><button class="text-button" id="tutorial-open">Go to this feature</button></div>`;
    const demo = dialog.querySelector(".tutorial-demo");
    if (step === 0) {
      const piece = (i, zone) =>
        `<div class="piece-wrap"><button class="tutorial-word" data-word="${i}" data-zone="${zone}" draggable="true"><span class="arabic" lang="ar" dir="rtl">${verse.words[i]}</span></button></div>`;
      demo.innerHTML = `<p>${esc(chapter.name)} · Ayah 1</p><div class="tutorial-build" data-drop="build" dir="rtl">${sample.map((i) => piece(i, "selected")).join("")}</div><div class="tutorial-bank" data-drop="bank" dir="rtl">${verse.words
        .map((_, i) => i)
        .filter((i) => !sample.includes(i))
        .map((i) => piece(i, "bank"))
        .join(
          "",
        )}</div><button class="text-button" id="tutorial-hear">♫ Hear the first word</button>`;
      demo.querySelectorAll("[data-word]").forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.word);
            sample =
              b.dataset.zone === "bank"
                ? [...sample, i]
                : sample.filter((x) => x !== i);
            draw();
          }),
      );
      bindPieceDrag(demo, {
        selection: () => sample,
        count: verse.words.length,
        locked: () => false,
        change: (next) => {
          sample = next;
          draw();
        },
      });
      demo.querySelector("#tutorial-hear").onclick = async () => {
        stop();
        studyAudioStart("tutorial");
        audio = new Audio(wordAudio(1, 0, chapter.id));
        audio.onended = audio.onerror = () => studyAudioStop("tutorial");
        try {
          await audio.play();
        } catch {
          studyAudioStop("tutorial");
        }
      };
    } else if (step === 1 || step === 6) {
      demo.innerHTML = `<p>Choose a word from ${esc(chapter.name)}, ayah 1:</p><div class="tutorial-bank">${[verse.words[0], extra.text].map((text, i) => `<button class="tutorial-word" data-demo-choice="${i}"><span class="arabic" lang="ar" dir="rtl">${esc(text)}</span></button>`).join("")}</div><p data-demo-status role="status"></p>`;
      demo.querySelectorAll("[data-demo-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            demo.querySelector("[data-demo-status]").textContent =
              Number(b.dataset.demoChoice) === 0
                ? "That word belongs! Place it first from the right."
                : "This word comes from another ayah. Leave it out or discard it.";
          }),
      );
    } else if (step === 2 || step === 5) {
      demo.innerHTML = `<p class="arabic" lang="ar" dir="rtl">${revealed ? verse.text : "▢ ▢ ▢ ▢"}</p><button class="text-button" id="tutorial-reveal">${revealed ? "Hide example" : "Reveal example"}</button>`;
      demo.querySelector("#tutorial-reveal").onclick = () => {
        revealed = !revealed;
        draw();
      };
    } else if (step === 3) {
      demo.innerHTML = `<div class="tutorial-chain">${(revealed ? [1, 2] : [2, 1]).map((id) => `<p class="arabic" lang="ar" dir="rtl">${chapter.verses[id - 1].text}</p>`).join("")}</div><button class="text-button" id="tutorial-swap">Swap the ayahs</button>`;
      demo.querySelector("#tutorial-swap").onclick = () => {
        revealed = !revealed;
        draw();
      };
    } else if (step === 7 || step === 8)
      demo.innerHTML =
        '<img class="tutorial-art" src="/mastery-art/placeholder.svg" alt="Geometric placeholder for future reward artwork"><p>Example only: earned sections remain visible. Final artwork is pending.</p>';
    else if (step === 4)
      demo.innerHTML =
        '<div class="tutorial-daily"><strong>Due reviews → Independent recall first</strong><p>Weak ayahs → Study, then assess</p><p>New memorization → A little at a time</p></div>';
    else
      demo.innerHTML =
        "<p>Use Encouragement settings above the learning area to personalize sounds and motion.</p>";
    dialog.querySelector("#skip-tutorial").onclick = () => close("skipped");
    dialog.querySelector("#tutorial-back").onclick = () => {
      step--;
      revealed = false;
      draw();
      dialog.querySelector("h2").focus();
    };
    dialog.querySelector("#tutorial-next").onclick = () => {
      if (step === steps.length - 1) close("completed");
      else {
        step++;
        revealed = false;
        draw();
        dialog.querySelector("h2").focus();
      }
    };
    dialog.querySelector("#tutorial-open").onclick = () => {
      const actions = [
        callbacks.practice,
        callbacks.quest,
        callbacks.recall,
        callbacks.chain,
        callbacks.daily,
        callbacks.assessment,
        callbacks.lab,
        callbacks.gallery,
        callbacks.gallery,
        showFeedbackSettings,
      ];
      close("explored");
      actions[step]();
    };
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close("skipped");
  });
  draw();
  dialog.showModal();
  dialog.querySelector("h2").focus();
}
export function mountExperienceControls(main, callbacks) {
  const nav = main.querySelector(".explore-nav");
  const tutorial = document.createElement("button");
  tutorial.className = "text-button";
  tutorial.id = "nav-tutorial";
  tutorial.textContent = "Tutorial";
  tutorial.onclick = () => showTutorial(callbacks);
  nav.append(tutorial);
  const settings = document.createElement("button");
  settings.className = "text-button";
  settings.id = "nav-encouragement";
  settings.textContent = "Encouragement settings";
  settings.onclick = showFeedbackSettings;
  nav.append(settings);
  if (!dismissed) {
    const welcome = document.createElement("section");
    welcome.className = "tutorial-welcome";
    welcome.innerHTML =
      '<div><strong>Welcome to Ayah</strong><p>Take a guided tour with hands-on examples, or start learning right away.</p></div><button class="primary small" data-start-tour>Start tutorial</button><button class="text-button" data-skip-tour>Skip tutorial</button>';
    main.querySelector(".page-heading").after(welcome);
    welcome.querySelector("[data-start-tour]").onclick = () =>
      showTutorial(callbacks);
    welcome.querySelector("[data-skip-tour]").onclick = () => {
      save("skipped");
      welcome.remove();
    };
  }
}
