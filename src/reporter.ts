import * as core from '@actions/core';
import * as path from 'path';
import {
  BaseAddresses,
  Channel,
  Collision,
  DetectionResult,
  ResolvedMsgId,
  TopicIdEntry,
} from './types';

const CHANNEL_LABELS: Record<Channel, string> = {
  [Channel.PLATFORM_CMD]: 'Platform Command',
  [Channel.PLATFORM_TLM]: 'Platform Telemetry',
  [Channel.GLOBAL_CMD]: 'Global Command',
  [Channel.GLOBAL_TLM]: 'Global Telemetry',
};

const CHANNEL_ORDER: Channel[] = [
  Channel.PLATFORM_CMD,
  Channel.PLATFORM_TLM,
  Channel.GLOBAL_CMD,
  Channel.GLOBAL_TLM,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the application name from a topic entry's macro name.
 *
 * cFE core modules:  CFE_MISSION_ES_CMD       -> CFE_ES
 * Applications:      SAMPLE_APP_MISSION_CMD    -> SAMPLE_APP
 */
export function extractAppName(entry: TopicIdEntry): string {
  const name = entry.name;

  const missionIdx = name.indexOf('_MISSION_');
  if (missionIdx === -1) {
    return name;
  }

  const prefix = name.substring(0, missionIdx);

  if (prefix === 'CFE') {
    const afterMission = name.substring(missionIdx + '_MISSION_'.length);
    const parts = afterMission.split('_');
    return `CFE_${parts[0]}`;
  }

  return prefix;
}

/**
 * Generate a professional Markdown Job Summary report.
 * Returns the raw Markdown string (does not write to core.summary).
 */
export function generateJobSummary(
  result: DetectionResult,
  bases: BaseAddresses,
): string {
  const lines: string[] = [];
  const hasFail = result.collisions.length > 0;
  const statusIcon = hasFail ? '🔴 FAIL' : '🟢 PASS';
  const apps = uniqueApps(result.resolved);

  lines.push('# cFS Message ID Allocation Map');
  lines.push('');
  lines.push(`> **Status**: ${statusIcon}`);
  lines.push(`> **Scan Date**: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // -- Executive Summary ----------------------------------------------------
  lines.push('## Executive Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Applications Scanned | ${apps.size} |`);
  lines.push(`| Topic IDs Resolved | ${result.resolved.length} |`);
  lines.push(`| Collisions Detected | ${result.collisions.length} |`);
  lines.push(`| Near-Miss Warnings | ${result.nearMisses.length} |`);
  lines.push('');

  // -- Collision Details (shown first when present) -------------------------
  if (result.collisions.length > 0) {
    lines.push('## Collision Details');
    lines.push('');
    for (const c of result.collisions) {
      lines.push(
        `### COLLISION: ${CHANNEL_LABELS[c.channel]} @ MsgID \`${toHex(c.msgId)}\` (Topic ID \`${toHex(c.topicIdValue)}\`)`,
      );
      lines.push('');
      lines.push('| App | Topic Name | Source |');
      lines.push('|-----|-----------|--------|');
      for (const e of c.entries) {
        lines.push(
          `| ${extractAppName(e)} | \`${e.name}\` | \`${shortPath(e.filePath)}:${e.line}\` |`,
        );
      }
      lines.push('');
    }
  }

  // -- Near-Miss Warnings ---------------------------------------------------
  if (result.nearMisses.length > 0) {
    lines.push('## Near-Miss Warnings');
    lines.push('');
    lines.push('| Channel | Entry A | Entry B | Gap | MsgID A | MsgID B |');
    lines.push('|---------|---------|---------|----:|--------:|--------:|');
    for (const nm of result.nearMisses) {
      lines.push(
        `| ${CHANNEL_LABELS[nm.channel]} ` +
          `| \`${nm.entryA.entry.name}\` ` +
          `| \`${nm.entryB.entry.name}\` ` +
          `| ${nm.gap} ` +
          `| \`${toHex(nm.entryA.msgId)}\` ` +
          `| \`${toHex(nm.entryB.msgId)}\` |`,
      );
    }
    lines.push('');
  }

  // -- Per-Channel Allocation Tables ----------------------------------------
  lines.push('## Allocation Map');
  lines.push('');

  const byChannel = groupByChannel(result.resolved);
  const collisionSet = buildCollisionSet(result.collisions);

  for (const channel of CHANNEL_ORDER) {
    const entries = byChannel.get(channel);
    if (!entries || entries.length === 0) continue;

    const base = bases[channel];
    lines.push(`### ${CHANNEL_LABELS[channel]} (Base: \`${toHex(base)}\`)`);
    lines.push('');
    lines.push('| App | Topic Name | Topic ID | MsgID | Source | Status |');
    lines.push('|-----|-----------|:--------:|:-----:|--------|:------:|');

    const sorted = [...entries].sort((a, b) => a.entry.value - b.entry.value);
    for (const r of sorted) {
      const key = `${r.channel}:${r.entry.value}`;
      const status = collisionSet.has(key) ? '**COLLISION**' : 'OK';
      lines.push(
        `| ${extractAppName(r.entry)} ` +
          `| \`${r.entry.name}\` ` +
          `| \`${toHex(r.entry.value)}\` ` +
          `| \`${toHex(r.msgId)}\` ` +
          `| \`${shortPath(r.entry.filePath)}:${r.entry.line}\` ` +
          `| ${status} |`,
      );
    }
    lines.push('');
  }

  // -- Footer ---------------------------------------------------------------
  lines.push('---');
  lines.push('*Generated by cfs-msgid-guard v1.0.0*');

  return lines.join('\n');
}

/**
 * Write the Markdown summary to the GitHub Actions Job Summary.
 */
export async function writeJobSummary(markdown: string): Promise<void> {
  await core.summary.addRaw(markdown).write();
}

/**
 * Emit PR annotations for collisions (errors) and near-misses (warnings).
 */
export function emitAnnotations(result: DetectionResult): void {
  for (const collision of result.collisions) {
    const names = collision.entries.map(e => extractAppName(e));
    const msg =
      `MsgID collision on ${CHANNEL_LABELS[collision.channel]} channel: ` +
      `topic ID ${toHex(collision.topicIdValue)} -> MsgID ${toHex(collision.msgId)} ` +
      `is claimed by ${names.join(', ')}`;

    for (const entry of collision.entries) {
      core.error(msg, {
        file: entry.filePath,
        startLine: entry.line,
        title: 'MsgID Collision',
      });
    }
  }

  for (const nm of result.nearMisses) {
    const msg =
      `Near-miss on ${CHANNEL_LABELS[nm.channel]} channel: ` +
      `${nm.entryA.entry.name} (${toHex(nm.entryA.entry.value)}) and ` +
      `${nm.entryB.entry.name} (${toHex(nm.entryB.entry.value)}) ` +
      `are only ${nm.gap} apart`;

    core.warning(msg, {
      file: nm.entryA.entry.filePath,
      startLine: nm.entryA.entry.line,
      title: 'MsgID Near-Miss',
    });
    core.warning(msg, {
      file: nm.entryB.entry.filePath,
      startLine: nm.entryB.entry.line,
      title: 'MsgID Near-Miss',
    });
  }
}

/**
 * Generate a machine-readable JSON artifact of the full allocation map.
 */
export function generateJsonArtifact(
  result: DetectionResult,
  bases: BaseAddresses,
): string {
  const apps = uniqueApps(result.resolved);

  const artifact = {
    summary: {
      totalApps: apps.size,
      totalTopics: result.resolved.length,
      collisions: result.collisions.length,
      nearMisses: result.nearMisses.length,
    },
    bases: {
      PLATFORM_CMD: toHex(bases[Channel.PLATFORM_CMD]),
      PLATFORM_TLM: toHex(bases[Channel.PLATFORM_TLM]),
      GLOBAL_CMD: toHex(bases[Channel.GLOBAL_CMD]),
      GLOBAL_TLM: toHex(bases[Channel.GLOBAL_TLM]),
    },
    allocations: result.resolved.map(r => ({
      app: extractAppName(r.entry),
      topicName: r.entry.name,
      topicId: toHex(r.entry.value),
      channel: r.channel,
      classifiedBy: r.classifiedBy,
      msgId: toHex(r.msgId),
      source: `${shortPath(r.entry.filePath)}:${r.entry.line}`,
    })),
    collisions: result.collisions.map(c => ({
      channel: c.channel,
      topicId: toHex(c.topicIdValue),
      msgId: toHex(c.msgId),
      entries: c.entries.map(e => ({
        app: extractAppName(e),
        topicName: e.name,
        source: `${shortPath(e.filePath)}:${e.line}`,
      })),
    })),
    nearMisses: result.nearMisses.map(nm => ({
      channel: nm.channel,
      gap: nm.gap,
      entryA: {
        topicName: nm.entryA.entry.name,
        topicId: toHex(nm.entryA.entry.value),
        msgId: toHex(nm.entryA.msgId),
      },
      entryB: {
        topicName: nm.entryB.entry.name,
        topicId: toHex(nm.entryB.entry.value),
        msgId: toHex(nm.entryB.msgId),
      },
    })),
  };

  return JSON.stringify(artifact, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

function shortPath(filePath: string): string {
  return path.basename(filePath);
}

function uniqueApps(resolved: ResolvedMsgId[]): Set<string> {
  const apps = new Set<string>();
  for (const r of resolved) {
    apps.add(extractAppName(r.entry));
  }
  return apps;
}

function groupByChannel(resolved: ResolvedMsgId[]): Map<Channel, ResolvedMsgId[]> {
  const map = new Map<Channel, ResolvedMsgId[]>();
  for (const r of resolved) {
    const group = map.get(r.channel) ?? [];
    group.push(r);
    map.set(r.channel, group);
  }
  return map;
}

function buildCollisionSet(collisions: Collision[]): Set<string> {
  const set = new Set<string>();
  for (const c of collisions) {
    set.add(`${c.channel}:${c.topicIdValue}`);
  }
  return set;
}
