import * as path from 'path';
import {
  extractAppName,
  generateJobSummary,
  emitAnnotations,
  generateJsonArtifact,
} from '../src/reporter';
import { parseFiles } from '../src/parser';
import { resolve } from '../src/resolver';
import { detect } from '../src/detector';
import {
  BaseAddresses,
  Channel,
  ClassificationMethod,
  Collision,
  DetectionResult,
  NearMiss,
  ResolvedMsgId,
  TopicIdEntry,
} from '../src/types';

jest.mock('@actions/core', () => ({
  error: jest.fn(),
  warning: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as core from '@actions/core';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

const BASES: BaseAddresses = {
  [Channel.PLATFORM_CMD]: 0x1800,
  [Channel.PLATFORM_TLM]: 0x0800,
  [Channel.GLOBAL_CMD]: 0x1860,
  [Channel.GLOBAL_TLM]: 0x0860,
};

function makeEntry(name: string, value: number, file = '/test.h', line = 1): TopicIdEntry {
  return { name, value, rawValue: `0x${value.toString(16)}`, filePath: file, line };
}

function makeResolved(
  name: string,
  value: number,
  channel: Channel,
  file = '/test.h',
  line = 1,
): ResolvedMsgId {
  const entry = makeEntry(name, value, file, line);
  return {
    entry,
    channel,
    classifiedBy: ClassificationMethod.MSGID_HEADER,
    msgId: BASES[channel] | value,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// extractAppName
// ---------------------------------------------------------------------------
describe('extractAppName', () => {
  it('extracts app name from application-style topics', () => {
    expect(extractAppName(makeEntry('SAMPLE_APP_MISSION_CMD', 0x82))).toBe('SAMPLE_APP');
    expect(extractAppName(makeEntry('TO_LAB_MISSION_SEND_HK', 0x81))).toBe('TO_LAB');
    expect(extractAppName(makeEntry('CI_LAB_MISSION_HK_TLM', 0x84))).toBe('CI_LAB');
  });

  it('extracts module name from cFE-core-style topics', () => {
    expect(extractAppName(makeEntry('CFE_MISSION_ES_CMD', 6))).toBe('CFE_ES');
    expect(extractAppName(makeEntry('CFE_MISSION_EVS_LONG_EVENT_MSG', 8))).toBe('CFE_EVS');
    expect(extractAppName(makeEntry('CFE_MISSION_TIME_DATA_CMD', 0))).toBe('CFE_TIME');
    expect(extractAppName(makeEntry('CFE_MISSION_SB_SUB_RPT_CTRL', 14))).toBe('CFE_SB');
  });

  it('extracts TESTCASE module from cfe_test', () => {
    expect(extractAppName(makeEntry('CFE_MISSION_TESTCASE_CMD', 2))).toBe('CFE_TESTCASE');
  });

  it('returns full name when _MISSION_ is not present', () => {
    expect(extractAppName(makeEntry('SOME_WEIRD_NAME', 1))).toBe('SOME_WEIRD_NAME');
  });
});

// ---------------------------------------------------------------------------
// generateJobSummary
// ---------------------------------------------------------------------------
describe('generateJobSummary', () => {
  it('produces Markdown containing the report title', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('# cFS Message ID Allocation Map');
  });

  it('shows PASS status when there are no collisions', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('SAMPLE_APP_MISSION_HK_TLM', 0x83, Channel.PLATFORM_TLM),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('PASS');
    expect(md).not.toContain('FAIL');
  });

  it('shows FAIL status when collisions exist', () => {
    const resolved = [
      makeResolved('APP_A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h'),
      makeResolved('APP_B_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h'),
    ];
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: resolved.map(r => r.entry),
    };
    const result: DetectionResult = { collisions: [collision], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('FAIL');
  });

  it('includes executive summary with correct counts', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('SAMPLE_APP_MISSION_HK_TLM', 0x83, Channel.PLATFORM_TLM),
      makeResolved('TO_LAB_MISSION_CMD', 0x80, Channel.PLATFORM_CMD),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);

    expect(md).toContain('Applications Scanned | 2');
    expect(md).toContain('Topic IDs Resolved | 3');
    expect(md).toContain('Collisions Detected | 0');
  });

  it('includes per-channel allocation table with correct hex values', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/test/sample.h', 10),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);

    expect(md).toContain('Platform Command');
    expect(md).toContain('`0x0082`');
    expect(md).toContain('`0x1882`');
    expect(md).toContain('SAMPLE_APP');
    expect(md).toContain('OK');
  });

  it('marks colliding entries in the allocation table', () => {
    const resolved = [
      makeResolved('APP_A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h'),
      makeResolved('APP_B_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h'),
    ];
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: resolved.map(r => r.entry),
    };
    const result: DetectionResult = { collisions: [collision], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('**COLLISION**');
  });

  it('includes collision detail section', () => {
    const resolved = [
      makeResolved('APP_A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h', 5),
      makeResolved('APP_B_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h', 10),
    ];
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: resolved.map(r => r.entry),
    };
    const result: DetectionResult = { collisions: [collision], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);

    expect(md).toContain('## Collision Details');
    expect(md).toContain('COLLISION');
    expect(md).toContain('APP_A');
    expect(md).toContain('APP_B');
  });

  it('includes near-miss warnings section', () => {
    const rA = makeResolved('A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD);
    const rB = makeResolved('B_MISSION_CMD', 0x84, Channel.PLATFORM_CMD);
    const nm: NearMiss = { channel: Channel.PLATFORM_CMD, entryA: rA, entryB: rB, gap: 2 };
    const result: DetectionResult = {
      collisions: [],
      nearMisses: [nm],
      resolved: [rA, rB],
    };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('## Near-Miss Warnings');
    expect(md).toContain('A_MISSION_CMD');
    expect(md).toContain('B_MISSION_CMD');
    expect(md).toContain('| 2 ');
  });

  it('omits collision details section when there are none', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };
    const md = generateJobSummary(result, BASES);
    expect(md).not.toContain('## Collision Details');
  });

  it('omits near-miss section when there are none', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };
    const md = generateJobSummary(result, BASES);
    expect(md).not.toContain('## Near-Miss Warnings');
  });

  it('includes footer with tool name', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('cfs-msgid-guard');
  });

  it('handles GLOBAL_CMD channel entries', () => {
    const resolved = [
      makeResolved('CFE_MISSION_TIME_DATA_CMD', 0, Channel.GLOBAL_CMD),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const md = generateJobSummary(result, BASES);
    expect(md).toContain('Global Command');
    expect(md).toContain('`0x1860`');
  });
});

