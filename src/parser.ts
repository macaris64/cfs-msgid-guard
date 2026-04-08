import * as fs from 'fs';
import { TopicIdEntry, FileParseResult, ParseResult } from './types';

/**
 * Matches: #define DEFAULT_<NAME>_TOPICID <value>
 *
 * Capture groups:
 *   [1] = macro name body (e.g. "CFE_MISSION_ES_CMD" or "SAMPLE_APP_MISSION_CMD")
 *   [2] = numeric value in hex (0x...) or decimal
 *
 * Validated against all 42 DEFAULT_*_TOPICID definitions in cFS Draco.
 */
const TOPICID_REGEX = /^#define\s+DEFAULT_(\w+)_TOPICID\s+(0x[0-9a-fA-F]+|\d+)/gm;

/** Parse a numeric string in hex (0x prefix) or decimal to an integer. */
export function parseNumericValue(raw: string): number {
  if (raw.toLowerCase().startsWith('0x')) {
    return parseInt(raw, 16);
  }
  return parseInt(raw, 10);
}

/**
 * Extract all DEFAULT_*_TOPICID definitions from a single file's content.
 *
 * @param content  - Raw text of the header file
 * @param filePath - Absolute path (used for annotation metadata, not read here)
 * @returns Array of TopicIdEntry found in the content
 */
export function parseFileContent(content: string, filePath: string): TopicIdEntry[] {
  const entries: TopicIdEntry[] = [];

  let match: RegExpExecArray | null;
  TOPICID_REGEX.lastIndex = 0;

  while ((match = TOPICID_REGEX.exec(content)) !== null) {
    const name = match[1];
    const rawValue = match[2];
    const value = parseNumericValue(rawValue);

    const lineNumber = computeLineNumber(content, match.index);

    entries.push({
      name,
      value,
      rawValue,
      filePath,
      line: lineNumber,
    });
  }

  return entries;
}

/**
 * Compute the 1-based line number for a character offset in a string.
 */
function computeLineNumber(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') {
      line++;
    }
  }
  return line;
}

/**
 * Parse a single header file from disk.
 *
 * @param filePath - Absolute path to the header file
 * @returns FileParseResult with all extracted entries
 * @throws If the file cannot be read
 */
export function parseFile(filePath: string): FileParseResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = parseFileContent(content, filePath);
  return { filePath, entries };
}

/**
 * Parse multiple header files and aggregate results.
 *
 * @param filePaths - Array of absolute paths to header files
 * @returns Aggregated ParseResult with per-file results and total count
 */
export function parseFiles(filePaths: string[]): ParseResult {
  const files: FileParseResult[] = [];
  let totalEntries = 0;

  for (const filePath of filePaths) {
    const result = parseFile(filePath);
    files.push(result);
    totalEntries += result.entries.length;
  }

  return { files, totalEntries };
}
