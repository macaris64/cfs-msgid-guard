import * as fs from 'fs';
import * as path from 'path';
import { parseFileContent, parseFile, parseFiles, parseNumericValue } from '../src/parser';
import { TopicIdEntry } from '../src/types';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

describe('parseNumericValue', () => {
  it('parses decimal integers', () => {
    expect(parseNumericValue('0')).toBe(0);
    expect(parseNumericValue('6')).toBe(6);
    expect(parseNumericValue('16')).toBe(16);
    expect(parseNumericValue('256')).toBe(256);
  });

  it('parses hex integers (0x prefix)', () => {
    expect(parseNumericValue('0x80')).toBe(128);
    expect(parseNumericValue('0x82')).toBe(130);
    expect(parseNumericValue('0xFF')).toBe(255);
    expect(parseNumericValue('0x0100')).toBe(256);
    expect(parseNumericValue('0x1800')).toBe(6144);
  });

  it('handles uppercase hex prefix', () => {
    expect(parseNumericValue('0X82')).toBe(130);
    expect(parseNumericValue('0XFF')).toBe(255);
  });

  it('handles mixed-case hex digits', () => {
    expect(parseNumericValue('0xAb')).toBe(171);
    expect(parseNumericValue('0xCd')).toBe(205);
  });
});

