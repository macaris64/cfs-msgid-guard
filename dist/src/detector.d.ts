import { Collision, DetectionResult, NearMiss, ResolvedMsgId } from './types';
/**
 * Detect topic ID collisions within each of the 4 MsgID channels.
 *
 * A collision occurs when two or more entries share the same numeric
 * topic ID value within the same channel (meaning their computed
 * MsgIDs will also be identical).
 */
export declare function detectCollisions(resolved: ResolvedMsgId[]): Collision[];
/**
 * Detect near-miss topic IDs: entries within a configurable numeric
 * distance of each other inside the same channel.
 *
 * Exact collisions (gap === 0) are excluded — they are reported
 * separately by detectCollisions().
 *
 * @param gap - Maximum distance to flag. Set to 0 or negative to disable.
 */
export declare function detectNearMisses(resolved: ResolvedMsgId[], gap: number): NearMiss[];
/**
 * Run both collision and near-miss detection, returning a combined result.
 */
export declare function detect(resolved: ResolvedMsgId[], nearMissGap: number): DetectionResult;
//# sourceMappingURL=detector.d.ts.map