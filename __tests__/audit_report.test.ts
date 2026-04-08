/**
 * Tests for the generateAuditReport() function and the --report CLI flag.
 */
import * as fs from 'fs';
import * as path from 'path';
import { generateAuditReport, asciiTable } from '../src/reporter';
import { runCli } from '../src/cli';
import {
  BaseAddresses,
  Channel,
  ClassificationMethod,
  DetectionResult,
  TopicIdEntry,
} from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(name: string, value: number, filePath = '/mock/app_topicids.h', line = 1): TopicIdEntry {
  return { name, value, rawValue: `0x${value.toString(16).toUpperCase()}`, filePath, line };
}

const DEFAULT_BASES: BaseAddresses = {
  [Channel.PLATFORM_CMD]: 0x1800,
  [Channel.PLATFORM_TLM]: 0x0800,
  [Channel.GLOBAL_CMD]: 0x1860,
  [Channel.GLOBAL_TLM]: 0x0860,
};

function mockResult(collisionCount: number, multiWay = false): DetectionResult {
  const entries: TopicIdEntry[] = [];
  const resolved = [];
  const collisions = [];

  for (let i = 0; i < 6; i++) {
    const entry = makeEntry(`APP${i}_MISSION_CMD`, 0x10 + i, `/mock/app${i}_topicids.h`, i + 1);
    entries.push(entry);
    resolved.push({
      entry,
      channel: Channel.PLATFORM_CMD,
      classifiedBy: ClassificationMethod.MSGID_HEADER,
      msgId: 0x1800 | (0x10 + i),
    });
  }

  for (let i = 0; i < 4; i++) {
    const entry = makeEntry(`APP${i}_MISSION_TLM`, 0x20 + i, `/mock/app${i}_topicids.h`, 10 + i);
    entries.push(entry);
    resolved.push({
      entry,
      channel: Channel.PLATFORM_TLM,
      classifiedBy: ClassificationMethod.MSGID_HEADER,
      msgId: 0x0800 | (0x20 + i),
    });
  }

  for (let i = 0; i < collisionCount; i++) {
    const topicIdValue = 0x10 + i;
    const collEntries = [
      makeEntry(`APPA_MISSION_CMD`, topicIdValue, `/mock/appA_topicids.h`, 100 + i),
      makeEntry(`APPB_MISSION_CMD`, topicIdValue, `/mock/appB_topicids.h`, 100 + i),
    ];
    if (multiWay && i === 0) {
      collEntries.push(makeEntry(`APPC_MISSION_CMD`, topicIdValue, `/mock/appC_topicids.h`, 100 + i));
    }
    collisions.push({
      channel: Channel.PLATFORM_CMD,
      topicIdValue,
      msgId: 0x1800 | topicIdValue,
      entries: collEntries,
    });
  }

  return { collisions, nearMisses: [], resolved };
}

// ---------------------------------------------------------------------------
// Unit tests for generateAuditReport
// ---------------------------------------------------------------------------

describe('generateAuditReport', () => {
  it('returns well-formed text with all expected sections', () => {
    const result = mockResult(3);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).toContain('cFS MSGID GUARD — MISSION AUDIT REPORT');
    expect(report).toContain('Scan Path: /test/apps');
    expect(report).toContain('APPLICATION LIST');
    expect(report).toContain('FULL ALLOCATION TABLE');
    expect(report).toContain('EXPECTED COLLISIONS');
    expect(report).toContain('MULTI-WAY COLLISIONS');
    expect(report).toContain('NON-CONFLICTING ENTRIES');
    expect(report).toContain('Verification Command:');
    expect(report).toContain('npx cfs-msgid-guard --scan-path /test/apps');
  });

  it('lists multi-way collisions when entries > 2', () => {
    const result = mockResult(3, true);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).toContain('MULTI-WAY COLLISIONS');
    expect(report).toContain('3 apps involved');
    expect(report).toContain('APPC');
  });

  it('reports "None." for multi-way section when no multi-way collisions', () => {
    const result = mockResult(3, false);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).toMatch(/MULTI-WAY COLLISIONS[\s\S]*?None\./);
  });

  it('reports Expected vs Actual: PASS when counts match', () => {
    const result = mockResult(5);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', 5);

    expect(report).toContain('EXPECTED vs ACTUAL COMPARISON');
    expect(report).toContain('Expected: 5 | Actual: 5 | Match: PASS');
  });

  it('reports Expected vs Actual: FAIL when counts differ', () => {
    const result = mockResult(5);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', 3);

    expect(report).toContain('EXPECTED vs ACTUAL COMPARISON');
    expect(report).toContain('Expected: 3 | Actual: 5 | Match: FAIL');
  });

  it('omits Expected vs Actual section when expectedCount is null', () => {
    const result = mockResult(2);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).not.toContain('EXPECTED vs ACTUAL COMPARISON');
  });

  it('shows "No collisions detected." when zero collisions', () => {
    const result = mockResult(0);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).toContain('No collisions detected.');
  });

  it('marks collision entries with YES !! in the allocation table', () => {
    const result = mockResult(1);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', null);

    expect(report).toContain('YES !!');
  });

  it('contains no ANSI escape codes', () => {
    const result = mockResult(3, true);
    const report = generateAuditReport(result, DEFAULT_BASES, '/test/apps', 3);

    expect(report).not.toMatch(/\x1b\[/);
  });
});

