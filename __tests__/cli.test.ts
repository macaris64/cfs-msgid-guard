import * as path from 'path';
import {
  parseCliArgs,
  makeColors,
  toHex,
  formatChannelTable,
  runCli,
} from '../src/cli';
import { Channel, ClassificationMethod, ResolvedMsgId, TopicIdEntry } from '../src/types';
import * as scanner from '../src/scanner';

const FIXTURES = path.resolve(__dirname, 'fixtures');

// Silence console output during tests
let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  jest.restoreAllMocks();
});

function allOutput(): string {
  return [
    ...logSpy.mock.calls.map((c: unknown[]) => c.join(' ')),
    ...errorSpy.mock.calls.map((c: unknown[]) => c.join(' ')),
  ].join('\n');
}

function makeEntry(
  name: string,
  value: number,
  filePath = '/test.h',
  line = 1,
): TopicIdEntry {
  return { name, value, rawValue: '0x' + value.toString(16), filePath, line };
}

// ==========================================================================
// parseCliArgs
// ==========================================================================

describe('parseCliArgs', () => {
  it('returns defaults when no flags are provided', () => {
    const opts = parseCliArgs([]);
    expect(opts.scanPath).toBe('.');
    expect(opts.topicIdPattern).toBe('**/*_topicids.h');
    expect(opts.msgIdPattern).toBe('**/*_msgids.h');
    expect(opts.cmdBase).toBe('0x1800');
    expect(opts.tlmBase).toBe('0x0800');
    expect(opts.globalCmdBase).toBe('0x1860');
    expect(opts.globalTlmBase).toBe('0x0860');
    expect(opts.nearMissGap).toBe(0);
    expect(opts.failOnCollision).toBe(true);
    expect(opts.format).toBe('table');
    expect(opts.color).toBe(true);
  });

  it('parses all custom flags', () => {
    const opts = parseCliArgs([
      '--scan-path', '/my/path',
      '--topicid-pattern', '**/foo_*.h',
      '--msgid-pattern', '**/bar_*.h',
      '--cmd-base', '0x2000',
      '--tlm-base', '0x1000',
      '--global-cmd-base', '0x2060',
      '--global-tlm-base', '0x1060',
      '--near-miss-gap', '5',
      '--format', 'json',
    ]);
    expect(opts.scanPath).toBe('/my/path');
    expect(opts.topicIdPattern).toBe('**/foo_*.h');
    expect(opts.msgIdPattern).toBe('**/bar_*.h');
    expect(opts.cmdBase).toBe('0x2000');
    expect(opts.tlmBase).toBe('0x1000');
    expect(opts.globalCmdBase).toBe('0x2060');
    expect(opts.globalTlmBase).toBe('0x1060');
    expect(opts.nearMissGap).toBe(5);
    expect(opts.format).toBe('json');
  });

  it('parses --no-color', () => {
    const opts = parseCliArgs(['--no-color']);
    expect(opts.color).toBe(false);
  });

  it('parses --no-fail-on-collision', () => {
    const opts = parseCliArgs(['--no-fail-on-collision']);
    expect(opts.failOnCollision).toBe(false);
  });

  it('parses --format summary', () => {
    const opts = parseCliArgs(['--format', 'summary']);
    expect(opts.format).toBe('summary');
  });

  it('defaults to table for unknown format values', () => {
    const opts = parseCliArgs(['--format', 'invalid']);
    expect(opts.format).toBe('table');
  });

  it('uses fallback when flag value is missing at end of args', () => {
    const opts = parseCliArgs(['--scan-path']);
    expect(opts.scanPath).toBe('.');
  });
});

// ==========================================================================
// makeColors
// ==========================================================================

