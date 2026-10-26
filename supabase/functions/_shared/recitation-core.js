// Comparison-only normalization. Never use these strings as Quran display text.
export const COMPARISON_VERSION = "arabic-token-alignment-v1";
export const POLICY_VERSION = "adult-pilot-2026-10-v1";
export const MODEL = "whisper-1";
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_SECONDS = 120;
export function normalizeWord(word) {
  return word.normalize("NFC").replace(
    /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,
    "",
  ).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(
    /[^\p{Script=Arabic}]/gu,
    "",
  );
}
export function transcriptWords(text) {
  return text.trim().split(/\s+/u).map((raw) => ({
    raw,
    normalized: normalizeWord(raw),
  })).filter((w) => w.normalized);
}
export function compareTranscript(words, text, quality = {}) {
  const heard = transcriptWords(text), expected = words.map(normalizeWord);
  const uncertainty = [
    "Transcription is uncertain; matches do not verify recitation or tajweed.",
    "Diacritics, pause marks, elongation and some letter distinctions are ignored for comparison.",
  ];
  if (
    !heard.length || heard.length > 512 || expected.length > 512 ||
    quality.insufficient
  ) {
    return {
      status: "could_not_assess",
      differences: [],
      uncertainty: [
        ...uncertainty,
        quality.reason || "Insufficient or unsupported transcription evidence.",
      ],
      wordCount: expected.length,
    };
  }
  const dp = Array.from(
    { length: expected.length + 1 },
    () => new Uint16Array(heard.length + 1),
  );
  for (let i = 0; i <= expected.length; i++) dp[i][0] = i;
  for (let j = 0; j <= heard.length; j++) dp[0][j] = j;
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= heard.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] +
          (expected[i - 1] === heard[j - 1].normalized ? 0 : 1),
      );
    }
  }
  let i = expected.length, j = heard.length;
  const differences = [];
  while (i || j) {
    if (
      i && j && expected[i - 1] === heard[j - 1].normalized &&
      dp[i][j] === dp[i - 1][j - 1]
    ) {
      i--;
      j--;
    } else if (i && j && dp[i][j] === dp[i - 1][j - 1] + 1) {
      differences.push({
        type: "possible_substitution",
        wordIndex: i,
        expected: words[i - 1],
        heard: heard[j - 1].raw,
      });
      i--;
      j--;
    } else if (i && dp[i][j] === dp[i - 1][j] + 1) {
      differences.push({
        type: "possible_omission",
        wordIndex: i,
        expected: words[i - 1],
        heard: null,
      });
      i--;
    } else {
      differences.push({
        type: "possible_addition_or_sequence_difference",
        afterWord: i,
        expected: null,
        heard: heard[j - 1].raw,
      });
      j--;
    }
  }
  differences.reverse();
  // Gross disagreement can be a different ayah, noise, or a hallucinated transcript.
  if (
    dp[expected.length][heard.length] /
        Math.max(expected.length, heard.length) > 0.65
  ) {
    return {
      status: "could_not_assess",
      differences: [],
      uncertainty: [
        ...uncertainty,
        "The transcript differs too much for a reliable comparison.",
      ],
      wordCount: expected.length,
    };
  }
  return {
    status: "experimental_comparison",
    differences,
    uncertainty,
    wordCount: expected.length,
    sequenceNote:
      "Reordered words may appear as omissions/additions or substitutions; sequence labels are not definitive.",
  };
}
export function providerQuality(result) {
  const segments = result.segments;
  if (
    !Number.isFinite(result.duration) || result.duration <= 0 ||
    result.duration > MAX_SECONDS
  ) {
    return {
      insufficient: true,
      reason:
        "Recording duration could not be assessed or exceeds two minutes.",
    };
  }
  if (
    !Array.isArray(segments) || !segments.length ||
    segments.some((s) =>
      !Number.isFinite(s.avg_logprob) || !Number.isFinite(s.no_speech_prob) ||
      s.avg_logprob < -1 || s.no_speech_prob > 0.6 || s.compression_ratio > 2.4
    )
  ) {
    return {
      insufficient: true,
      reason:
        "The provider reported weak or ambiguous speech evidence. These screening thresholds are not calibrated Quran confidence scores.",
    };
  }
  return { insufficient: false };
}
export function validAudio(bytes, type) {
  const mime = type.split(";")[0].toLowerCase();
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return false;
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  return (mime === "audio/webm" && bytes[0] === 0x1a && bytes[1] === 0x45 &&
    bytes[2] === 0xdf && bytes[3] === 0xa3) ||
    (["audio/mp4", "audio/x-m4a"].includes(mime) && ascii(4, 8) === "ftyp") ||
    (mime === "audio/wav" && ascii(0, 4) === "RIFF" &&
      ascii(8, 12) === "WAVE") ||
    (mime === "audio/ogg" && ascii(0, 4) === "OggS") ||
    (mime === "audio/mpeg" &&
      (ascii(0, 3) === "ID3" ||
        (bytes[0] === 255 && (bytes[1] & 224) === 224)));
}
