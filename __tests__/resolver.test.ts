import * as fs from 'fs';
import * as path from 'path';
import {
  extractBaseAddresses,
  buildChannelMap,
  classifyByHeuristic,
  resolveTopicIds,
  resolve,
} from '../src/resolver';
import { parseFileContent, parseFiles } from '../src/parser';
import { Channel, ClassificationMethod, TopicIdEntry, BaseAddresses } from '../src/types';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

// ---------------------------------------------------------------------------
// extractBaseAddresses
// ---------------------------------------------------------------------------
describe('extractBaseAddresses', () => {
  const mappingContent = readFixture('default_cfe_core_api_msgid_mapping.h');

  it('parses all 4 base addresses from the mock mapping header', () => {
    const bases = extractBaseAddresses(mappingContent);

    expect(bases[Channel.PLATFORM_CMD]).toBe(0x1800);
    expect(bases[Channel.PLATFORM_TLM]).toBe(0x0800);
    expect(bases[Channel.GLOBAL_CMD]).toBe(0x1860);
    expect(bases[Channel.GLOBAL_TLM]).toBe(0x0860);
  });

  it('applies manual overrides over parsed values', () => {
    const bases = extractBaseAddresses(mappingContent, {
      [Channel.PLATFORM_CMD]: 0x2000,
      [Channel.GLOBAL_TLM]: 0x0900,
    });

    expect(bases[Channel.PLATFORM_CMD]).toBe(0x2000);
    expect(bases[Channel.PLATFORM_TLM]).toBe(0x0800);
    expect(bases[Channel.GLOBAL_CMD]).toBe(0x1860);
    expect(bases[Channel.GLOBAL_TLM]).toBe(0x0900);
  });

  it('falls back to built-in defaults when no file content is provided', () => {
    const bases = extractBaseAddresses(null);

    expect(bases[Channel.PLATFORM_CMD]).toBe(0x1800);
    expect(bases[Channel.PLATFORM_TLM]).toBe(0x0800);
    expect(bases[Channel.GLOBAL_CMD]).toBe(0x1860);
    expect(bases[Channel.GLOBAL_TLM]).toBe(0x0860);
  });

  it('overrides take precedence even without file content', () => {
    const bases = extractBaseAddresses(null, {
      [Channel.PLATFORM_CMD]: 0x3000,
    });

    expect(bases[Channel.PLATFORM_CMD]).toBe(0x3000);
    expect(bases[Channel.PLATFORM_TLM]).toBe(0x0800);
  });

  it('handles empty string content gracefully', () => {
    const bases = extractBaseAddresses('');
    expect(bases[Channel.PLATFORM_CMD]).toBe(0x1800);
  });
});