describe('makeColors', () => {
  it('returns ANSI codes when enabled', () => {
    const c = makeColors(true);
    expect(c.bold).toBe('\x1b[1m');
    expect(c.red).toBe('\x1b[31m');
    expect(c.reset).toBe('\x1b[0m');
  });

  it('returns empty strings when disabled', () => {
    const c = makeColors(false);
    expect(c.bold).toBe('');
    expect(c.red).toBe('');
    expect(c.reset).toBe('');
    expect(c.dim).toBe('');
    expect(c.green).toBe('');
    expect(c.yellow).toBe('');
    expect(c.cyan).toBe('');
  });
});

// ==========================================================================
// toHex
// ==========================================================================

describe('toHex', () => {
  it('formats a number as 4-digit hex with 0x prefix', () => {
    expect(toHex(0x1800)).toBe('0x1800');
    expect(toHex(0x0082)).toBe('0x0082');
    expect(toHex(0)).toBe('0x0000');
  });

  it('accepts a custom pad width', () => {
    expect(toHex(0xff, 2)).toBe('0xFF');
    expect(toHex(0x1, 8)).toBe('0x00000001');
  });
});

// ==========================================================================
// formatChannelTable
// ==========================================================================

describe('formatChannelTable', () => {
  const noColor = makeColors(false);

  const entries: ResolvedMsgId[] = [
    {
      entry: makeEntry('CFE_MISSION_ES_CMD', 0x04),
      channel: Channel.PLATFORM_CMD,
      classifiedBy: ClassificationMethod.MSGID_HEADER,
      msgId: 0x1804,
    },
    {
      entry: makeEntry('CFE_MISSION_ES_HK_TLM', 0x00),
      channel: Channel.PLATFORM_TLM,
      classifiedBy: ClassificationMethod.HEURISTIC,
      msgId: 0x0800,
    },
  ];

  it('renders a table with entries grouped by channel', () => {
    const table = formatChannelTable(entries, [], noColor);
    expect(table).toContain('Platform Command');
    expect(table).toContain('Platform Telemetry');
    expect(table).toContain('CFE_MISSION_ES_CMD');
    expect(table).toContain('CFE_MISSION_ES_HK_TLM');
    expect(table).toContain('T1');
    expect(table).toContain('T2');
  });

  it('marks collisions with !!', () => {
    const table = formatChannelTable(
      entries,
      [`${Channel.PLATFORM_CMD}:4`],
      noColor,
    );
    expect(table).toContain('!!');
  });

  it('skips channels with no entries', () => {
    const table = formatChannelTable(entries, [], noColor);
    expect(table).not.toContain('Global Command');
    expect(table).not.toContain('Global Telemetry');
  });

  it('sorts entries by topic ID value within each channel', () => {
    const multiEntries: ResolvedMsgId[] = [
      {
        entry: makeEntry('HIGHER_CMD', 0x10),
        channel: Channel.PLATFORM_CMD,
        classifiedBy: ClassificationMethod.HEURISTIC,
        msgId: 0x1810,
      },
      {
        entry: makeEntry('LOWER_CMD', 0x02),
        channel: Channel.PLATFORM_CMD,
        classifiedBy: ClassificationMethod.HEURISTIC,
        msgId: 0x1802,
      },
    ];
    const table = formatChannelTable(multiEntries, [], noColor);
    const lowerIdx = table.indexOf('LOWER_CMD');
    const higherIdx = table.indexOf('HIGHER_CMD');
    expect(lowerIdx).toBeLessThan(higherIdx);
  });

  it('works with ANSI colors enabled', () => {
    const withColor = makeColors(true);
    const table = formatChannelTable(entries, [], withColor);
    expect(table).toContain('\x1b[');
  });
});

// ==========================================================================
// runCli — clean fixture scan
// ==========================================================================

