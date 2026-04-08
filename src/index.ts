import * as core from '@actions/core';
import { parseNumericValue } from './parser';
import { parseFiles } from './parser';
import { scanFiles } from './scanner';
import { resolve } from './resolver';
import { detect } from './detector';
import {
  emitAnnotations,
  generateJobSummary,
  generateJsonArtifact,
  writeJobSummary,
} from './reporter';
import { BaseAddresses, Channel } from './types';

export async function run(): Promise<void> {
  try {
    // -- Parse inputs -------------------------------------------------------
    const scanPaths = core
      .getInput('scan-paths')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const topicIdPattern = core.getInput('topicid-pattern') || '**/*_topicids.h';
    const msgIdPattern = core.getInput('msgid-pattern') || '**/*_msgids.h';

    const cmdBase = core.getInput('cmd-base');
    const tlmBase = core.getInput('tlm-base');
    const globalCmdBase = core.getInput('global-cmd-base');
    const globalTlmBase = core.getInput('global-tlm-base');

    const baseOverrides: Partial<BaseAddresses> = {};
    if (cmdBase) baseOverrides[Channel.PLATFORM_CMD] = parseNumericValue(cmdBase);
    if (tlmBase) baseOverrides[Channel.PLATFORM_TLM] = parseNumericValue(tlmBase);
    if (globalCmdBase) baseOverrides[Channel.GLOBAL_CMD] = parseNumericValue(globalCmdBase);
    if (globalTlmBase) baseOverrides[Channel.GLOBAL_TLM] = parseNumericValue(globalTlmBase);

    const failOnCollision = core.getInput('fail-on-collision').toLowerCase() !== 'false';
    const nearMissGap = parseInt(core.getInput('near-miss-gap') || '0', 10);
    const reportFormat = core.getInput('report-format') || 'both';

    core.info(`Scanning paths: ${scanPaths.join(', ') || '.'}`);
    core.info(`Topic ID pattern: ${topicIdPattern}`);
    core.info(`Near-miss gap: ${nearMissGap}`);

    // -- Scan ---------------------------------------------------------------
    const scanResult = await scanFiles(scanPaths, topicIdPattern, msgIdPattern);

    core.info(
      `Discovered: ${scanResult.topicIdFiles.length} topic ID files, ` +
        `${scanResult.msgIdFiles.length} msgid files, ` +
        `${scanResult.msgIdValueFiles.length} msgid_values files`,
    );

    if (scanResult.topicIdFiles.length === 0) {
      core.warning('No topic ID header files found. Check scan-paths and topicid-pattern inputs.');
      core.setOutput('collision-count', '0');
      core.setOutput('has-collisions', 'false');
      core.setOutput('allocation-map', '{}');
      return;
    }

    // -- Parse --------------------------------------------------------------
    const parseResult = parseFiles(scanResult.topicIdFiles);
    const allEntries = parseResult.files.flatMap(f => f.entries);
    core.info(`Parsed ${allEntries.length} topic ID definitions from ${parseResult.files.length} files`);

    // -- Resolve ------------------------------------------------------------
    const resolved = resolve(
      allEntries,
      scanResult.msgIdFiles,
      scanResult.msgIdValueFiles,
      scanResult.baseMappingFile,
      baseOverrides,
    );

    // -- Detect -------------------------------------------------------------
    const detectionResult = detect(resolved, nearMissGap);

    core.info(
      `Detection complete: ${detectionResult.collisions.length} collisions, ` +
        `${detectionResult.nearMisses.length} near-misses`,
    );

    // -- Extract bases for reporting ----------------------------------------
    const bases: BaseAddresses = {
      [Channel.PLATFORM_CMD]: baseOverrides[Channel.PLATFORM_CMD] ?? 0x1800,
      [Channel.PLATFORM_TLM]: baseOverrides[Channel.PLATFORM_TLM] ?? 0x0800,
      [Channel.GLOBAL_CMD]: baseOverrides[Channel.GLOBAL_CMD] ?? 0x1860,
      [Channel.GLOBAL_TLM]: baseOverrides[Channel.GLOBAL_TLM] ?? 0x0860,
    };

    // -- Report -------------------------------------------------------------
    emitAnnotations(detectionResult);

    if (reportFormat === 'summary' || reportFormat === 'both') {
      const markdown = generateJobSummary(detectionResult, bases);
      await writeJobSummary(markdown);
    }

    let jsonArtifact = '{}';
    if (reportFormat === 'json' || reportFormat === 'both') {
      jsonArtifact = generateJsonArtifact(detectionResult, bases);
    }

    // -- Set outputs --------------------------------------------------------
    core.setOutput('collision-count', String(detectionResult.collisions.length));
    core.setOutput('has-collisions', String(detectionResult.collisions.length > 0));
    core.setOutput('allocation-map', jsonArtifact);

    // -- Fail control -------------------------------------------------------
    if (failOnCollision && detectionResult.collisions.length > 0) {
      core.setFailed(
        `${detectionResult.collisions.length} MsgID collision(s) detected. ` +
          'See Job Summary and annotations for details.',
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

// --- Library re-exports for programmatic usage -----------------------------
export { parseFile, parseFiles, parseFileContent, parseNumericValue } from './parser';
export { scanFiles } from './scanner';
export {
  extractBaseAddresses,
  buildChannelMap,
  classifyByHeuristic,
  resolveTopicIds,
  resolve,
} from './resolver';
export { detectCollisions, detectNearMisses, detect } from './detector';
export {
  extractAppName,
  generateJobSummary,
  writeJobSummary,
  emitAnnotations,
  generateJsonArtifact,
} from './reporter';
export * from './types';

// --- Entry point -----------------------------------------------------------
run();
