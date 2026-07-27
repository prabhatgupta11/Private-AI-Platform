const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
  "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "that", "the",
  "their", "this", "to", "was", "what", "when", "where", "which", "who", "why",
  "with", "you", "your",
]);

function termsFor(question) {
  return [...new Set(
    question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term)),
  )];
}

function passagesFor(text) {
  const parts = text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .split(/(?:\r?\n){1,}|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 12);

  return parts.map((part, index) =>
    parts
      .slice(Math.max(0, index - 1), Math.min(parts.length, index + 2))
      .join(" ")
      .slice(0, 900),
  );
}

function scorePassage(passage, terms) {
  const normalized = passage.toLowerCase();
  let score = 0;
  let matched = 0;

  for (const term of terms) {
    const occurrences = normalized.split(term).length - 1;
    if (occurrences > 0) {
      matched += 1;
      score += Math.min(occurrences, 4) * (term.length >= 6 ? 4 : 2);
    }
  }

  const minimumMatches = terms.length <= 2 ? terms.length : Math.ceil(terms.length / 2);
  if (matched < minimumMatches) return 0;
  if (terms.length > 1 && matched === terms.length) score += 8;
  if (passage.length < 500) score += 1;
  return score;
}

function overlapRatio(left, right) {
  const leftWords = new Set(left.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  const rightWords = new Set(right.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.min(leftWords.size, rightWords.size);
}

/** @param {string} question @param {{ name: string, text: string }[]} documents */
export function answerFromDocuments(question, documents) {
  if (/\b(summarize|summary|overview)\b/i.test(question)) {
    const excerpts = documents
      .map((document) => ({ source: document.name, text: passagesFor(document.text)[0] }))
      .filter((item) => item.text)
      .slice(0, 5);
    return {
      answer: `Here is a quick extractive overview of your uploaded documents:\n\n${excerpts.map((item) => `• ${item.source}: ${item.text}`).join("\n\n")}`,
      sources: excerpts.map((item) => item.source),
    };
  }

  const terms = termsFor(question);
  if (terms.length === 0) {
    return {
      answer: "Please ask a more specific question about your uploaded documents.",
      sources: [],
    };
  }

  const ranked = documents
    .flatMap((document) =>
      passagesFor(document.text).map((text) => ({
        source: document.name,
        text,
        score: scorePassage(text, terms),
      })),
    )
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  const selected = [];
  const seen = new Set();
  for (const match of ranked) {
    const key = `${match.source}:${match.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    if (selected.some((item) => item.source === match.source && overlapRatio(item.text, match.text) > 0.6)) continue;
    seen.add(key);
    selected.push(match);
    if (selected.length === 3) break;
  }

  if (selected.length === 0) {
    return {
      answer: `I searched ${documents.length} readable document${documents.length === 1 ? "" : "s"}, but I could not find content related to “${question.trim()}”. Try using a name or phrase that appears in the files.`,
      sources: [],
    };
  }

  const entityMatch = question.trim().match(/^what\s+(.+?)\s+do(?:es)?\s*\??$/i);
  const intro = entityMatch
    ? `Here is what the uploaded documents say about ${entityMatch[1].trim()}:`
    : "Here are the most relevant details from your uploaded documents:";
  const answer = `${intro}\n\n${selected.map((match) => `• ${match.text}`).join("\n\n")}`;

  return {
    answer,
    sources: [...new Set(selected.map((match) => match.source))],
  };
}