describe('runCli', () => {
  it('returns 0 for clean real NASA fixtures', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('PASS');
    expect(output).toContain('0 collisions');
  });

  // ---------- collisions ---------------------------------------------------

  it('returns 1 for collision fixtures', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/collision_app_*_topicids.h',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(1);
    expect(output).toContain('COLLISION');
    expect(output).toContain('FAIL');
  });

  it('returns 0 for collision fixtures with --no-fail-on-collision', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/collision_app_*_topicids.h',
      '--no-fail-on-collision',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('COLLISION');
  });

  // ---------- output formats -----------------------------------------------

  it('outputs valid JSON with --format json', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
      '--format', 'json',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);

    const jsonMatch = output.match(/\{[\s\S]*"collisions"[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    expect(() => JSON.parse(jsonMatch![0])).not.toThrow();
  });

  it('outputs Markdown with --format summary', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
      '--format', 'summary',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('## ');
  });

  // ---------- near-miss gap ------------------------------------------------

  it('reports near-misses with --near-miss-gap', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
      '--near-miss-gap', '10',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('near-miss');
  });

  // ---------- no topic ID files found --------------------------------------

  it('returns 1 when no topic ID files are found', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/nonexistent_pattern_*.h',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(1);
    expect(output).toContain('No topic ID files found');
  });

  // ---------- custom base addresses ----------------------------------------

  it('uses custom base addresses', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
      '--cmd-base', '0x2000',
      '--tlm-base', '0x1000',
      '--global-cmd-base', '0x2060',
      '--global-tlm-base', '0x1060',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('PASS');
  });

  // ---------- scan error path ----------------------------------------------

  it('returns 2 when scan throws an Error', async () => {
    jest.spyOn(scanner, 'scanFiles').mockRejectedValueOnce(new Error('mock boom'));
    const code = await runCli(['--scan-path', '/fake', '--no-color']);
    const output = allOutput();
    expect(code).toBe(2);
    expect(output).toContain('Scan failed');
    expect(output).toContain('mock boom');
  });

  it('returns 2 when scan throws a non-Error', async () => {
    jest.spyOn(scanner, 'scanFiles').mockRejectedValueOnce('string error');
    const code = await runCli(['--scan-path', '/fake', '--no-color']);
    const output = allOutput();
    expect(code).toBe(2);
    expect(output).toContain('Scan failed');
    expect(output).toContain('string error');
  });

  // ---------- table output with collisions (collision markers) -------------

  it('renders collision markers in table output', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/collision_app_*_topicids.h',
      '--format', 'table',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(1);
    expect(output).toContain('!!');
  });

  // ---------- json output with collisions ----------------------------------

  it('outputs collision details in JSON format', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/collision_app_*_topicids.h',
      '--format', 'json',
      '--no-fail-on-collision',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    const jsonMatch = output.match(/\{[\s\S]*"collisions"[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![0]);
    expect(parsed.collisions.length).toBeGreaterThan(0);
  });

  // ---------- summary output with collisions -------------------------------

  it('outputs collision info in summary format', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/collision_app_*_topicids.h',
      '--format', 'summary',
      '--no-fail-on-collision',
      '--no-color',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('Collision');
  });

  // ---------- no base mapping file -----------------------------------------

  it('works when no base mapping file is found', async () => {
    const realFixtures = path.join(FIXTURES, 'real');
    const topicFiles = [path.join(realFixtures, 'sample_app_topicids.h')];
    jest.spyOn(scanner, 'scanFiles').mockResolvedValueOnce({
      topicIdFiles: topicFiles,
      msgIdFiles: [],
      msgIdValueFiles: [],
      baseMappingFile: null,
    });
    const code = await runCli(['--scan-path', realFixtures, '--no-color']);
    expect(code).toBe(0);
    expect(allOutput()).toContain('PASS');
  });

  // ---------- color output ------------------------------------------------

  it('includes ANSI escape codes when color is enabled', async () => {
    const code = await runCli([
      '--scan-path', FIXTURES,
      '--topicid-pattern', '**/real/*_topicids.h',
    ]);
    const output = allOutput();
    expect(code).toBe(0);
    expect(output).toContain('\x1b[');
  });
});