describe('parseFileContent', () => {
  describe('Fixture 1: cFE-core style (decimal)', () => {
    it('extracts all 5 topic IDs with correct values', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'cfe_style_topicids.h'), 'utf-8'),
        '/mock/cfe_style_topicids.h'
      );

      expect(result).toHaveLength(5);

      const byName = new Map(result.map(e => [e.name, e]));

      expect(byName.get('CFE_MISSION_ES_CMD')?.value).toBe(6);
      expect(byName.get('CFE_MISSION_ES_CMD')?.rawValue).toBe('6');

      expect(byName.get('CFE_MISSION_ES_SEND_HK')?.value).toBe(8);
      expect(byName.get('CFE_MISSION_ES_HK_TLM')?.value).toBe(0);
      expect(byName.get('CFE_MISSION_ES_APP_TLM')?.value).toBe(11);
      expect(byName.get('CFE_MISSION_ES_MEMSTATS_TLM')?.value).toBe(16);
    });

    it('assigns correct file path to all entries', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'cfe_style_topicids.h'), 'utf-8'),
        '/mock/path.h'
      );
      result.forEach(entry => {
        expect(entry.filePath).toBe('/mock/path.h');
      });
    });

    it('computes correct 1-based line numbers', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'cfe_style_topicids.h'), 'utf-8'),
        '/mock/cfe_style_topicids.h'
      );

      const byName = new Map(result.map(e => [e.name, e]));
      expect(byName.get('CFE_MISSION_ES_CMD')?.line).toBe(14);
      expect(byName.get('CFE_MISSION_ES_SEND_HK')?.line).toBe(16);
    });
  });

  describe('Fixture 2: App style (hex)', () => {
    it('extracts 3 topic IDs with hex values', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'app_style_topicids.h'), 'utf-8'),
        '/mock/app_style_topicids.h'
      );

      expect(result).toHaveLength(3);

      const byName = new Map(result.map(e => [e.name, e]));

      expect(byName.get('SAMPLE_APP_MISSION_CMD')?.value).toBe(0x82);
      expect(byName.get('SAMPLE_APP_MISSION_CMD')?.rawValue).toBe('0x82');

      expect(byName.get('SAMPLE_APP_MISSION_SEND_HK')?.value).toBe(0x83);
      expect(byName.get('SAMPLE_APP_MISSION_HK_TLM')?.value).toBe(0x83);
    });
  });

  describe('Fixture 3: Collision pair', () => {
    it('extracts entries from App A', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'collision_app_a_topicids.h'), 'utf-8'),
        '/mock/collision_app_a_topicids.h'
      );

      expect(result).toHaveLength(3);
      const cmd = result.find(e => e.name === 'APP_A_MISSION_CMD');
      expect(cmd?.value).toBe(0x82);
    });

    it('extracts entries from App B with same CMD topic ID', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'collision_app_b_topicids.h'), 'utf-8'),
        '/mock/collision_app_b_topicids.h'
      );

      expect(result).toHaveLength(3);
      const cmd = result.find(e => e.name === 'APP_B_MISSION_CMD');
      expect(cmd?.value).toBe(0x82);
    });

    it('collision pair yields matching CMD topic ID values', () => {
      const a = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'collision_app_a_topicids.h'), 'utf-8'),
        'a.h'
      );
      const b = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'collision_app_b_topicids.h'), 'utf-8'),
        'b.h'
      );

      const aCmdVal = a.find(e => e.name === 'APP_A_MISSION_CMD')!.value;
      const bCmdVal = b.find(e => e.name === 'APP_B_MISSION_CMD')!.value;
      expect(aCmdVal).toBe(bCmdVal);
    });
  });

  describe('Fixture 4: Global channel style (TIME-like)', () => {
    it('extracts all 6 topic IDs including global commands', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'global_style_topicids.h'), 'utf-8'),
        '/mock/global_style_topicids.h'
      );

      expect(result).toHaveLength(6);

      const byName = new Map(result.map(e => [e.name, e]));

      expect(byName.get('CFE_MISSION_TIME_CMD')?.value).toBe(5);
      expect(byName.get('CFE_MISSION_TIME_SEND_HK')?.value).toBe(13);
      expect(byName.get('CFE_MISSION_TIME_DATA_CMD')?.value).toBe(0);
      expect(byName.get('CFE_MISSION_TIME_SEND_CMD')?.value).toBe(2);
      expect(byName.get('CFE_MISSION_TIME_HK_TLM')?.value).toBe(5);
      expect(byName.get('CFE_MISSION_TIME_DIAG_TLM')?.value).toBe(6);
    });
  });

  describe('Fixture 5: Edge cases', () => {
    let result: TopicIdEntry[];

    beforeAll(() => {
      result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'edge_cases_topicids.h'), 'utf-8'),
        '/mock/edge_cases_topicids.h'
      );
    });

    it('extracts only valid DEFAULT_*_TOPICID defines', () => {
      const names = result.map(e => e.name);
      expect(names).toContain('EDGE_MISSION_ZERO');
      expect(names).toContain('EDGE_MISSION_MAXBYTE');
      expect(names).toContain('EDGE_MISSION_LARGE');
      expect(names).toContain('EDGE_MISSION_UPPER_HEX');
      expect(names).toContain('EDGE_MISSION_MIXED_HEX');
      expect(names).toContain('EDGE_MISSION_IFDEF');
      expect(names).toContain('EDGE_MISSION_WIDE');
    });

    it('extracts exactly 7 valid entries', () => {
      expect(result).toHaveLength(7);
    });

    it('ignores commented-out defines', () => {
      const names = result.map(e => e.name);
      expect(names).not.toContain('EDGE_MISSION_COMMENTED');
      expect(names).not.toContain('EDGE_MISSION_LINECOMMENT');
    });

    it('ignores non-TOPICID defines', () => {
      const names = result.map(e => e.name);
      expect(names).not.toContain('EDGE_MISSION_PERFID');
    });

    it('ignores defines without DEFAULT_ prefix', () => {
      const names = result.map(e => e.name);
      expect(names).not.toContain('EDGE_MISSION_NOPFX');
    });

    it('ignores expression values', () => {
      const names = result.map(e => e.name);
      expect(names).not.toContain('EDGE_MISSION_EXPR');
    });

    it('ignores string values', () => {
      const names = result.map(e => e.name);
      expect(names).not.toContain('EDGE_MISSION_STR');
    });

    it('parses zero value correctly', () => {
      expect(result.find(e => e.name === 'EDGE_MISSION_ZERO')?.value).toBe(0);
    });

    it('parses 0xFF correctly', () => {
      expect(result.find(e => e.name === 'EDGE_MISSION_MAXBYTE')?.value).toBe(255);
    });

    it('parses 0x0100 correctly', () => {
      expect(result.find(e => e.name === 'EDGE_MISSION_LARGE')?.value).toBe(256);
    });

    it('handles extreme whitespace alignment', () => {
      expect(result.find(e => e.name === 'EDGE_MISSION_WIDE')?.value).toBe(77);
    });

    it('extracts defines inside #ifdef blocks', () => {
      expect(result.find(e => e.name === 'EDGE_MISSION_IFDEF')?.value).toBe(0x42);
    });
  });

  describe('Empty file', () => {
    it('returns empty array for header with no topic IDs', () => {
      const result = parseFileContent(
        fs.readFileSync(path.join(FIXTURES, 'empty_topicids.h'), 'utf-8'),
        '/mock/empty_topicids.h'
      );
      expect(result).toHaveLength(0);
    });

    it('returns empty array for empty string', () => {
      expect(parseFileContent('', '/mock/empty.h')).toHaveLength(0);
    });
  });
});

describe('parseFile', () => {
  it('reads and parses a file from disk', () => {
    const result = parseFile(path.join(FIXTURES, 'app_style_topicids.h'));
    expect(result.entries).toHaveLength(3);
    expect(result.filePath).toContain('app_style_topicids.h');
  });

  it('throws for non-existent file', () => {
    expect(() => parseFile('/nonexistent/path.h')).toThrow();
  });
});

