import type { DetectorDefinition, DetectionMatch } from '../utils/types';

/**
 * Table Detector — Detects markdown tables and transforms them into
 * livellm:table-plus components with sorting, search, and pagination.
 */

const TABLE_ROW_RE = /^\|(.+)\|$/;
const SEPARATOR_RE = /^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|$/;

interface ParsedTable {
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
}

function parseMarkdownTable(text: string): ParsedTable | null {
  const lines = text.trim().split('\n').map((l) => l.trim());
  if (lines.length < 3) return null;

  // Line 0: header row
  if (!TABLE_ROW_RE.test(lines[0])) return null;
  // Line 1: separator row
  if (!SEPARATOR_RE.test(lines[1])) return null;

  const headers = lines[0]
    .slice(1, -1)
    .split('|')
    .map((h) => h.trim());

  // Parse alignments from separator
  const sepCells = lines[1]
    .slice(1, -1)
    .split('|')
    .map((s) => s.trim());

  const alignments: ('left' | 'center' | 'right')[] = sepCells.map((s) => {
    const leftColon = s.startsWith(':');
    const rightColon = s.endsWith(':');
    if (leftColon && rightColon) return 'center';
    if (rightColon) return 'right';
    return 'left';
  });

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!TABLE_ROW_RE.test(lines[i])) break;
    const cells = lines[i]
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
    rows.push(cells);
  }

  if (rows.length === 0) return null;

  return { headers, rows, alignments };
}

export const tableDetector: DetectorDefinition = {
  detect(markdown: string): DetectionMatch[] {
    const matches: DetectionMatch[] = [];
    const lines = markdown.split('\n');

    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();

      // Look for a header row (starts and ends with |)
      if (TABLE_ROW_RE.test(trimmed) && i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim();
        if (SEPARATOR_RE.test(nextTrimmed)) {
          // Found a table — gather all contiguous rows
          const tableStart = i;
          let tableEnd = i + 2;
          while (tableEnd < lines.length && TABLE_ROW_RE.test(lines[tableEnd].trim())) {
            tableEnd++;
          }

          const tableText = lines.slice(tableStart, tableEnd).join('\n');
          const parsed = parseMarkdownTable(tableText);

          if (parsed && parsed.rows.length >= 2) {
            // Calculate character offsets
            let startOffset = 0;
            for (let j = 0; j < tableStart; j++) {
              startOffset += lines[j].length + 1;
            }
            let endOffset = startOffset;
            for (let j = tableStart; j < tableEnd; j++) {
              endOffset += lines[j].length + (j < tableEnd - 1 ? 1 : 0);
            }
            // Include trailing newline if present
            if (tableEnd < lines.length) {
              endOffset += 1;
            }

            const numericColumns = detectNumericColumns(parsed);

            matches.push({
              start: startOffset,
              end: endOffset,
              data: {
                headers: parsed.headers,
                rows: parsed.rows,
                alignments: parsed.alignments,
                numericColumns,
              },
              confidence: calculateTableConfidence(parsed),
              apply: () => {},
            });

            i = tableEnd;
            continue;
          }
        }
      }
      i++;
    }

    return matches;
  },

  transform(match: DetectionMatch): string {
    const { headers, rows } = match.data;
    const columns = headers.map((h: string, idx: number) => ({
      key: `col${idx}`,
      label: h,
      sortable: true,
    }));

    const dataRows = rows.map((row: string[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => {
        obj[`col${idx}`] = row[idx] || '';
      });
      return obj;
    });

    const props = {
      columns,
      data: dataRows,
      searchable: rows.length >= 5,
      paginate: rows.length > 10,
      pageSize: rows.length > 10 ? 10 : rows.length,
    };

    return '```livellm:table-plus\n' + JSON.stringify(props) + '\n```';
  },
};

function detectNumericColumns(table: ParsedTable): number[] {
  const numeric: number[] = [];
  for (let col = 0; col < table.headers.length; col++) {
    const isNumeric = table.rows.every((row) => {
      const val = (row[col] || '').replace(/[$,%]/g, '').trim();
      return val === '' || !isNaN(Number(val));
    });
    if (isNumeric) numeric.push(col);
  }
  return numeric;
}

function calculateTableConfidence(table: ParsedTable): number {
  let confidence = 0.7; // Base confidence for valid table

  // More rows = higher confidence
  if (table.rows.length >= 5) confidence += 0.1;
  if (table.rows.length >= 10) confidence += 0.05;

  // Consistent column count
  const headerCount = table.headers.length;
  const allConsistent = table.rows.every((r) => r.length === headerCount);
  if (allConsistent) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