// ---------------------------------------------------------------------------
// asciiTable branch coverage
// ---------------------------------------------------------------------------

describe('asciiTable', () => {
  it('handles rows with fewer columns than headers (undefined cells)', () => {
    const table = asciiTable(['A', 'B', 'C'], [['x'] as any]);
    expect(table).toContain('| x');
    expect(table).toContain('+');
  });

  it('handles explicit undefined/null cell values in a row', () => {
    const table = asciiTable(['A', 'B'], [[undefined as any, 'y']]);
    expect(table).toContain('| y');
  });
});

// ---------------------------------------------------------------------------
// generateAuditReport branch coverage: entries without _MISSION_ in name
// ---------------------------------------------------------------------------

describe('generateAuditReport — non-MISSION entries', () => {
  it('uses app name as prefix when entry name lacks _MISSION_', () => {
    const entry = makeEntry('SIMPLE_CMD', 0x50, '/mock/simple_topicids.h', 1);
    const result: DetectionResult = {
      collisions: [],
      nearMisses: [],
      resolved: [{
        entry,
        channel: Channel.PLATFORM_CMD,
        classifiedBy: ClassificationMethod.HEURISTIC,
        msgId: 0x1850,
      }],
    };
    const report = generateAuditReport(result, DEFAULT_BASES, '/test', null);

    expect(report).toContain('SIMPLE_CMD');
    expect(report).toContain('APPLICATION LIST');
  });
});

// ---------------------------------------------------------------------------
// CLI integration tests
// ---------------------------------------------------------------------------

const REPORT_PATH = path.resolve(__dirname, '..', 'collusion-report.txt');
const APPS_DIR = path.resolve(__dirname, '..', '..', 'apps');

function cleanupReport(): void {
  try { fs.unlinkSync(REPORT_PATH); } catch { /* noop */ }
}

describe('CLI --report integration', () => {
  beforeEach(() => {
    process.chdir(path.resolve(__dirname, '..'));
    cleanupReport();
  });
  afterEach(cleanupReport);

  it('--report writes collusion-report.txt', async () => {
    await runCli([
      '--scan-path', APPS_DIR,
      '--report',
      '--no-fail-on-collision',
      '--no-color',
    ]);

    expect(fs.existsSync(REPORT_PATH)).toBe(true);
    const content = fs.readFileSync(REPORT_PATH, 'utf-8');
    expect(content).toContain('cFS MSGID GUARD — MISSION AUDIT REPORT');
    expect(content).toContain('APPLICATION LIST');
    expect(content).toContain('FULL ALLOCATION TABLE');
  }, 30000);

  it('--report --expected-count includes comparison section', async () => {
    await runCli([
      '--scan-path', APPS_DIR,
      '--report',
      '--expected-count', '20',
      '--no-fail-on-collision',
      '--no-color',
    ]);

    expect(fs.existsSync(REPORT_PATH)).toBe(true);
    const content = fs.readFileSync(REPORT_PATH, 'utf-8');
    expect(content).toContain('EXPECTED vs ACTUAL COMPARISON');
    expect(content).toMatch(/Expected: 20/);
  }, 30000);
});
