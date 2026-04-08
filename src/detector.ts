import {
  Channel,
  Collision,
  DetectionResult,
  NearMiss,
  ResolvedMsgId,
} from './types';

/**
 * Detect topic ID collisions within each of the 4 MsgID channels.
 *
 * A collision occurs when two or more entries share the same numeric
 * topic ID value within the same channel (meaning their computed
 * MsgIDs will also be identical).
 */
export function detectCollisions(resolved: ResolvedMsgId[]): Collision[] {
  const collisions: Collision[] = [];
  const buckets = groupByChannel(resolved);

  for (const channel of Object.values(Channel)) {
    const entries = buckets.get(channel);
    if (!entries || entries.length < 2) continue;

    const byValue = new Map<number, ResolvedMsgId[]>();
    for (const r of entries) {
      const group = byValue.get(r.entry.value) ?? [];
      group.push(r);
      byValue.set(r.entry.value, group);
    }

    for (const [topicIdValue, group] of byValue) {
      if (group.length >= 2) {
        collisions.push({
          channel,
          topicIdValue,
          msgId: group[0].msgId,
          entries: group.map(r => r.entry),
        });
      }
    }
  }

  return collisions.sort(collisionComparator);
}

/**
 * Detect near-miss topic IDs: entries within a configurable numeric
 * distance of each other inside the same channel.
 *
 * Exact collisions (gap === 0) are excluded — they are reported
 * separately by detectCollisions().
 *
 * @param gap - Maximum distance to flag. Set to 0 or negative to disable.
 */
export function detectNearMisses(
  resolved: ResolvedMsgId[],
  gap: number,
): NearMiss[] {
  if (gap <= 0) return [];

  const nearMisses: NearMiss[] = [];
  const buckets = groupByChannel(resolved);

  for (const channel of Object.values(Channel)) {
    const entries = buckets.get(channel);
    if (!entries || entries.length < 2) continue;

    const sorted = [...entries].sort((a, b) => a.entry.value - b.entry.value);

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const distance = sorted[j].entry.value - sorted[i].entry.value;
        if (distance > gap) break;
        if (distance === 0) continue;

        nearMisses.push({
          channel,
          entryA: sorted[i],
          entryB: sorted[j],
          gap: distance,
        });
      }
    }
  }

  return nearMisses;
}

/**
 * Run both collision and near-miss detection, returning a combined result.
 */
export function detect(
  resolved: ResolvedMsgId[],
  nearMissGap: number,
): DetectionResult {
  return {
    collisions: detectCollisions(resolved),
    nearMisses: detectNearMisses(resolved, nearMissGap),
    resolved,
  };
}

// --- Helpers -----------------------------------------------------------------

function groupByChannel(resolved: ResolvedMsgId[]): Map<Channel, ResolvedMsgId[]> {
  const map = new Map<Channel, ResolvedMsgId[]>();
  for (const r of resolved) {
    const group = map.get(r.channel) ?? [];
    group.push(r);
    map.set(r.channel, group);
  }
  return map;
}

const CHANNEL_ORDER: Record<Channel, number> = {
  [Channel.PLATFORM_CMD]: 0,
  [Channel.PLATFORM_TLM]: 1,
  [Channel.GLOBAL_CMD]: 2,
  [Channel.GLOBAL_TLM]: 3,
};

function collisionComparator(a: Collision, b: Collision): number {
  const channelDiff = CHANNEL_ORDER[a.channel] - CHANNEL_ORDER[b.channel];
  if (channelDiff !== 0) return channelDiff;
  return a.topicIdValue - b.topicIdValue;
}
