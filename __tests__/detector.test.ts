import * as path from 'path';
import { detectCollisions, detectNearMisses, detect } from '../src/detector';
import { resolve } from '../src/resolver';
import { parseFileContent, parseFiles } from '../src/parser';
import {
  Channel,
  ClassificationMethod,
  ResolvedMsgId,
  TopicIdEntry,
  BaseAddresses,
} from '../src/types';
import * as fs from 'fs';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

// --- Test helpers ------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// detectCollisions
// ---------------------------------------------------------------------------
describe('detectCollisions', () => {
  it('returns empty for unique topic IDs per channel', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('APP_A_CMD', 0x80, Channel.PLATFORM_CMD),
      makeResolved('APP_B_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_A_HK_TLM', 0x80, Channel.PLATFORM_TLM),
    ];

    expect(detectCollisions(resolved)).toHaveLength(0);
  });

  it('detects collision between two entries with same topic ID in same channel', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('APP_A_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h', 10),
      makeResolved('APP_B_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h', 10),
    ];

    const collisions = detectCollisions(resolved);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].channel).toBe(Channel.PLATFORM_CMD);
    expect(collisions[0].topicIdValue).toBe(0x82);
    expect(collisions[0].msgId).toBe(0x1800 | 0x82);
    expect(collisions[0].entries).toHaveLength(2);
    expect(collisions[0].entries.map(e => e.name).sort()).toEqual(['APP_A_CMD', 'APP_B_CMD']);
  });

  it('detects multi-way collision (3+ entries)', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('APP_A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_B_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_C_CMD', 0x82, Channel.PLATFORM_CMD),
    ];

    const collisions = detectCollisions(resolved);
    expect(collisions).toHaveLength(1);
    expect(collisions[0].entries).toHaveLength(3);
  });

  it('does NOT flag same topic ID across different channels as collision', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('APP_A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_A_HK_TLM', 0x82, Channel.PLATFORM_TLM),
    ];

    expect(detectCollisions(resolved)).toHaveLength(0);
  });

  it('detects collisions independently in each channel', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('APP_A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_B_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('APP_A_TLM', 0x50, Channel.PLATFORM_TLM),
      makeResolved('APP_B_TLM', 0x50, Channel.PLATFORM_TLM),
    ];

    const collisions = detectCollisions(resolved);
    expect(collisions).toHaveLength(2);

    const channels = collisions.map(c => c.channel);
    expect(channels).toContain(Channel.PLATFORM_CMD);
    expect(channels).toContain(Channel.PLATFORM_TLM);
  });

  it('sorts collisions by channel then topic ID value', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('Z_TLM', 0x10, Channel.PLATFORM_TLM),
      makeResolved('Y_TLM', 0x10, Channel.PLATFORM_TLM),
      makeResolved('B_CMD', 0x05, Channel.PLATFORM_CMD),
      makeResolved('A_CMD', 0x05, Channel.PLATFORM_CMD),
      makeResolved('D_CMD', 0x02, Channel.PLATFORM_CMD),
      makeResolved('C_CMD', 0x02, Channel.PLATFORM_CMD),
    ];

    const collisions = detectCollisions(resolved);
    expect(collisions).toHaveLength(3);
    expect(collisions[0].channel).toBe(Channel.PLATFORM_CMD);
    expect(collisions[0].topicIdValue).toBe(0x02);
    expect(collisions[1].channel).toBe(Channel.PLATFORM_CMD);
    expect(collisions[1].topicIdValue).toBe(0x05);
    expect(collisions[2].channel).toBe(Channel.PLATFORM_TLM);
    expect(collisions[2].topicIdValue).toBe(0x10);
  });

  it('returns empty for empty input', () => {
    expect(detectCollisions([])).toHaveLength(0);
  });

  it('returns empty for single entry', () => {
    expect(detectCollisions([
      makeResolved('ONLY_CMD', 1, Channel.PLATFORM_CMD),
    ])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detectCollisions with real fixture data (collision pair from Week 1)
// ---------------------------------------------------------------------------
describe('detectCollisions with fixture 3 (collision pair)', () => {
  it('detects the APP_A / APP_B CMD collision at 0x82', () => {
    const entriesA = parseFileContent(
      readFixture('collision_app_a_topicids.h'),
      path.join(FIXTURES, 'collision_app_a_topicids.h'),
    );
    const entriesB = parseFileContent(
      readFixture('collision_app_b_topicids.h'),
      path.join(FIXTURES, 'collision_app_b_topicids.h'),
    );

    const allEntries = [...entriesA, ...entriesB];
    const resolved = resolve(allEntries, [], [], null);
    const collisions = detectCollisions(resolved);

    const cmdCollisions = collisions.filter(c => c.channel === Channel.PLATFORM_CMD);
    expect(cmdCollisions.length).toBeGreaterThanOrEqual(1);

    const at82 = cmdCollisions.find(c => c.topicIdValue === 0x82);
    expect(at82).toBeDefined();
    expect(at82!.entries).toHaveLength(2);
    expect(at82!.entries.map(e => e.name).sort()).toEqual([
      'APP_A_MISSION_CMD',
      'APP_B_MISSION_CMD',
    ]);
    expect(at82!.msgId).toBe(0x1800 | 0x82);
  });
});

// ---------------------------------------------------------------------------
// detectNearMisses
// ---------------------------------------------------------------------------
describe('detectNearMisses', () => {
  it('returns empty when gap is 0 (disabled)', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x83, Channel.PLATFORM_CMD),
    ];

    expect(detectNearMisses(resolved, 0)).toHaveLength(0);
  });

  it('returns empty when gap is negative', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x83, Channel.PLATFORM_CMD),
    ];

    expect(detectNearMisses(resolved, -1)).toHaveLength(0);
  });

  it('flags entries within the gap distance', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x84, Channel.PLATFORM_CMD),
    ];

    const nearMisses = detectNearMisses(resolved, 2);
    expect(nearMisses).toHaveLength(1);
    expect(nearMisses[0].gap).toBe(2);
    expect(nearMisses[0].channel).toBe(Channel.PLATFORM_CMD);
  });

  it('does not flag entries outside the gap distance', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x85, Channel.PLATFORM_CMD),
    ];

    expect(detectNearMisses(resolved, 2)).toHaveLength(0);
  });

  it('does not flag exact collisions (distance = 0)', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x82, Channel.PLATFORM_CMD),
    ];

    expect(detectNearMisses(resolved, 5)).toHaveLength(0);
  });

  it('only flags within the same channel', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD),
      makeResolved('A_TLM', 0x83, Channel.PLATFORM_TLM),
    ];

    expect(detectNearMisses(resolved, 2)).toHaveLength(0);
  });

  it('detects multiple near-misses in a cluster', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x80, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x81, Channel.PLATFORM_CMD),
      makeResolved('C_CMD', 0x82, Channel.PLATFORM_CMD),
    ];

    const nearMisses = detectNearMisses(resolved, 2);
    expect(nearMisses).toHaveLength(3);
  });

  it('returns empty for empty input', () => {
    expect(detectNearMisses([], 5)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// detect (combined)
// ---------------------------------------------------------------------------
describe('detect (combined entry point)', () => {
  it('returns both collisions and near-misses', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h'),
      makeResolved('B_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h'),
      makeResolved('C_CMD', 0x84, Channel.PLATFORM_CMD, '/c.h'),
    ];

    const result = detect(resolved, 2);

    expect(result.collisions).toHaveLength(1);
    expect(result.collisions[0].topicIdValue).toBe(0x82);
    expect(result.nearMisses).toHaveLength(2);
    expect(result.resolved).toBe(resolved);
  });

  it('returns empty results for clean input', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x10, Channel.PLATFORM_CMD),
      makeResolved('B_CMD', 0x20, Channel.PLATFORM_CMD),
      makeResolved('C_TLM', 0x10, Channel.PLATFORM_TLM),
    ];

    const result = detect(resolved, 2);

    expect(result.collisions).toHaveLength(0);
    expect(result.nearMisses).toHaveLength(0);
    expect(result.resolved).toHaveLength(3);
  });

  it('works with near-miss gap disabled', () => {
    const resolved: ResolvedMsgId[] = [
      makeResolved('A_CMD', 0x82, Channel.PLATFORM_CMD, '/a.h'),
      makeResolved('B_CMD', 0x82, Channel.PLATFORM_CMD, '/b.h'),
      makeResolved('C_CMD', 0x83, Channel.PLATFORM_CMD, '/c.h'),
    ];

    const result = detect(resolved, 0);

    expect(result.collisions).toHaveLength(1);
    expect(result.nearMisses).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: real cFS headers should produce 0 collisions
// ---------------------------------------------------------------------------
describe('detect against real cFS Draco headers', () => {
  const REAL_TOPICID_FILES = [
    'cfe_es_topicids.h', 'cfe_evs_topicids.h', 'cfe_sb_topicids.h',
    'cfe_tbl_topicids.h', 'cfe_time_topicids.h', 'cfe_test_topicids.h',
    'sample_app_topicids.h', 'ci_lab_topicids.h', 'to_lab_topicids.h',
  ];

  let resolved: ResolvedMsgId[];

  beforeAll(() => {
    const filePaths = REAL_TOPICID_FILES.map(f => path.join(REAL_FIXTURES, f));
    const parseResult = parseFiles(filePaths);
    const allEntries = parseResult.files.flatMap(f => f.entries);

    resolved = resolve(
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
  });

  it('produces 0 collisions on the default bundle', () => {
    const result = detect(resolved, 0);
    expect(result.collisions).toHaveLength(0);
  });

  it('all 42 entries are resolved', () => {
    expect(resolved).toHaveLength(42);
  });

  it('produces near-misses with large gap (expected for adjacent allocations)', () => {
    const result = detect(resolved, 3);
    expect(result.nearMisses.length).toBeGreaterThan(0);
  });

  it('no collisions even with near-miss detection enabled', () => {
    const result = detect(resolved, 5);
    expect(result.collisions).toHaveLength(0);
  });
});