// ---------------------------------------------------------------------------
// emitAnnotations
// ---------------------------------------------------------------------------
describe('emitAnnotations', () => {
  it('emits core.error for each entry in a collision', () => {
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: [
        makeEntry('APP_A_MISSION_CMD', 0x82, '/src/app_a_topicids.h', 10),
        makeEntry('APP_B_MISSION_CMD', 0x82, '/src/app_b_topicids.h', 15),
      ],
    };
    const result: DetectionResult = {
      collisions: [collision],
      nearMisses: [],
      resolved: [],
    };

    emitAnnotations(result);

    expect(core.error).toHaveBeenCalledTimes(2);
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('collision'),
      expect.objectContaining({
        file: '/src/app_a_topicids.h',
        startLine: 10,
        title: 'MsgID Collision',
      }),
    );
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('collision'),
      expect.objectContaining({
        file: '/src/app_b_topicids.h',
        startLine: 15,
        title: 'MsgID Collision',
      }),
    );
  });

  it('includes both app names in the collision error message', () => {
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: [
        makeEntry('APP_A_MISSION_CMD', 0x82, '/a.h', 1),
        makeEntry('APP_B_MISSION_CMD', 0x82, '/b.h', 1),
      ],
    };
    const result: DetectionResult = {
      collisions: [collision],
      nearMisses: [],
      resolved: [],
    };

    emitAnnotations(result);

    const errorCall = (core.error as jest.Mock).mock.calls[0][0] as string;
    expect(errorCall).toContain('APP_A');
    expect(errorCall).toContain('APP_B');
  });

  it('emits core.warning for each entry in a near-miss pair', () => {
    const rA = makeResolved('A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h', 5);
    const rB = makeResolved('B_MISSION_CMD', 0x84, Channel.PLATFORM_CMD, '/b.h', 10);
    const nm: NearMiss = { channel: Channel.PLATFORM_CMD, entryA: rA, entryB: rB, gap: 2 };
    const result: DetectionResult = {
      collisions: [],
      nearMisses: [nm],
      resolved: [],
    };

    emitAnnotations(result);

    expect(core.warning).toHaveBeenCalledTimes(2);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Near-miss'),
      expect.objectContaining({
        file: '/a.h',
        startLine: 5,
        title: 'MsgID Near-Miss',
      }),
    );
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Near-miss'),
      expect.objectContaining({
        file: '/b.h',
        startLine: 10,
        title: 'MsgID Near-Miss',
      }),
    );
  });

  it('does not emit anything when there are no issues', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };

    emitAnnotations(result);

    expect(core.error).not.toHaveBeenCalled();
    expect(core.warning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generateJsonArtifact
// ---------------------------------------------------------------------------
describe('generateJsonArtifact', () => {
  it('returns valid JSON', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const json = generateJsonArtifact(result, BASES);

    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes correct summary counts', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('SAMPLE_APP_MISSION_HK_TLM', 0x83, Channel.PLATFORM_TLM),
      makeResolved('TO_LAB_MISSION_CMD', 0x80, Channel.PLATFORM_CMD),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const parsed = JSON.parse(generateJsonArtifact(result, BASES));

    expect(parsed.summary.totalApps).toBe(2);
    expect(parsed.summary.totalTopics).toBe(3);
    expect(parsed.summary.collisions).toBe(0);
    expect(parsed.summary.nearMisses).toBe(0);
  });

  it('includes base addresses as hex strings', () => {
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved: [] };
    const parsed = JSON.parse(generateJsonArtifact(result, BASES));

    expect(parsed.bases.PLATFORM_CMD).toBe('0x1800');
    expect(parsed.bases.PLATFORM_TLM).toBe('0x0800');
    expect(parsed.bases.GLOBAL_CMD).toBe('0x1860');
    expect(parsed.bases.GLOBAL_TLM).toBe('0x0860');
  });

  it('includes allocation entries with hex values', () => {
    const resolved = [
      makeResolved('SAMPLE_APP_MISSION_CMD', 0x82, Channel.PLATFORM_CMD, '/sample.h', 5),
    ];
    const result: DetectionResult = { collisions: [], nearMisses: [], resolved };
    const parsed = JSON.parse(generateJsonArtifact(result, BASES));

    expect(parsed.allocations).toHaveLength(1);
    expect(parsed.allocations[0].app).toBe('SAMPLE_APP');
    expect(parsed.allocations[0].topicName).toBe('SAMPLE_APP_MISSION_CMD');
    expect(parsed.allocations[0].topicId).toBe('0x0082');
    expect(parsed.allocations[0].msgId).toBe('0x1882');
    expect(parsed.allocations[0].channel).toBe('PLATFORM_CMD');
  });

  it('includes collision entries', () => {
    const collision: Collision = {
      channel: Channel.PLATFORM_CMD,
      topicIdValue: 0x82,
      msgId: 0x1882,
      entries: [
        makeEntry('APP_A_MISSION_CMD', 0x82, '/a.h', 1),
        makeEntry('APP_B_MISSION_CMD', 0x82, '/b.h', 1),
      ],
    };
    const result: DetectionResult = {
      collisions: [collision],
      nearMisses: [],
      resolved: [],
    };
    const parsed = JSON.parse(generateJsonArtifact(result, BASES));

    expect(parsed.collisions).toHaveLength(1);
    expect(parsed.collisions[0].entries).toHaveLength(2);
    expect(parsed.collisions[0].entries[0].app).toBe('APP_A');
  });

  it('includes near-miss entries', () => {
    const rA = makeResolved('A_MISSION_CMD', 0x82, Channel.PLATFORM_CMD);
    const rB = makeResolved('B_MISSION_CMD', 0x84, Channel.PLATFORM_CMD);
    const nm: NearMiss = { channel: Channel.PLATFORM_CMD, entryA: rA, entryB: rB, gap: 2 };
    const result: DetectionResult = {
      collisions: [],
      nearMisses: [nm],
      resolved: [rA, rB],
    };
    const parsed = JSON.parse(generateJsonArtifact(result, BASES));

    expect(parsed.nearMisses).toHaveLength(1);
    expect(parsed.nearMisses[0].gap).toBe(2);
    expect(parsed.nearMisses[0].entryA.topicName).toBe('A_MISSION_CMD');
  });
});

