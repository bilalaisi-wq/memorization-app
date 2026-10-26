import { expect, test } from "@playwright/test";
import {
  compareTranscript,
  normalizeWord,
  providerQuality,
  validAudio,
} from "../supabase/functions/_shared/recitation-core.js";
import { verses } from "../src/data.js";
test("Arabic normalization affects comparison only; no tajweed or mastery verdict", () => {
  const text = verses[0].text, words = text.split(" ");
  expect(normalizeWord("ٱلرَّحْمَـٰنِ")).toBe("الرحمن");
  expect(normalizeWord("رَحْمَة")).not.toBe(normalizeWord("رَحْمَه"));
  const result = compareTranscript(words, "بسم الله الرحمن الرحيم");
  expect(result.status).toBe("experimental_comparison");
  expect(result.differences).toEqual([]);
  expect(result.uncertainty.join(" ")).toContain("do not verify");
  expect(verses[0].text).toBe(text);
  expect(result).not.toHaveProperty("mastery");
});
test("omissions, repeated words, substitutions and sequence changes are tentative", () => {
  const words = ["بسم", "الله", "الرحمن", "الرحيم"];
  expect(compareTranscript(words, "بسم الله الرحيم").differences)
    .toContainEqual({
      type: "possible_omission",
      wordIndex: 3,
      expected: "الرحمن",
      heard: null,
    });
  expect(
    compareTranscript(words, "بسم الله الله الرحمن الرحيم").differences.some(
      (d) => d.type === "possible_addition_or_sequence_difference",
    ),
  ).toBe(true);
  expect(
    compareTranscript(words, "بسم الله الملك الرحيم").differences.some((d) =>
      d.type === "possible_substitution"
    ),
  ).toBe(true);
  expect(compareTranscript(words, "بسم الرحمن الله الرحيم").differences.length)
    .toBeGreaterThan(0);
});
test("noise, unsupported confidence, missing duration and gross mismatches abstain", () => {
  const segment = {
    avg_logprob: -0.2,
    no_speech_prob: 0.01,
    compression_ratio: 1,
  };
  expect(providerQuality({ duration: 3, segments: [segment] }).insufficient)
    .toBe(false);
  for (
    const result of [
      { duration: 121, segments: [segment] },
      { duration: 2, segments: [{ ...segment, no_speech_prob: 0.9 }] },
      { text: "بسم الله" },
      { duration: 2, segments: [{ ...segment, avg_logprob: -2 }] },
    ]
  ) expect(providerQuality(result).insufficient).toBe(true);
  expect(compareTranscript(["بسم", "الله"], "", {}).status).toBe(
    "could_not_assess",
  );
  expect(compareTranscript(["بسم", "الله"], "ضوضاء مختلفة جدا", {}).status)
    .toBe("could_not_assess");
  expect(
    compareTranscript(["بسم", "الله"], "بسم الله", { insufficient: true })
      .status,
  ).toBe("could_not_assess");
});
test("upload MIME and signatures must agree", () => {
  expect(
    validAudio(
      Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0]),
      "audio/webm;codecs=opus",
    ),
  ).toBe(true);
  expect(
    validAudio(new TextEncoder().encode("<script>evil</script>"), "audio/webm"),
  ).toBe(false);
  expect(validAudio(new Uint8Array(8 * 1024 * 1024 + 1), "audio/webm")).toBe(
    false,
  );
});

test("Evaluation reports false positives/negatives and abstentions separately without claiming teacher validation", async () => {
  const { evaluateCases } = await import(
    "../supabase/functions/_shared/recitation-evaluation.js"
  );
  const words = ["بسم", "الله", "الرحمن", "الرحيم"];
  const c = {
    words,
    reviewer: {
      name: "Synthetic fixture",
      credentials: "TEST ONLY",
      reviewedAt: "2026-10-26",
    },
    adultConsentReviewed: true,
    audioSha256: "a".repeat(64),
    conditions: ["clean"],
    teacher: { errorWordIndices: [2], extraAfterWordIndices: [] },
    provider: {
      model: "whisper-1",
      transcript: "بسم الله الرحيم",
      duration: 3,
      segments: [{
        avg_logprob: -0.1,
        no_speech_prob: 0.01,
        compression_ratio: 1,
      }],
    },
  };
  const report = evaluateCases([c, {
    ...c,
    conditions: ["background_noise"],
    provider: { ...c.provider, segments: [] },
  }]);
  expect(report.overall.falsePositives).toBe(1);
  expect(report.overall.falseNegatives).toBe(1);
  expect(report.overall.abstained).toBe(1);
  expect(report.overall.unassessedTeacherErrors).toBe(1);
  expect(report.missingConditions).toContain("accents");
  expect(() => evaluateCases([{ ...c, adultConsentReviewed: false }]))
    .toThrow();
});
