import * as fs from 'fs';
import { parseNumericValue } from './parser';
import {
  BaseAddresses,
  Channel,
  ClassificationMethod,
  ResolvedMsgId,
  TopicIdEntry,
} from './types';

/**
 * Default base addresses matching the cFS Draco bundle.
 * Used when no mapping file is found and no overrides are provided.
 */
const DEFAULT_BASES: BaseAddresses = {
  [Channel.PLATFORM_CMD]: 0x1800,
  [Channel.PLATFORM_TLM]: 0x0800,
  [Channel.GLOBAL_CMD]: 0x1860,
  [Channel.GLOBAL_TLM]: 0x0860,
};

// --- Regex patterns ----------------------------------------------------------

/**
 * Extracts base address constants from default_cfe_core_api_msgid_mapping.h.
 *
 * Matches lines like:
 *   #define DEFAULT_CFE_PLATFORM_CMD_MID_BASE  0x1800
 *   #define DEFAULT_GLOBAL_TLM_MID_BASE        0x0860
 */
const BASE_ADDR_REGEX =
  /^#define\s+DEFAULT_(CFE_PLATFORM_CMD|CFE_PLATFORM_TLM|GLOBAL_CMD|GLOBAL_TLM)_MID_BASE\s+(0x[0-9a-fA-F]+)/gm;

/**
 * Pattern A (direct): full topic name appears inside TOPICID_TO_MIDV().
 *
 * Matches lines like:
 *   CFE_PLATFORM_CMD_TOPICID_TO_MIDV(TO_LAB_MISSION_CMD_TOPICID)
 */
const DIRECT_CHANNEL_REGEX =
  /CFE_(PLATFORM|GLOBAL)_(CMD|TLM)_TOPICID_TO_MIDV\((\w+)_TOPICID\)/gm;

/**
 * Pattern B step 1: MIDVAL template definition in *_msgid_values.h.
 *
 * Matches lines like:
 *   #define CFE_PLATFORM_TIME_CMD_MIDVAL(x) CFE_PLATFORM_CMD_TOPICID_TO_MIDV(CFE_MISSION_TIME_##x##_TOPICID)
 *   #define SAMPLE_APP_CMD_PLATFORM_MIDVAL(x) CFE_PLATFORM_CMD_TOPICID_TO_MIDV(SAMPLE_APP_MISSION_##x##_TOPICID)
 */
const MIDVAL_TEMPLATE_REGEX =
  /^#define\s+(\w+_MIDVAL)\(x\)\s+CFE_(PLATFORM|GLOBAL)_(CMD|TLM)_TOPICID_TO_MIDV\((\w+)##x##_TOPICID\)/gm;

/**
 * Pattern B step 2: MIDVAL invocation in *_msgids.h.
 *
 * Matches lines like:
 *   CFE_PLATFORM_TIME_GLBCMD_MIDVAL(DATA_CMD)
 *   SAMPLE_APP_CMD_PLATFORM_MIDVAL(CMD)
 */
const MIDVAL_INVOKE_REGEX = /(\w+_MIDVAL)\((\w+)\)/gm;

// --- Types for internal channel map building ---------------------------------

interface MidvalTemplate {
  channel: Channel;
  topicPrefix: string;
}

// --- Public API --------------------------------------------------------------

/**
 * Extract the 4 base addresses from a mapping header's text content.
 * Manual overrides take precedence over parsed values; parsed values
 * take precedence over built-in defaults.
 */
export function extractBaseAddresses(
  content: string | null,
  overrides: Partial<BaseAddresses> = {},
): BaseAddresses {
  const parsed: Partial<BaseAddresses> = {};

  if (content) {
    BASE_ADDR_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BASE_ADDR_REGEX.exec(content)) !== null) {
      const channel = mapBaseNameToChannel(match[1]);
      /* istanbul ignore else -- regex constrains input to the 4 handled cases */
      if (channel) {
        parsed[channel] = parseNumericValue(match[2]);
      }
    }
  }

  return {
    [Channel.PLATFORM_CMD]:
      overrides[Channel.PLATFORM_CMD] ?? parsed[Channel.PLATFORM_CMD] ?? DEFAULT_BASES[Channel.PLATFORM_CMD],
    [Channel.PLATFORM_TLM]:
      overrides[Channel.PLATFORM_TLM] ?? parsed[Channel.PLATFORM_TLM] ?? DEFAULT_BASES[Channel.PLATFORM_TLM],
    [Channel.GLOBAL_CMD]:
      overrides[Channel.GLOBAL_CMD] ?? parsed[Channel.GLOBAL_CMD] ?? DEFAULT_BASES[Channel.GLOBAL_CMD],
    [Channel.GLOBAL_TLM]:
      overrides[Channel.GLOBAL_TLM] ?? parsed[Channel.GLOBAL_TLM] ?? DEFAULT_BASES[Channel.GLOBAL_TLM],
  };
}

/**
 * Build the authoritative topic-name -> channel map from *_msgids.h and
 * *_msgid_values.h file contents (Tier 1 classification).
 *
 * Handles both Pattern A (direct TOPICID_TO_MIDV references) and
 * Pattern B (indirect MIDVAL templates + invocations).
 */
