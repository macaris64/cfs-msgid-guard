/**
 * End-to-end integration tests for cfs-msgid-guard.
 *
 * Exercises the full pipeline: scanFiles -> parseFiles -> resolve -> detect -> reporter
 * against the real NASA cFS Draco header fixtures and a synthetic collision scenario.
 */
import * as path from 'path';
import * as fs from 'fs';
import { scanFiles } from '../src/scanner';
import { parseFiles, parseFileContent } from '../src/parser';
import { resolve, extractBaseAddresses } from '../src/resolver';
import { detect } from '../src/detector';
import {
  generateJobSummary,
  generateJsonArtifact,
  emitAnnotations,
  extractAppName,
} from '../src/reporter';
import { run } from '../src/index';
import { Channel, BaseAddresses, DetectionResult } from '../src/types';

jest.mock('@actions/core', () => ({
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined),
  },
}));

import * as core from '@actions/core';

const FIXTURES = path.resolve(__dirname, 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

const DEFAULT_BASES: BaseAddresses = {
  [Channel.PLATFORM_CMD]: 0x1800,
  [Channel.PLATFORM_TLM]: 0x0800,
  [Channel.GLOBAL_CMD]: 0x1860,
  [Channel.GLOBAL_TLM]: 0x0860,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// E2E: Default NASA bundle — full pipeline produces 0 collisions
// ---------------------------------------------------------------------------
describe('E2E: Default NASA cFS Draco bundle', () => {
  let detectionResult: DetectionResult;
  let basesUsed: BaseAddresses;

  beforeAll(async () => {
    const scanResult = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    // Parse only the 9 real cFS topicid headers (skip mock fixtures)
    const realTopicIdFiles = scanResult.topicIdFiles.filter(f =>
      f.includes('/real/'),
    );
    expect(realTopicIdFiles).toHaveLength(9);

    const parseResult = parseFiles(realTopicIdFiles);
    const allEntries = parseResult.files.flatMap(f => f.entries);

    basesUsed = extractBaseAddresses(
      scanResult.baseMappingFile
        ? fs.readFileSync(scanResult.baseMappingFile, 'utf-8')
        : null,
    );

    const resolved = resolve(
      allEntries,
      scanResult.msgIdFiles,
      scanResult.msgIdValueFiles,
      scanResult.baseMappingFile,
    );

    detectionResult = detect(resolved, 0);
  });

  it('finds exactly 42 topic ID definitions', () => {
    expect(detectionResult.resolved).toHaveLength(42);
  });

  it('produces 0 collisions', () => {
    expect(detectionResult.collisions).toHaveLength(0);
  });

  it('resolves all 4 channels correctly', () => {
    const channels = new Set(detectionResult.resolved.map(r => r.channel));
    expect(channels).toContain(Channel.PLATFORM_CMD);
    expect(channels).toContain(Channel.PLATFORM_TLM);
    expect(channels).toContain(Channel.GLOBAL_CMD);
  });

  it('resolves TIME DATA_CMD and SEND_CMD to GLOBAL_CMD channel', () => {
    const byName = new Map(
      detectionResult.resolved.map(r => [r.entry.name, r]),
    );

    const dataCmd = byName.get('CFE_MISSION_TIME_DATA_CMD');
    expect(dataCmd).toBeDefined();
    expect(dataCmd!.channel).toBe(Channel.GLOBAL_CMD);
    expect(dataCmd!.msgId).toBe(0x1860);

    const sendCmd = byName.get('CFE_MISSION_TIME_SEND_CMD');
    expect(sendCmd).toBeDefined();
    expect(sendCmd!.channel).toBe(Channel.GLOBAL_CMD);
    expect(sendCmd!.msgId).toBe(0x1862);
  });

  it('identifies the correct number of unique apps', () => {
    const apps = new Set(
      detectionResult.resolved.map(r => extractAppName(r.entry)),
    );
    expect(apps.size).toBe(9);
    expect(apps).toContain('CFE_ES');
    expect(apps).toContain('CFE_TIME');
    expect(apps).toContain('SAMPLE_APP');
    expect(apps).toContain('TO_LAB');
    expect(apps).toContain('CI_LAB');
  });

  it('generates a PASS Job Summary', () => {
    const md = generateJobSummary(detectionResult, basesUsed);
    expect(md).toContain('PASS');
    expect(md).toContain('Topic IDs Resolved | 42');
    expect(md).toContain('Collisions Detected | 0');
    expect(md).not.toContain('## Collision Details');
  });

  it('generates a valid JSON artifact with complete data', () => {
    const json = generateJsonArtifact(detectionResult, basesUsed);
    const parsed = JSON.parse(json);

    expect(parsed.summary.totalApps).toBe(9);
    expect(parsed.summary.totalTopics).toBe(42);
    expect(parsed.summary.collisions).toBe(0);
    expect(parsed.allocations).toHaveLength(42);

    const sampleCmd = parsed.allocations.find(
      (a: { topicName: string }) => a.topicName === 'SAMPLE_APP_MISSION_CMD',
    );
    expect(sampleCmd).toBeDefined();
    expect(sampleCmd.app).toBe('SAMPLE_APP');
    expect(sampleCmd.channel).toBe('PLATFORM_CMD');
    expect(sampleCmd.msgId).toBe('0x1882');
  });

  it('emits no annotations for a clean bundle', () => {
    emitAnnotations(detectionResult);
    expect(core.error).not.toHaveBeenCalled();
    expect(core.warning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// E2E: Near-miss detection on default bundle
// ---------------------------------------------------------------------------
describe('E2E: Near-miss detection on default bundle', () => {
  let resultWithGap: DetectionResult;

  beforeAll(async () => {
    const scanResult = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const realTopicIdFiles = scanResult.topicIdFiles.filter(f =>
      f.includes('/real/'),
    );

    const parseResult = parseFiles(realTopicIdFiles);
    const allEntries = parseResult.files.flatMap(f => f.entries);

    const resolved = resolve(
      allEntries,
      scanResult.msgIdFiles,
      scanResult.msgIdValueFiles,
      scanResult.baseMappingFile,
    );

    resultWithGap = detect(resolved, 3);
  });

  it('still produces 0 collisions', () => {
    expect(resultWithGap.collisions).toHaveLength(0);
  });

  it('finds near-misses with gap=3', () => {
    expect(resultWithGap.nearMisses.length).toBeGreaterThan(0);
  });

  it('emits warnings for near-misses but no errors', () => {
    emitAnnotations(resultWithGap);
    expect(core.error).not.toHaveBeenCalled();
    expect(core.warning).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// E2E: Collision scenario — synthetic collision detected and reported
// ---------------------------------------------------------------------------
describe('E2E: Collision scenario (APP_A vs APP_B at 0x82)', () => {
  let detectionResult: DetectionResult;

  beforeAll(() => {
    const entriesA = parseFileContent(
      fs.readFileSync(path.join(FIXTURES, 'collision_app_a_topicids.h'), 'utf-8'),
      path.join(FIXTURES, 'collision_app_a_topicids.h'),
    );
    const entriesB = parseFileContent(
      fs.readFileSync(path.join(FIXTURES, 'collision_app_b_topicids.h'), 'utf-8'),
      path.join(FIXTURES, 'collision_app_b_topicids.h'),
    );

    const resolved = resolve([...entriesA, ...entriesB], [], [], null);
    detectionResult = detect(resolved, 2);
  });

  it('detects at least 1 collision', () => {
    expect(detectionResult.collisions.length).toBeGreaterThanOrEqual(1);
  });

  it('finds the CMD collision at topic ID 0x82', () => {
    const cmdCollision = detectionResult.collisions.find(
      c => c.channel === Channel.PLATFORM_CMD && c.topicIdValue === 0x82,
    );
    expect(cmdCollision).toBeDefined();
    expect(cmdCollision!.entries).toHaveLength(2);

    const apps = cmdCollision!.entries.map(e => extractAppName(e)).sort();
    expect(apps).toEqual(['APP_A', 'APP_B']);
  });

  it('computes the correct colliding MsgID', () => {
    const cmdCollision = detectionResult.collisions.find(
      c => c.topicIdValue === 0x82,
    );
    expect(cmdCollision!.msgId).toBe(0x1882);
  });

  it('generates a FAIL Job Summary', () => {
    const md = generateJobSummary(detectionResult, DEFAULT_BASES);
    expect(md).toContain('FAIL');
    expect(md).toContain('## Collision Details');
    expect(md).toContain('APP_A');
    expect(md).toContain('APP_B');
    expect(md).toContain('**COLLISION**');
  });

  it('generates JSON artifact with collision data', () => {
    const json = generateJsonArtifact(detectionResult, DEFAULT_BASES);
    const parsed = JSON.parse(json);

    expect(parsed.summary.collisions).toBeGreaterThanOrEqual(1);
    expect(parsed.collisions.length).toBeGreaterThanOrEqual(1);

    const c = parsed.collisions.find(
      (x: { topicId: string }) => x.topicId === '0x0082',
    );
    expect(c).toBeDefined();
    expect(c.entries).toHaveLength(2);
  });

  it('emits error annotations on both colliding files', () => {
    emitAnnotations(detectionResult);

    const errorCalls = (core.error as jest.Mock).mock.calls;
    expect(errorCalls.length).toBeGreaterThanOrEqual(2);

    const annotatedFiles = errorCalls.map(
      (call: [string, { file: string }]) => call[1].file,
    );
    expect(annotatedFiles).toContain(
      path.join(FIXTURES, 'collision_app_a_topicids.h'),
    );
    expect(annotatedFiles).toContain(
      path.join(FIXTURES, 'collision_app_b_topicids.h'),
    );
  });

  it('also finds near-misses between adjacent topic IDs', () => {
    expect(detectionResult.nearMisses.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// E2E: run() function (mocked @actions/core inputs)
// ---------------------------------------------------------------------------
describe('E2E: run() function with mocked inputs', () => {
  // run is imported at top-level; jest.mock hoisting ensures mocks apply

  function mockInputs(overrides: Record<string, string> = {}): void {
    const defaults: Record<string, string> = {
      'scan-paths': REAL_FIXTURES,
      'topicid-pattern': '**/*_topicids.h',
      'msgid-pattern': '**/*_msgids.h',
      'cmd-base': '0x1800',
      'tlm-base': '0x0800',
      'global-cmd-base': '0x1860',
      'global-tlm-base': '0x0860',
      'fail-on-collision': 'true',
      'near-miss-gap': '0',
      'report-format': 'both',
      ...overrides,
    };

    (core.getInput as jest.Mock).mockImplementation(
      (name: string) => defaults[name] || '',
    );
  }

  it('completes successfully on clean bundle', async () => {
    mockInputs({
      'scan-paths': FIXTURES,
      'topicid-pattern': '**/real/*_topicids.h',
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith('has-collisions', 'false');
    expect(core.setOutput).toHaveBeenCalledWith('collision-count', '0');
  });

  it('sets allocation-map output as JSON', async () => {
    mockInputs({
      'scan-paths': FIXTURES,
      'topicid-pattern': '**/real/*_topicids.h',
    });

    await run();

    const mapCall = (core.setOutput as jest.Mock).mock.calls.find(
      (c: string[]) => c[0] === 'allocation-map',
    );
    expect(mapCall).toBeDefined();
    expect(() => JSON.parse(mapCall[1])).not.toThrow();
  });

  it('calls setFailed when collisions found and fail-on-collision is true', async () => {
    mockInputs({
      'scan-paths': FIXTURES,
      'topicid-pattern': '**/collision_app_*_topicids.h',
      'fail-on-collision': 'true',
    });

    await run();

    expect(core.setFailed).toHaveBeenCalled();
    const msg = (core.setFailed as jest.Mock).mock.calls[0][0] as string;
    expect(msg).toContain('collision');
  });

  it('does NOT call setFailed when fail-on-collision is false', async () => {
    mockInputs({
      'scan-paths': FIXTURES,
      'topicid-pattern': '**/collision_app_*_topicids.h',
      'fail-on-collision': 'false',
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith('has-collisions', 'true');
  });

  it('warns and exits gracefully when no topicid files found', async () => {
    mockInputs({
      'scan-paths': '/tmp/nonexistent_dir_cfs_test',
    });

    await run();

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('No topic ID header files found'),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('writes Job Summary when report-format is summary', async () => {
    mockInputs({
      'scan-paths': FIXTURES,
      'topicid-pattern': '**/real/*_topicids.h',
      'report-format': 'summary',
    });

    await run();

    expect(core.summary.addRaw).toHaveBeenCalled();
    expect(core.summary.write).toHaveBeenCalled();
  });
});
