export interface InformeMarkdownSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type InformeMarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; spans: InformeMarkdownSpan[] }
  | { type: 'bullet'; spans: InformeMarkdownSpan[] }
  | { type: 'paragraph'; spans: InformeMarkdownSpan[] };

/**
 * Basic markdown: paragraphs, line breaks, bold, italics, headings, bullets.
 * Images and table rows are dropped. Links become their label text.
 */
export function parseInformeExtendidoMarkdown(
  source: string,
): InformeMarkdownBlock[] {
  const withoutImages = source.replace(/!\[[^\]]*]\([^)]*\)/g, '');
  const lines = withoutImages.replace(/\r\n/g, '\n').split('\n');
  const blocks: InformeMarkdownBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    paragraphLines = [];
    if (!text) return;
    blocks.push({ type: 'paragraph', spans: parseInlineSpans(text) });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || isTableRow(line)) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        level,
        spans: parseInlineSpans(heading[2]),
      });
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bullet', spans: parseInlineSpans(bullet[1]) });
      continue;
    }

    paragraphLines.push(stripLinkTargets(line));
  }

  flushParagraph();
  return blocks;
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') || /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function stripLinkTargets(text: string): string {
  return text.replace(/\[([^\]]+)]\([^)]*\)/g, '$1');
}

function parseInlineSpans(text: string): InformeMarkdownSpan[] {
  const cleaned = stripLinkTargets(text);
  const spans: InformeMarkdownSpan[] = [];
  const pattern = /(\*\*\*|___|\*\*|__|\*|_)([\s\S]+?)\1/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match.index > cursor) {
      pushPlain(spans, cleaned.slice(cursor, match.index));
    }
    const marker = match[1];
    const bold = marker.startsWith('**') || marker.startsWith('__');
    const italic =
      marker === '*' ||
      marker === '_' ||
      marker === '***' ||
      marker === '___';
    pushPlain(spans, match[2], { bold, italic });
    cursor = match.index + match[0].length;
  }

  if (cursor < cleaned.length) {
    pushPlain(spans, cleaned.slice(cursor));
  }

  return spans.filter((span) => span.text.length > 0);
}

function pushPlain(
  spans: InformeMarkdownSpan[],
  text: string,
  style: { bold?: boolean; italic?: boolean } = {},
): void {
  if (!text) return;
  spans.push({
    text,
    bold: Boolean(style.bold),
    italic: Boolean(style.italic),
  });
}
