import { BaseAddresses, Channel, ResolvedMsgId, TopicIdEntry } from './types';
/**
 * Extract the 4 base addresses from a mapping header's text content.
 * Manual overrides take precedence over parsed values; parsed values
 * take precedence over built-in defaults.
 */
export declare function extractBaseAddresses(content: string | null, overrides?: Partial<BaseAddresses>): BaseAddresses;
/**
 * Build the authoritative topic-name -> channel map from *_msgids.h and
 * *_msgid_values.h file contents (Tier 1 classification).
 *
 * Handles both Pattern A (direct TOPICID_TO_MIDV references) and
 * Pattern B (indirect MIDVAL templates + invocations).
 */
export declare function buildChannelMap(msgIdContents: string[], msgIdValueContents: string[]): Map<string, Channel>;
/**
 * Tier 2 heuristic: classify a topic name by naming convention.
 *
 * - Contains `_TLM` or `_MSG` or `_DATA_TYPES` -> PLATFORM_TLM
 * - Everything else -> PLATFORM_CMD
 *
 * Cannot distinguish PLATFORM vs GLOBAL; defaults to PLATFORM.
 */
export declare function classifyByHeuristic(topicName: string): Channel;
/**
 * Compute final ResolvedMsgId entries by combining parsed topic IDs
 * with the channel map and base addresses.
 *
 * Uses Tier 1 (channelMap) when available, Tier 2 (heuristic) otherwise.
 */
export declare function resolveTopicIds(entries: TopicIdEntry[], channelMap: Map<string, Channel>, bases: BaseAddresses): ResolvedMsgId[];
/**
 * Full resolution pipeline: read files, build channel map, compute MsgIDs.
 */
export declare function resolve(topicEntries: TopicIdEntry[], msgIdFiles: string[], msgIdValueFiles: string[], baseMappingFile: string | null, baseOverrides?: Partial<BaseAddresses>): ResolvedMsgId[];
//# sourceMappingURL=resolver.d.ts.map