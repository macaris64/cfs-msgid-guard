/**
 * The four MsgID collision domains in cFS.
 *
 * PLATFORM_CMD / PLATFORM_TLM are instance-specific.
 * GLOBAL_CMD / GLOBAL_TLM are broadcast across all instances (used by CFE_TIME).
 */
export declare enum Channel {
    PLATFORM_CMD = "PLATFORM_CMD",
    PLATFORM_TLM = "PLATFORM_TLM",
    GLOBAL_CMD = "GLOBAL_CMD",
    GLOBAL_TLM = "GLOBAL_TLM"
}
/** A single DEFAULT_*_TOPICID definition extracted from a header file. */
export interface TopicIdEntry {
    /** Full macro name without DEFAULT_ prefix and _TOPICID suffix (e.g. "CFE_MISSION_ES_CMD") */
    name: string;
    /** Numeric topic ID value (already parsed from hex/decimal string) */
    value: number;
    /** Original string representation as it appeared in the source (e.g. "0x82" or "6") */
    rawValue: string;
    /** Absolute path to the source file */
    filePath: string;
    /** 1-based line number where the #define appears */
    line: number;
}
/** Result of parsing a single header file. */
export interface FileParseResult {
    filePath: string;
    entries: TopicIdEntry[];
}
/** Aggregated result of parsing all discovered header files. */
export interface ParseResult {
    files: FileParseResult[];
    /** Total number of topic ID definitions found across all files */
    totalEntries: number;
}
/** How a topic's channel was determined. */
export declare enum ClassificationMethod {
    MSGID_HEADER = "MSGID_HEADER",
    HEURISTIC = "HEURISTIC"
}
/** A resolved MsgID with its channel assignment and computed final value. */
export interface ResolvedMsgId {
    entry: TopicIdEntry;
    channel: Channel;
    classifiedBy: ClassificationMethod;
    /** base | topicId */
    msgId: number;
}
/** A collision between two or more topic IDs in the same channel. */
export interface Collision {
    channel: Channel;
    topicIdValue: number;
    msgId: number;
    entries: TopicIdEntry[];
}
/** Base addresses for MsgID computation keyed by channel. */
export interface BaseAddresses {
    [Channel.PLATFORM_CMD]: number;
    [Channel.PLATFORM_TLM]: number;
    [Channel.GLOBAL_CMD]: number;
    [Channel.GLOBAL_TLM]: number;
}
/** A near-miss warning between two entries in the same channel. */
export interface NearMiss {
    channel: Channel;
    entryA: ResolvedMsgId;
    entryB: ResolvedMsgId;
    gap: number;
}
/** Full result of the detection phase. */
export interface DetectionResult {
    collisions: Collision[];
    nearMisses: NearMiss[];
    resolved: ResolvedMsgId[];
}
/** Result from the scanner: categorized file paths. */
export interface ScanResult {
    topicIdFiles: string[];
    msgIdFiles: string[];
    msgIdValueFiles: string[];
    baseMappingFile: string | null;
}
//# sourceMappingURL=types.d.ts.map