const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 180;

function cleanText(value) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split page-aware extracted text into overlapping chunks.
 * @param {{ page: number, text: string }[]} pages
 * @param {{ chunkSize?: number, overlap?: number }=} options
 */
export function chunkPages(pages, options = {}) {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  if (chunkSize < 200 || overlap < 0 || overlap >= chunkSize) {
    throw new Error("Chunk size must be at least 200 characters and larger than overlap.");
  }

  const chunks = [];
  for (const page of pages) {
    const text = cleanText(page.text);
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);
      if (end < text.length) {
        const boundary = Math.max(
          text.lastIndexOf("\n\n", end),
          text.lastIndexOf(". ", end),
          text.lastIndexOf(" ", end),
        );
        if (boundary > start + Math.floor(chunkSize * 0.6)) end = boundary + 1;
      }
      const value = text.slice(start, end).trim();
      if (value) chunks.push({ page: page.page, text: value });
      if (end >= text.length) break;
      const next = Math.max(start + 1, end - overlap);
      start = next;
    }
  }
  return chunks.map((chunk, index) => ({ ...chunk, chunkIndex: index }));
}

/** @param {number[]} left @param {number[]} right */
export function cosineSimilarity(left, right) {
  if (left.length !== right.length || left.length === 0) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : -1;
}

/** @param {string} question @param {{ citation: string, documentName: string, page: number, text: string }[]} matches */
export function buildGroundedPrompt(question, matches) {
  const context = matches
    .map((match) => `${match.citation} File: ${match.documentName}; page: ${match.page}\n${match.text}`)
    .join("\n\n");
  return `Question:\n${question}\n\nRelevant private context:\n${context}`;
}

/** @param {string} answer @param {{ citation: string, documentName: string, page: number }[]} matches */
export function ensureCitations(answer, matches) {
  if (matches.length === 0 || /\[S\d+\]/.test(answer)) return answer.trim();
  const unique = [];
  const seen = new Set();
  for (const match of matches) {
    const key = `${match.documentName}:${match.page}`;
    if (!seen.has(key)) {
      unique.push(`${match.citation} ${match.documentName}, page ${match.page}`);
      seen.add(key);
    }
  }
  return `${answer.trim()}\n\nSources: ${unique.join("; ")}`;
}