// ---------------------------------------------------------------------------
// buildChannelMap -- Tier 1 Classification
// ---------------------------------------------------------------------------
describe('buildChannelMap', () => {
  describe('Pattern A -- direct TOPICID_TO_MIDV references', () => {
    const directMsgIds = readFixture('mock_app_msgids.h');

    it('classifies TO_LAB CMD topics as PLATFORM_CMD', () => {
      const map = buildChannelMap([directMsgIds], []);

      expect(map.get('TO_LAB_MISSION_CMD')).toBe(Channel.PLATFORM_CMD);
      expect(map.get('TO_LAB_MISSION_SEND_HK')).toBe(Channel.PLATFORM_CMD);
    });

    it('classifies TO_LAB TLM topics as PLATFORM_TLM', () => {
      const map = buildChannelMap([directMsgIds], []);

      expect(map.get('TO_LAB_MISSION_HK_TLM')).toBe(Channel.PLATFORM_TLM);
      expect(map.get('TO_LAB_MISSION_DATA_TYPES')).toBe(Channel.PLATFORM_TLM);
    });

    it('maps all 4 TO_LAB topics', () => {
      const map = buildChannelMap([directMsgIds], []);
      expect(map.size).toBe(4);
    });
  });

  describe('Pattern B -- indirect MIDVAL templates + invocations', () => {
    const indirectMsgIds = readFixture('mock_indirect_msgids.h');
    const appMsgIdValues = readFixture('mock_app_msgid_values.h');
    const timeMsgIdValues = readFixture('mock_time_msgid_values.h');

    it('classifies SAMPLE_APP CMD topics as PLATFORM_CMD', () => {
      const map = buildChannelMap([indirectMsgIds], [appMsgIdValues]);

      expect(map.get('SAMPLE_APP_MISSION_CMD')).toBe(Channel.PLATFORM_CMD);
      expect(map.get('SAMPLE_APP_MISSION_SEND_HK')).toBe(Channel.PLATFORM_CMD);
    });

    it('classifies SAMPLE_APP TLM topics as PLATFORM_TLM', () => {
      const map = buildChannelMap([indirectMsgIds], [appMsgIdValues]);

      expect(map.get('SAMPLE_APP_MISSION_HK_TLM')).toBe(Channel.PLATFORM_TLM);
    });

    it('classifies TIME CMD topics as PLATFORM_CMD', () => {
      const map = buildChannelMap([indirectMsgIds], [timeMsgIdValues]);

      expect(map.get('CFE_MISSION_TIME_CMD')).toBe(Channel.PLATFORM_CMD);
      expect(map.get('CFE_MISSION_TIME_SEND_HK')).toBe(Channel.PLATFORM_CMD);
    });

    it('classifies TIME GLOBAL commands as GLOBAL_CMD', () => {
      const map = buildChannelMap([indirectMsgIds], [timeMsgIdValues]);

      expect(map.get('CFE_MISSION_TIME_DATA_CMD')).toBe(Channel.GLOBAL_CMD);
      expect(map.get('CFE_MISSION_TIME_SEND_CMD')).toBe(Channel.GLOBAL_CMD);
    });

    it('classifies TIME TLM topics as PLATFORM_TLM', () => {
      const map = buildChannelMap([indirectMsgIds], [timeMsgIdValues]);

      expect(map.get('CFE_MISSION_TIME_HK_TLM')).toBe(Channel.PLATFORM_TLM);
      expect(map.get('CFE_MISSION_TIME_DIAG_TLM')).toBe(Channel.PLATFORM_TLM);
    });

    it('resolves all topics when both msgid_values files are provided', () => {
      const map = buildChannelMap(
        [indirectMsgIds],
        [appMsgIdValues, timeMsgIdValues],
      );
      expect(map.size).toBe(9);
    });
  });

  describe('combined Pattern A + Pattern B', () => {
    it('merges direct and indirect classifications', () => {
      const directContent = readFixture('mock_app_msgids.h');
      const indirectContent = readFixture('mock_indirect_msgids.h');
      const appVals = readFixture('mock_app_msgid_values.h');
      const timeVals = readFixture('mock_time_msgid_values.h');

      const map = buildChannelMap(
        [directContent, indirectContent],
        [appVals, timeVals],
      );

      expect(map.get('TO_LAB_MISSION_CMD')).toBe(Channel.PLATFORM_CMD);
      expect(map.get('SAMPLE_APP_MISSION_CMD')).toBe(Channel.PLATFORM_CMD);
      expect(map.get('CFE_MISSION_TIME_DATA_CMD')).toBe(Channel.GLOBAL_CMD);
      expect(map.get('CFE_MISSION_TIME_HK_TLM')).toBe(Channel.PLATFORM_TLM);
    });
  });

  it('returns empty map when given empty inputs', () => {
    const map = buildChannelMap([], []);
    expect(map.size).toBe(0);
  });

  it('skips MIDVAL invocation when template is not in registry', () => {
    const msgIdContent = '#define SOME_MID UNKNOWN_MIDVAL(CMD)\n';
    const map = buildChannelMap([msgIdContent], []);

    expect(map.size).toBe(0);
  });

  it('classifies GLOBAL_TLM via direct pattern', () => {
    const content =
      '#define GLB_TLM_MID CFE_GLOBAL_TLM_TOPICID_TO_MIDV(GLB_TEST_TLM_TOPICID)\n';
    const map = buildChannelMap([content], []);

    expect(map.get('GLB_TEST_TLM')).toBe(Channel.GLOBAL_TLM);
  });

  it('does not overwrite Pattern A classification with Pattern B', () => {
    const directContent =
      '#define TEST_MID CFE_PLATFORM_CMD_TOPICID_TO_MIDV(TEST_TOPIC_TOPICID)\n';
    const midvalTemplate =
      '#define TEST_MIDVAL(x) CFE_PLATFORM_TLM_TOPICID_TO_MIDV(TEST_##x##_TOPICID)\n';
    const midvalInvoke =
      '#define TEST_OTHER_MID TEST_MIDVAL(TOPIC)\n';

    const map = buildChannelMap(
      [directContent + midvalInvoke],
      [midvalTemplate],
    );

    expect(map.get('TEST_TOPIC')).toBe(Channel.PLATFORM_CMD);
    expect(map.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// classifyByHeuristic -- Tier 2
// ---------------------------------------------------------------------------
describe('classifyByHeuristic', () => {
  it('classifies _TLM names as PLATFORM_TLM', () => {
    expect(classifyByHeuristic('CFE_MISSION_ES_HK_TLM')).toBe(Channel.PLATFORM_TLM);
    expect(classifyByHeuristic('SAMPLE_APP_MISSION_HK_TLM')).toBe(Channel.PLATFORM_TLM);
    expect(classifyByHeuristic('CFE_MISSION_ES_MEMSTATS_TLM')).toBe(Channel.PLATFORM_TLM);
  });

  it('classifies _MSG names as PLATFORM_TLM', () => {
    expect(classifyByHeuristic('CFE_MISSION_EVS_LONG_EVENT_MSG')).toBe(Channel.PLATFORM_TLM);
    expect(classifyByHeuristic('CFE_MISSION_EVS_SHORT_EVENT_MSG')).toBe(Channel.PLATFORM_TLM);
  });

  it('classifies _DATA_TYPES as PLATFORM_TLM', () => {
    expect(classifyByHeuristic('TO_LAB_MISSION_DATA_TYPES')).toBe(Channel.PLATFORM_TLM);
  });

  it('classifies CMD names as PLATFORM_CMD', () => {
    expect(classifyByHeuristic('CFE_MISSION_ES_CMD')).toBe(Channel.PLATFORM_CMD);
    expect(classifyByHeuristic('SAMPLE_APP_MISSION_CMD')).toBe(Channel.PLATFORM_CMD);
  });

  it('classifies SEND_HK names as PLATFORM_CMD', () => {
    expect(classifyByHeuristic('CFE_MISSION_ES_SEND_HK')).toBe(Channel.PLATFORM_CMD);
    expect(classifyByHeuristic('TO_LAB_MISSION_SEND_HK')).toBe(Channel.PLATFORM_CMD);
  });

  it('defaults ambiguous names to PLATFORM_CMD', () => {
    expect(classifyByHeuristic('CFE_MISSION_SB_SUB_RPT_CTRL')).toBe(Channel.PLATFORM_CMD);
  });
});

// ---------------------------------------------------------------------------
// resolveTopicIds -- MsgID computation
// ---------------------------------------------------------------------------
describe('resolveTopicIds', () => {
  const bases: BaseAddresses = {
    [Channel.PLATFORM_CMD]: 0x1800,
    [Channel.PLATFORM_TLM]: 0x0800,
    [Channel.GLOBAL_CMD]: 0x1860,
    [Channel.GLOBAL_TLM]: 0x0860,
  };

  function makeEntry(name: string, value: number): TopicIdEntry {
    return { name, value, rawValue: `0x${value.toString(16)}`, filePath: '/test.h', line: 1 };
  }

  it('computes PLATFORM_CMD MsgID correctly', () => {
    const channelMap = new Map([['TEST_CMD', Channel.PLATFORM_CMD]]);
    const result = resolveTopicIds([makeEntry('TEST_CMD', 0x82)], channelMap, bases);

    expect(result[0].msgId).toBe(0x1800 | 0x82);
    expect(result[0].msgId).toBe(0x1882);
    expect(result[0].channel).toBe(Channel.PLATFORM_CMD);
    expect(result[0].classifiedBy).toBe(ClassificationMethod.MSGID_HEADER);
  });

  it('computes PLATFORM_TLM MsgID correctly', () => {
    const channelMap = new Map([['TEST_HK_TLM', Channel.PLATFORM_TLM]]);
    const result = resolveTopicIds([makeEntry('TEST_HK_TLM', 0x83)], channelMap, bases);

    expect(result[0].msgId).toBe(0x0800 | 0x83);
    expect(result[0].msgId).toBe(0x0883);
    expect(result[0].channel).toBe(Channel.PLATFORM_TLM);
  });

  it('computes GLOBAL_CMD MsgID correctly', () => {
    const channelMap = new Map([['TIME_DATA_CMD', Channel.GLOBAL_CMD]]);
    const result = resolveTopicIds([makeEntry('TIME_DATA_CMD', 0)], channelMap, bases);

    expect(result[0].msgId).toBe(0x1860 | 0);
    expect(result[0].msgId).toBe(0x1860);
    expect(result[0].channel).toBe(Channel.GLOBAL_CMD);
  });

  it('computes GLOBAL_TLM MsgID correctly', () => {
    const channelMap = new Map([['GLB_TLM_TEST', Channel.GLOBAL_TLM]]);
    const result = resolveTopicIds([makeEntry('GLB_TLM_TEST', 5)], channelMap, bases);

    expect(result[0].msgId).toBe(0x0860 | 5);
    expect(result[0].msgId).toBe(0x0865);
  });

  it('falls back to heuristic when topic not in channel map', () => {
    const channelMap = new Map<string, Channel>();
    const result = resolveTopicIds(
      [makeEntry('UNKNOWN_APP_MISSION_HK_TLM', 0x50)],
      channelMap,
      bases,
    );

    expect(result[0].channel).toBe(Channel.PLATFORM_TLM);
    expect(result[0].classifiedBy).toBe(ClassificationMethod.HEURISTIC);
    expect(result[0].msgId).toBe(0x0800 | 0x50);
  });

  it('heuristic defaults CMD-like names to PLATFORM_CMD', () => {
    const channelMap = new Map<string, Channel>();
    const result = resolveTopicIds(
      [makeEntry('UNKNOWN_APP_MISSION_CMD', 0x90)],
      channelMap,
      bases,
    );

    expect(result[0].channel).toBe(Channel.PLATFORM_CMD);
    expect(result[0].classifiedBy).toBe(ClassificationMethod.HEURISTIC);
  });

  it('preserves the original TopicIdEntry reference', () => {
    const entry = makeEntry('FOO_CMD', 1);
    const result = resolveTopicIds([entry], new Map(), bases);
    expect(result[0].entry).toBe(entry);
  });
});

// ---------------------------------------------------------------------------
// resolve -- Full pipeline
// ---------------------------------------------------------------------------
describe('resolve (full pipeline)', () => {
  it('resolves mock fixtures with correct channels and MsgIDs', () => {
    const topicEntries = [
      ...parseFileContent(readFixture('app_style_topicids.h'), path.join(FIXTURES, 'app_style_topicids.h')),
      ...parseFileContent(readFixture('global_style_topicids.h'), path.join(FIXTURES, 'global_style_topicids.h')),
    ];

    const result = resolve(
      topicEntries,
      [path.join(FIXTURES, 'mock_indirect_msgids.h')],
      [
        path.join(FIXTURES, 'mock_app_msgid_values.h'),
        path.join(FIXTURES, 'mock_time_msgid_values.h'),
      ],
      path.join(FIXTURES, 'default_cfe_core_api_msgid_mapping.h'),
    );

    expect(result).toHaveLength(9);

    const byName = new Map(result.map(r => [r.entry.name, r]));

    // SAMPLE_APP via Pattern B -> PLATFORM_CMD
    expect(byName.get('SAMPLE_APP_MISSION_CMD')?.channel).toBe(Channel.PLATFORM_CMD);
    expect(byName.get('SAMPLE_APP_MISSION_CMD')?.msgId).toBe(0x1800 | 0x82);
    expect(byName.get('SAMPLE_APP_MISSION_CMD')?.classifiedBy).toBe(ClassificationMethod.MSGID_HEADER);

    // SAMPLE_APP TLM via Pattern B -> PLATFORM_TLM
    expect(byName.get('SAMPLE_APP_MISSION_HK_TLM')?.channel).toBe(Channel.PLATFORM_TLM);
    expect(byName.get('SAMPLE_APP_MISSION_HK_TLM')?.msgId).toBe(0x0800 | 0x83);

    // TIME CMD via Pattern B -> PLATFORM_CMD
    expect(byName.get('CFE_MISSION_TIME_CMD')?.channel).toBe(Channel.PLATFORM_CMD);
    expect(byName.get('CFE_MISSION_TIME_CMD')?.msgId).toBe(0x1800 | 5);

    // TIME GLOBAL_CMD via Pattern B -> GLOBAL_CMD
    expect(byName.get('CFE_MISSION_TIME_DATA_CMD')?.channel).toBe(Channel.GLOBAL_CMD);
    expect(byName.get('CFE_MISSION_TIME_DATA_CMD')?.msgId).toBe(0x1860 | 0);
    expect(byName.get('CFE_MISSION_TIME_DATA_CMD')?.classifiedBy).toBe(ClassificationMethod.MSGID_HEADER);

    expect(byName.get('CFE_MISSION_TIME_SEND_CMD')?.channel).toBe(Channel.GLOBAL_CMD);
    expect(byName.get('CFE_MISSION_TIME_SEND_CMD')?.msgId).toBe(0x1860 | 2);

    // TIME TLM via Pattern B -> PLATFORM_TLM
    expect(byName.get('CFE_MISSION_TIME_HK_TLM')?.channel).toBe(Channel.PLATFORM_TLM);
    expect(byName.get('CFE_MISSION_TIME_HK_TLM')?.msgId).toBe(0x0800 | 5);
  });

  it('uses base overrides when provided', () => {
    const entries = parseFileContent(
      readFixture('app_style_topicids.h'),
      path.join(FIXTURES, 'app_style_topicids.h'),
    );

    const result = resolve(
      entries,
      [path.join(FIXTURES, 'mock_indirect_msgids.h')],
      [path.join(FIXTURES, 'mock_app_msgid_values.h')],
      null,
      { [Channel.PLATFORM_CMD]: 0x2000 },
    );

    const cmd = result.find(r => r.entry.name === 'SAMPLE_APP_MISSION_CMD');
    expect(cmd?.msgId).toBe(0x2000 | 0x82);
  });

  it('works with no msgid files (pure heuristic mode)', () => {
    const entries = parseFileContent(
      readFixture('app_style_topicids.h'),
      path.join(FIXTURES, 'app_style_topicids.h'),
    );

    const result = resolve(entries, [], [], null);

    expect(result).toHaveLength(3);
    const byName = new Map(result.map(r => [r.entry.name, r]));

    expect(byName.get('SAMPLE_APP_MISSION_CMD')?.channel).toBe(Channel.PLATFORM_CMD);
    expect(byName.get('SAMPLE_APP_MISSION_CMD')?.classifiedBy).toBe(ClassificationMethod.HEURISTIC);
    expect(byName.get('SAMPLE_APP_MISSION_HK_TLM')?.channel).toBe(Channel.PLATFORM_TLM);
    expect(byName.get('SAMPLE_APP_MISSION_HK_TLM')?.classifiedBy).toBe(ClassificationMethod.HEURISTIC);
  });
});

// ---------------------------------------------------------------------------
// Integration: real cFS Draco headers
// ---------------------------------------------------------------------------
describe('resolve against real cFS headers', () => {
  const REAL_TOPICID_FILES = [
    'cfe_es_topicids.h', 'cfe_evs_topicids.h', 'cfe_sb_topicids.h',
    'cfe_tbl_topicids.h', 'cfe_time_topicids.h', 'cfe_test_topicids.h',
    'sample_app_topicids.h', 'ci_lab_topicids.h', 'to_lab_topicids.h',
  ];

  let allEntries: TopicIdEntry[];

  beforeAll(() => {
    const filePaths = REAL_TOPICID_FILES.map(f => path.join(REAL_FIXTURES, f));
    const parseResult = parseFiles(filePaths);
    allEntries = parseResult.files.flatMap(f => f.entries);
  });

  it('resolves all 42 entries', () => {
    const result = resolve(
      allEntries,
      [path.join(FIXTURES, 'mock_app_msgids.h'), path.join(FIXTURES, 'mock_indirect_msgids.h')],
      [path.join(FIXTURES, 'mock_app_msgid_values.h'), path.join(FIXTURES, 'mock_time_msgid_values.h')],
      path.join(FIXTURES, 'default_cfe_core_api_msgid_mapping.h'),
    );

    expect(result).toHaveLength(42);
  });

  it('TIME DATA_CMD resolves to GLOBAL_CMD channel', () => {
    const result = resolve(
      allEntries,
      [path.join(FIXTURES, 'mock_indirect_msgids.h')],
      [path.join(FIXTURES, 'mock_time_msgid_values.h')],
      path.join(FIXTURES, 'default_cfe_core_api_msgid_mapping.h'),
    );

    const dataCmd = result.find(r => r.entry.name === 'CFE_MISSION_TIME_DATA_CMD');
    expect(dataCmd?.channel).toBe(Channel.GLOBAL_CMD);
    expect(dataCmd?.msgId).toBe(0x1860);
  });

  it('TIME SEND_CMD resolves to GLOBAL_CMD channel', () => {
    const result = resolve(
      allEntries,
      [path.join(FIXTURES, 'mock_indirect_msgids.h')],
      [path.join(FIXTURES, 'mock_time_msgid_values.h')],
      path.join(FIXTURES, 'default_cfe_core_api_msgid_mapping.h'),
    );

    const sendCmd = result.find(r => r.entry.name === 'CFE_MISSION_TIME_SEND_CMD');
    expect(sendCmd?.channel).toBe(Channel.GLOBAL_CMD);
    expect(sendCmd?.msgId).toBe(0x1862);
  });

  it('all resolved MsgIDs are non-negative', () => {
    const result = resolve(allEntries, [], [], null);
    for (const r of result) {
      expect(r.msgId).toBeGreaterThanOrEqual(0);
    }
  });

  it('all entries have a valid channel', () => {
    const result = resolve(allEntries, [], [], null);
    const validChannels = new Set(Object.values(Channel));
    for (const r of result) {
      expect(validChannels.has(r.channel)).toBe(true);
    }
  });
});