export function buildChannelMap(
  msgIdContents: string[],
  msgIdValueContents: string[],
): Map<string, Channel> {
  const channelMap = new Map<string, Channel>();

  // --- Pattern A: direct references in *_msgids.h ---------------------------
  for (const content of msgIdContents) {
    DIRECT_CHANNEL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = DIRECT_CHANNEL_REGEX.exec(content)) !== null) {
      const channel = compositeChannel(match[1], match[2]);
      const topicName = match[3];
      channelMap.set(topicName, channel);
    }
  }

  // --- Pattern B step 1: build MIDVAL template registry from *_msgid_values.h
  const midvalRegistry = new Map<string, MidvalTemplate>();

  for (const content of msgIdValueContents) {
    MIDVAL_TEMPLATE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MIDVAL_TEMPLATE_REGEX.exec(content)) !== null) {
      const midvalName = match[1];
      const channel = compositeChannel(match[2], match[3]);
      const topicPrefix = match[4];
      midvalRegistry.set(midvalName, { channel, topicPrefix });
    }
  }

  // --- Pattern B step 2: resolve MIDVAL invocations from *_msgids.h ----------
  for (const content of msgIdContents) {
    MIDVAL_INVOKE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MIDVAL_INVOKE_REGEX.exec(content)) !== null) {
      const midvalName = match[1];
      const param = match[2];
      const template = midvalRegistry.get(midvalName);
      if (template) {
        const topicName = template.topicPrefix + param;
        if (!channelMap.has(topicName)) {
          channelMap.set(topicName, template.channel);
        }
      }
    }
  }

  return channelMap;
}

/**
 * Tier 2 heuristic: classify a topic name by naming convention.
 *
 * - Contains `_TLM` or `_MSG` or `_DATA_TYPES` -> PLATFORM_TLM
 * - Everything else -> PLATFORM_CMD
 *
 * Cannot distinguish PLATFORM vs GLOBAL; defaults to PLATFORM.
 */
export function classifyByHeuristic(topicName: string): Channel {
  if (/_TLM/i.test(topicName) || /_MSG/i.test(topicName) || /_DATA_TYPES/i.test(topicName)) {
    return Channel.PLATFORM_TLM;
  }
  return Channel.PLATFORM_CMD;
}

/**
 * Compute final ResolvedMsgId entries by combining parsed topic IDs
 * with the channel map and base addresses.
 *
 * Uses Tier 1 (channelMap) when available, Tier 2 (heuristic) otherwise.
 */
export function resolveTopicIds(
  entries: TopicIdEntry[],
  channelMap: Map<string, Channel>,
  bases: BaseAddresses,
): ResolvedMsgId[] {
  return entries.map(entry => {
    const tier1Channel = channelMap.get(entry.name);
    const channel = tier1Channel ?? classifyByHeuristic(entry.name);
    const classifiedBy = tier1Channel !== undefined
      ? ClassificationMethod.MSGID_HEADER
      : ClassificationMethod.HEURISTIC;
    const msgId = bases[channel] | entry.value;

    return { entry, channel, classifiedBy, msgId };
  });
}

/**
 * Full resolution pipeline: read files, build channel map, compute MsgIDs.
 */
export function resolve(
  topicEntries: TopicIdEntry[],
  msgIdFiles: string[],
  msgIdValueFiles: string[],
  baseMappingFile: string | null,
  baseOverrides: Partial<BaseAddresses> = {},
): ResolvedMsgId[] {
  const baseMappingContent = baseMappingFile
    ? fs.readFileSync(baseMappingFile, 'utf-8')
    : null;

  const bases = extractBaseAddresses(baseMappingContent, baseOverrides);

  const msgIdContents = msgIdFiles.map(f => fs.readFileSync(f, 'utf-8'));
  const msgIdValueContents = msgIdValueFiles.map(f => fs.readFileSync(f, 'utf-8'));

  const channelMap = buildChannelMap(msgIdContents, msgIdValueContents);

  return resolveTopicIds(topicEntries, channelMap, bases);
}

// --- Helpers -----------------------------------------------------------------

function mapBaseNameToChannel(name: string): Channel | null {
  switch (name) {
    case 'CFE_PLATFORM_CMD': return Channel.PLATFORM_CMD;
    case 'CFE_PLATFORM_TLM': return Channel.PLATFORM_TLM;
    case 'GLOBAL_CMD': return Channel.GLOBAL_CMD;
    case 'GLOBAL_TLM': return Channel.GLOBAL_TLM;
    /* istanbul ignore next -- regex alternation prevents unknown names */
    default: return null;
  }
}

function compositeChannel(scope: string, direction: string): Channel {
  const key = `${scope}_${direction}`;
  switch (key) {
    case 'PLATFORM_CMD': return Channel.PLATFORM_CMD;
    case 'PLATFORM_TLM': return Channel.PLATFORM_TLM;
    case 'GLOBAL_CMD': return Channel.GLOBAL_CMD;
    case 'GLOBAL_TLM': return Channel.GLOBAL_TLM;
    /* istanbul ignore next -- regex alternation prevents unknown combos */
    default: return Channel.PLATFORM_CMD;
  }
}
