import { successCue } from "../../ui/encouragement.js";
import { mountFalling } from "../../puzzles/falling-ui.js";
export const blocksRegistration = {
  id: "falling",
  title: "Ayah Blocks",
  status: "available",
  create({ root, adapter, config, id, volume, muted, onComplete }) {
    const key = config.keys[0],
      words = adapter.words(key),
      [surah, ayah] = key.split(":").map(Number);
    const choices = adapter.choices(key, {
      count: 3,
      seed: config.seed,
      maxWords: 1000,
    });
    const source = [...words, ...choices.filter((w) => !w.target)];
    const entries = source.map((w) => ({
      ...w,
      text: w.text,
      roman: "",
      meaning: "",
      position: w.index,
      audio: w.audio,
      surah: w.surah,
      ayah: w.ayah,
    }));
    const order = choices.map((w) => source.findIndex((s) => s.id === w.id));
    const verse = {
      id: ayah,
      words: words.map((w) => w.text),
      roman: words.map(() => ""),
      meanings: words.map(() => ["", "name"]),
    };
    const view = mountFalling(root, {
      surah: { id: surah, name: `Source ${key}`, verses: [verse] },
      verse,
      muted,
      volume,
      say: (message) => {
        let p = root.querySelector("[data-block-status]");
        if (!p) {
          p = document.createElement("p");
          p.dataset.blockStatus = "";
          p.setAttribute("role", "status");
          root.append(p);
        }
        p.textContent = message;
      },
      onFinish: (result) => {
        const snapshot = {
          id,
          game: "falling",
          status: "won",
          config,
          completed: [key],
          mistakes: result.errors.map(() => ({ key, kind: "sequence" })),
          motorErrors: [],
          assistance: result.usedAudio ? [{ key, kind: "audio" }] : [],
        };
        function save() {
          try {
            onComplete(snapshot);
            root.querySelector("[data-block-save]")?.remove();
            root.querySelector("[data-block-status]")?.remove();
            successCue(
              `${id}:blocks`,
              "Source words connected. Your checkpoint is saved.",
            );
          } catch (e) {
            let message = root.querySelector("[data-block-status]");
            if (!message) {
              message = document.createElement("p");
              message.dataset.blockStatus = "";
              message.setAttribute("role", "alert");
              root.append(message);
            }
            message.textContent = `Trial complete, but not saved: ${e.message}. Retry saving or use guided practice.`;
            if (!root.querySelector("[data-block-save]")) {
              const retry = document.createElement("button");
              retry.dataset.blockSave = "";
              retry.textContent = "Retry saving checkpoint";
              retry.onclick = save;
              root.append(retry);
            }
          }
        }
        save();
      },
      onFailure: () => {},
      onExit: () => {},
      onChange: () => {},
      questOptions: { entries, order, audioSource: adapter.audio(key) },
    });
    return {
      ...view,
      dispose() {
        view.dispose();
        root.replaceChildren();
      },
    };
  },
};