// ---------------------------------------------------------------------------
// Integration: reporter against real fixtures
// ---------------------------------------------------------------------------
describe('reporter with real cFS fixture data', () => {
  const REAL_TOPICID_FILES = [
    'cfe_es_topicids.h', 'cfe_evs_topicids.h', 'cfe_sb_topicids.h',
    'cfe_tbl_topicids.h', 'cfe_time_topicids.h', 'cfe_test_topicids.h',
    'sample_app_topicids.h', 'ci_lab_topicids.h', 'to_lab_topicids.h',
  ];

  let detectionResult: DetectionResult;

  beforeAll(() => {
    const filePaths = REAL_TOPICID_FILES.map(f => path.join(REAL_FIXTURES, f));
    const parseResult = parseFiles(filePaths);
    const allEntries = parseResult.files.flatMap(f => f.entries);

    const resolved = resolve(
      allEntries,
      [
        path.join(FIXTURES, 'mock_app_msgids.h'),
        path.join(FIXTURES, 'mock_indirect_msgids.h'),
      ],
      [
        path.join(FIXTURES, 'mock_app_msgid_values.h'),
        path.join(FIXTURES, 'mock_time_msgid_values.h'),
      ],
      path.join(FIXTURES, 'default_cfe_core_api_msgid_mapping.h'),
    );

    detectionResult = detect(resolved, 0);
  });

  it('generates a summary that lists all 9 apps', () => {
    const md = generateJobSummary(detectionResult, BASES);
    expect(md).toContain('CFE_ES');
    expect(md).toContain('CFE_EVS');
    expect(md).toContain('CFE_SB');
    expect(md).toContain('CFE_TBL');
    expect(md).toContain('CFE_TIME');
    expect(md).toContain('SAMPLE_APP');
    expect(md).toContain('CI_LAB');
    expect(md).toContain('TO_LAB');
  });

  it('generates a summary with PASS status for default bundle', () => {
    const md = generateJobSummary(detectionResult, BASES);
    expect(md).toContain('PASS');
    expect(md).not.toContain('## Collision Details');
  });

  it('generates valid JSON artifact with 42 allocations', () => {
    const json = generateJsonArtifact(detectionResult, BASES);
    const parsed = JSON.parse(json);
    expect(parsed.allocations).toHaveLength(42);
    expect(parsed.summary.collisions).toBe(0);
  });
});