describe('parseFiles', () => {
  it('aggregates results from multiple files', () => {
    const files = [
      path.join(FIXTURES, 'cfe_style_topicids.h'),
      path.join(FIXTURES, 'app_style_topicids.h'),
    ];
    const result = parseFiles(files);

    expect(result.files).toHaveLength(2);
    expect(result.totalEntries).toBe(8); // 5 + 3
  });

  it('returns zero entries for empty file list', () => {
    const result = parseFiles([]);
    expect(result.files).toHaveLength(0);
    expect(result.totalEntries).toBe(0);
  });
});

describe('Fixture 6: Real cFS Draco headers', () => {
  const REAL_FILES = [
    { name: 'cfe_es_topicids.h', expectedCount: 5 },
    { name: 'cfe_evs_topicids.h', expectedCount: 5 },
    { name: 'cfe_sb_topicids.h', expectedCount: 7 },
    { name: 'cfe_tbl_topicids.h', expectedCount: 4 },
    { name: 'cfe_time_topicids.h', expectedCount: 8 },
    { name: 'cfe_test_topicids.h', expectedCount: 2 },
    { name: 'sample_app_topicids.h', expectedCount: 3 },
    { name: 'ci_lab_topicids.h', expectedCount: 4 },
    { name: 'to_lab_topicids.h', expectedCount: 4 },
  ];

  it.each(REAL_FILES)(
    'extracts $expectedCount entries from $name',
    ({ name, expectedCount }) => {
      const result = parseFile(path.join(REAL_FIXTURES, name));
      expect(result.entries).toHaveLength(expectedCount);
    }
  );

  it('extracts exactly 42 total entries across all 9 real headers', () => {
    const allFiles = REAL_FILES.map(f => path.join(REAL_FIXTURES, f.name));
    const result = parseFiles(allFiles);
    expect(result.totalEntries).toBe(42);
    expect(result.files).toHaveLength(9);
  });

  it('all entry names are unique across the entire bundle', () => {
    const allFiles = REAL_FILES.map(f => path.join(REAL_FIXTURES, f.name));
    const result = parseFiles(allFiles);
    const allNames = result.files.flatMap(f => f.entries.map(e => e.name));
    const uniqueNames = new Set(allNames);
    expect(uniqueNames.size).toBe(allNames.length);
  });

  describe('spot-checks known values from feasibility report', () => {
    let allEntries: TopicIdEntry[];

    beforeAll(() => {
      const allFiles = REAL_FILES.map(f => path.join(REAL_FIXTURES, f.name));
      const result = parseFiles(allFiles);
      allEntries = result.files.flatMap(f => f.entries);
    });

    it('CFE_MISSION_ES_CMD = 6 (decimal)', () => {
      const e = allEntries.find(e => e.name === 'CFE_MISSION_ES_CMD');
      expect(e?.value).toBe(6);
      expect(e?.rawValue).toBe('6');
    });

    it('CFE_MISSION_ES_HK_TLM = 0 (zero edge case)', () => {
      const e = allEntries.find(e => e.name === 'CFE_MISSION_ES_HK_TLM');
      expect(e?.value).toBe(0);
    });

    it('SAMPLE_APP_MISSION_CMD = 0x82 (hex)', () => {
      const e = allEntries.find(e => e.name === 'SAMPLE_APP_MISSION_CMD');
      expect(e?.value).toBe(0x82);
      expect(e?.rawValue).toBe('0x82');
    });

    it('TO_LAB_MISSION_CMD = 0x80 (hex)', () => {
      const e = allEntries.find(e => e.name === 'TO_LAB_MISSION_CMD');
      expect(e?.value).toBe(0x80);
    });

    it('CFE_MISSION_TIME_DATA_CMD = 0 (global command, zero value)', () => {
      const e = allEntries.find(e => e.name === 'CFE_MISSION_TIME_DATA_CMD');
      expect(e?.value).toBe(0);
    });

    it('CFE_MISSION_SB_SUB_RPT_CTRL = 14 (underscore-heavy name)', () => {
      const e = allEntries.find(e => e.name === 'CFE_MISSION_SB_SUB_RPT_CTRL');
      expect(e?.value).toBe(14);
    });

    it('CFE_MISSION_ES_MEMSTATS_TLM = 16 (largest cFE core decimal)', () => {
      const e = allEntries.find(e => e.name === 'CFE_MISSION_ES_MEMSTATS_TLM');
      expect(e?.value).toBe(16);
    });

    it('CI_LAB_MISSION_READ_UPLINK = 0x86 (largest app hex)', () => {
      const e = allEntries.find(e => e.name === 'CI_LAB_MISSION_READ_UPLINK');
      expect(e?.value).toBe(0x86);
    });
  });
});
