import { TopicIdEntry, FileParseResult, ParseResult } from './types';
/** Parse a numeric string in hex (0x prefix) or decimal to an integer. */
export declare function parseNumericValue(raw: string): number;
/**
 * Extract all DEFAULT_*_TOPICID definitions from a single file's content.
 *
 * @param content  - Raw text of the header file
 * @param filePath - Absolute path (used for annotation metadata, not read here)
 * @returns Array of TopicIdEntry found in the content
 */
export declare function parseFileContent(content: string, filePath: string): TopicIdEntry[];
/**
 * Parse a single header file from disk.
 *
 * @param filePath - Absolute path to the header file
 * @returns FileParseResult with all extracted entries
 * @throws If the file cannot be read
 */
export declare function parseFile(filePath: string): FileParseResult;
/**
 * Parse multiple header files and aggregate results.
 *
 * @param filePaths - Array of absolute paths to header files
 * @returns Aggregated ParseResult with per-file results and total count
 */
export declare function parseFiles(filePaths: string[]): ParseResult;
//# sourceMappingURL=parser.d.ts.map