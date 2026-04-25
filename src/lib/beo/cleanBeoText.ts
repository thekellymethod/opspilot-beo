type CleanBeoTextOptions = {
  preserveLineBreaks?: boolean;
  removeBoilerplate?: boolean;
  removeDuplicateLines?: boolean;
};

const DEFAULT_OPTIONS: Required<CleanBeoTextOptions> = {
  preserveLineBreaks: true,
  removeBoilerplate: true,
  removeDuplicateLines: true,
};

const BOILERPLATE_PATTERNS: RegExp[] = [
  /this banquet event order is subject to change/gi,
  /all food and beverage must be supplied by the hotel/gi,
  /guarantees are due by .*/gi,
  /service charge.*tax(es)?/gi,
  /please sign and return/gi,
  /signature:\s*.*/gi,
  /accepted by:\s*.*/gi,
  /cancellation policy.*$/gim,
  /payment terms.*$/gim,
  /thank you for choosing.*$/gim,
];

const FOOTER_HEADER_NOISE_PATTERNS: RegExp[] = [
  /^page\s+\d+(\s+of\s+\d+)?$/gim,
  /^printed:\s+.*$/gim,
  /^created:\s+.*$/gim,
  /^generated:\s+.*$/gim,
  /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}\s*(am|pm)\s+.*$/gim,
  /^file:\/\/\/.*$/gim,
  /^--\s*\d+\s+of\s+\d+\s*--$/gim,
];

function normalizeLine(line: string): string {
  return line
    .replace(/[ \t]+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function removeBoilerplate(text: string): string {
  let cleaned = text;

  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  for (const pattern of FOOTER_HEADER_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

function standardizeCommonLabels(text: string): string {
  return text
    .replace(/\bfunction room\b/gi, "Room Name")
    .replace(/\bmeeting room\b/gi, "Room Name")
    .replace(/\broom setup\b/gi, "Room Setup")
    .replace(/\battendance\b/gi, "Expected Guests")
    .replace(/\bguarantee\b/gi, "Guaranteed Guests")
    .replace(/\bdinner service\b/gi, "Service")
    .replace(/\bstart time\b/gi, "Event Start Time")
    .replace(/\bend time\b/gi, "Event End Time")
    .replace(/\bav requirements\b/gi, "Equipment")
    .replace(/\bspecial meals\b/gi, "Dietary Notes");
}

function collapseWhitespacePreserveLines(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .join("\n");
}

function collapseWhitespaceFlatten(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function dedupeLines(text: string): string {
  const seen = new Set<string>();
  const lines = text.split("\n");
  const deduped: string[] = [];

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) continue;
    // Preserve repeated operational table rows and section boundaries.
    if (/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/i.test(line) || /\bremarks?\b/i.test(line)) {
      deduped.push(line);
      continue;
    }

    const key = line.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(line);
  }

  return deduped.join("\n");
}

function mergeWrappedLines(text: string): string {
  const lines = text.split("\n").map(normalizeLine).filter(Boolean);
  const merged: string[] = [];

  for (const line of lines) {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push(line);
      continue;
    }

    const previousEndsSoftly = /[:,-]$/.test(previous) || !/[.!?]$/.test(previous);
    const currentLooksContinuation =
      /^[a-z0-9(]/.test(line) ||
      /^\d+\s*(guests?|chairs?|tables?|servers?|bartenders?)/i.test(line);

    const isLikelyTableRow =
      /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/.test(previous) ||
      /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/.test(line) ||
      /\b(exp\/gtd|rental|set-?up|function|room)\b/i.test(previous);

    if (!isLikelyTableRow && previousEndsSoftly && currentLooksContinuation) {
      merged[merged.length - 1] = `${previous} ${line}`;
    } else {
      merged.push(line);
    }
  }

  return merged.join("\n");
}

export function cleanBeoText(rawText: string, options?: CleanBeoTextOptions): string {
  const config = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  let text = rawText ?? "";
  text = text.replace(/\u0000/g, "");
  text = text.replace(/[^\S\n]+/g, " ");

  if (config.removeBoilerplate) {
    text = removeBoilerplate(text);
  }

  text = standardizeCommonLabels(text);
  text = collapseWhitespacePreserveLines(text);
  text = mergeWrappedLines(text);

  if (config.removeDuplicateLines) {
    text = dedupeLines(text);
  }

  if (!config.preserveLineBreaks) {
    text = collapseWhitespaceFlatten(text);
  }

  return text.trim();
}
