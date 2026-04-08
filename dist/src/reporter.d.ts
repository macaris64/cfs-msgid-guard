import { BaseAddresses, DetectionResult, TopicIdEntry } from './types';
/**
 * Derive the application name from a topic entry's macro name.
 *
 * cFE core modules:  CFE_MISSION_ES_CMD       -> CFE_ES
 * Applications:      SAMPLE_APP_MISSION_CMD    -> SAMPLE_APP
 */
export declare function extractAppName(entry: TopicIdEntry): string;
/**
 * Generate a professional Markdown Job Summary report.
 * Returns the raw Markdown string (does not write to core.summary).
 */
export declare function generateJobSummary(result: DetectionResult, bases: BaseAddresses): string;
/**
 * Write the Markdown summary to the GitHub Actions Job Summary.
 */
export declare function writeJobSummary(markdown: string): Promise<void>;
/**
 * Emit PR annotations for collisions (errors) and near-misses (warnings).
 */
export declare function emitAnnotations(result: DetectionResult): void;
/**
 * Generate a machine-readable JSON artifact of the full allocation map.
 */
export declare function generateJsonArtifact(result: DetectionResult, bases: BaseAddresses): string;
export declare function asciiTable(headers: string[], rows: string[][]): string;
export declare function generateAuditReport(result: DetectionResult, bases: BaseAddresses, scanPath: string, expectedCount: number | null): string;
//# sourceMappingURL=reporter.d.ts.map