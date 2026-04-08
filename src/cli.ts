import * as path from 'path';
import * as fs from 'fs';
import { parseFiles } from './parser';
import { parseNumericValue } from './parser';
import { resolve, extractBaseAddresses } from './resolver';
import { detect } from './detector';
import { generateJobSummary, generateJsonArtifact, generateAuditReport, extractAppName } from './reporter';
import { scanFiles } from './scanner';
import { BaseAddresses, Channel, ResolvedMsgId } from './types';

// ---------------------------------------------------------------------------
// CLI Options
// ---------------------------------------------------------------------------

export interface CliOptions {
  scanPath: string;
  topicIdPattern: string;
  msgIdPattern: string;
  cmdBase: string;
  tlmBase: string;
  globalCmdBase: string;
  globalTlmBase: string;
  nearMissGap: number;
  failOnCollision: boolean;
  format: 'table' | 'json' | 'summary';
  color: boolean;
  report: boolean;
  expectedCount: number | null;
}

// ---------------------------------------------------------------------------
// Argument Parsing
// ---------------------------------------------------------------------------

function getArg(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

export function parseCliArgs(args: string[]): CliOptions {
  return {
    scanPath: getArg(args, '--scan-path', '.'),
    topicIdPattern: getArg(args, '--topicid-pattern', '**/*_topicids.h'),
    msgIdPattern: getArg(args, '--msgid-pattern', '**/*_msgids.h'),
    cmdBase: getArg(args, '--cmd-base', '0x1800'),
    tlmBase: getArg(args, '--tlm-base', '0x0800'),
    globalCmdBase: getArg(args, '--global-cmd-base', '0x1860'),
    globalTlmBase: getArg(args, '--global-tlm-base', '0x0860'),
    nearMissGap: parseInt(getArg(args, '--near-miss-gap', '0'), 10),
    failOnCollision: !hasFlag(args, '--no-fail-on-collision'),
    format: parseFormat(getArg(args, '--format', 'table')),
    color: !hasFlag(args, '--no-color'),
    report: hasFlag(args, '--report'),
    expectedCount: hasFlag(args, '--expected-count')
      ? parseInt(getArg(args, '--expected-count', '0'), 10)
      : null,
  };
}

function parseFormat(value: string): 'table' | 'json' | 'summary' {
  if (value === 'json' || value === 'summary') return value;
  return 'table';
}

// ---------------------------------------------------------------------------
// ANSI color support
// ---------------------------------------------------------------------------

interface Colors {
  bold: string;
  dim: string;
  red: string;
  green: string;
  yellow: string;
  cyan: string;
  reset: string;
}

export function makeColors(enabled: boolean): Colors {
  if (!enabled) {
    return { bold: '', dim: '', red: '', green: '', yellow: '', cyan: '', reset: '' };
  }
  return {
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
}

const CHANNEL_LABELS: Record<Channel, string> = {
  [Channel.PLATFORM_CMD]: 'Platform Command  (0x1800)',
  [Channel.PLATFORM_TLM]: 'Platform Telemetry (0x0800)',
  [Channel.GLOBAL_CMD]: 'Global Command    (0x1860)',
  [Channel.GLOBAL_TLM]: 'Global Telemetry  (0x0860)',
};

const CHANNEL_COLORS_MAP: Record<Channel, keyof Colors> = {
  [Channel.PLATFORM_CMD]: 'cyan',
  [Channel.PLATFORM_TLM]: 'green',
  [Channel.GLOBAL_CMD]: 'yellow',
  [Channel.GLOBAL_TLM]: 'yellow',
};

const CHANNEL_ORDER: Channel[] = [
  Channel.PLATFORM_CMD,
  Channel.PLATFORM_TLM,
  Channel.GLOBAL_CMD,
  Channel.GLOBAL_TLM,
];

export function toHex(value: number, pad = 4): string {
  return '0x' + value.toString(16).toUpperCase().padStart(pad, '0');
}

// ---------------------------------------------------------------------------
// Table Formatter
// ---------------------------------------------------------------------------

export function formatChannelTable(
  resolved: ResolvedMsgId[],
  collisionKeys: string[],
  c: Colors,
): string {
  const collisionSet = new Set(collisionKeys);
  const byChannel = new Map<Channel, ResolvedMsgId[]>();
  for (const r of resolved) {
    const group = byChannel.get(r.channel) ?? [];
    group.push(r);
    byChannel.set(r.channel, group);
  }

  const lines: string[] = [];

  for (const ch of CHANNEL_ORDER) {
    const entries = byChannel.get(ch);
    if (!entries || entries.length === 0) continue;

    const chColor = c[CHANNEL_COLORS_MAP[ch]];
    lines.push(`${chColor}${c.bold}┌─ ${CHANNEL_LABELS[ch]} ─${'─'.repeat(Math.max(0, 44 - CHANNEL_LABELS[ch].length))}┐${c.reset}`);
    lines.push(`${c.dim}  ${'App'.padEnd(14)} ${'Topic Name'.padEnd(38)} TopicID  MsgID   Tier${c.reset}`);

    const sorted = [...entries].sort((a, b) => a.entry.value - b.entry.value);
    for (const r of sorted) {
      const app = extractAppName(r.entry).padEnd(14);
      const topic = r.entry.name.padEnd(38);
      const tid = toHex(r.entry.value);
      const mid = toHex(r.msgId);
      const tier = r.classifiedBy === 'MSGID_HEADER' ? 'T1' : `${c.dim}T2${c.reset}`;
      const key = `${r.channel}:${r.entry.value}`;
      const marker = collisionSet.has(key) ? ` ${c.red}${c.bold}!!${c.reset}` : '';

      lines.push(`  ${app} ${topic} ${tid}   ${mid}   ${tier}${marker}`);
    }
    lines.push(`${chColor}${c.bold}└${'─'.repeat(61)}┘${c.reset}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main CLI Runner
// ---------------------------------------------------------------------------

export async function runCli(args: string[]): Promise<number> {
  const opts = parseCliArgs(args);
  const c = makeColors(opts.color);

  const baseOverrides: Partial<BaseAddresses> = {};
  if (opts.cmdBase !== '0x1800') baseOverrides[Channel.PLATFORM_CMD] = parseNumericValue(opts.cmdBase);
  if (opts.tlmBase !== '0x0800') baseOverrides[Channel.PLATFORM_TLM] = parseNumericValue(opts.tlmBase);
  if (opts.globalCmdBase !== '0x1860') baseOverrides[Channel.GLOBAL_CMD] = parseNumericValue(opts.globalCmdBase);
  if (opts.globalTlmBase !== '0x0860') baseOverrides[Channel.GLOBAL_TLM] = parseNumericValue(opts.globalTlmBase);

  console.log(`${c.bold}cfs-msgid-guard${c.reset} — Message ID Collision Detector\n`);

  // -- Scan -----------------------------------------------------------------
  console.log(`${c.dim}[1/5]${c.reset} ${c.bold}Scanning${c.reset} ${opts.scanPath}`);

  let scanResult;
  try {
    scanResult = await scanFiles([opts.scanPath], opts.topicIdPattern, opts.msgIdPattern);
  } catch (err) {
    console.error(`${c.red}Scan failed: ${err instanceof Error ? err.message : err}${c.reset}`);
    return 2;
  }

  console.log(
    `      Found: ${scanResult.topicIdFiles.length} topic ID files, ` +
    `${scanResult.msgIdFiles.length} msgid files, ` +
    `${scanResult.msgIdValueFiles.length} msgid_values files`,
  );
  if (scanResult.baseMappingFile) {
    console.log(`      Base mapping: ${path.basename(scanResult.baseMappingFile)}`);
  }

  if (scanResult.topicIdFiles.length === 0) {
    console.error(`${c.red}No topic ID files found. Check --scan-path and --topicid-pattern.${c.reset}`);
    return 1;
  }

  // -- Parse ----------------------------------------------------------------
  console.log(`${c.dim}[2/5]${c.reset} ${c.bold}Parsing${c.reset} topic ID definitions...`);

  const parseResult = parseFiles(scanResult.topicIdFiles);
  const allEntries = parseResult.files.flatMap(f => f.entries);

  console.log(`      ${allEntries.length} definitions from ${parseResult.files.length} files`);

  // -- Resolve --------------------------------------------------------------
  console.log(`${c.dim}[3/5]${c.reset} ${c.bold}Resolving${c.reset} channels and computing MsgIDs...`);

  const resolved = resolve(
    allEntries,
    scanResult.msgIdFiles,
    scanResult.msgIdValueFiles,
    scanResult.baseMappingFile,
    baseOverrides,
  );

  const baseMappingContent = scanResult.baseMappingFile
    ? fs.readFileSync(scanResult.baseMappingFile, 'utf-8')
    : null;
  const bases = extractBaseAddresses(baseMappingContent, baseOverrides);

  const tier1 = resolved.filter(r => r.classifiedBy === 'MSGID_HEADER').length;
  const tier2 = resolved.filter(r => r.classifiedBy === 'HEURISTIC').length;
  console.log(`      ${resolved.length} resolved (${tier1} header, ${tier2} heuristic)`);

  // -- Detect ---------------------------------------------------------------
  console.log(`${c.dim}[4/5]${c.reset} ${c.bold}Detecting${c.reset} collisions (near-miss gap: ${opts.nearMissGap})...`);

  const result = detect(resolved, opts.nearMissGap);

  if (result.collisions.length === 0) {
    console.log(`      ${c.green}0 collisions${c.reset}`);
  } else {
    console.log(`      ${c.red}${c.bold}${result.collisions.length} COLLISION(S)${c.reset}`);
  }
  if (result.nearMisses.length > 0) {
    console.log(`      ${c.yellow}${result.nearMisses.length} near-miss warning(s)${c.reset}`);
  }

  // -- Report ---------------------------------------------------------------
  console.log(`${c.dim}[5/5]${c.reset} ${c.bold}Report${c.reset}\n`);

  if (opts.format === 'table') {
    const table = formatChannelTable(
      resolved,
      result.collisions.map(col => `${col.channel}:${col.topicIdValue}`),
      c,
    );
    console.log(table);
  }

  if (result.collisions.length > 0) {
    console.log(`${c.red}${c.bold}  COLLISIONS${c.reset}`);
    for (const col of result.collisions) {
      console.log(`  ${c.red}${col.channel}  TopicID=${toHex(col.topicIdValue)}  MsgID=${toHex(col.msgId)}${c.reset}`);
      for (const e of col.entries) {
        console.log(`    ${c.red}→ ${extractAppName(e)} (${e.name}) at ${path.basename(e.filePath)}:${e.line}${c.reset}`);
      }
    }
    console.log();
  }

  if (result.nearMisses.length > 0) {
    console.log(`${c.yellow}${c.bold}Near-Miss Warnings:${c.reset}`);
    for (const nm of result.nearMisses) {
      console.log(
        `  ${c.yellow}${nm.channel}: ${nm.entryA.entry.name} (${toHex(nm.entryA.entry.value)}) ↔ ` +
        `${nm.entryB.entry.name} (${toHex(nm.entryB.entry.value)}) — gap: ${nm.gap}${c.reset}`,
      );
    }
    console.log();
  }

  if (opts.format === 'summary') {
    console.log(generateJobSummary(result, bases));
  }

  if (opts.format === 'json') {
    console.log(generateJsonArtifact(result, bases));
  }

  // -- Status line ----------------------------------------------------------
  const hasCollisions = result.collisions.length > 0;
  const status = hasCollisions
    ? `${c.red}${c.bold}FAIL${c.reset} — ${result.collisions.length} collision(s) in ${resolved.length} topics`
    : `${c.green}${c.bold}PASS${c.reset} — ${resolved.length} topics, 0 collisions`;

  console.log(`  Result: ${status}`);

  if (opts.report) {
    const reportText = generateAuditReport(result, bases, opts.scanPath, opts.expectedCount);
    fs.writeFileSync('collusion-report.txt', reportText, 'utf-8');
    console.log(`\n  Report written to collusion-report.txt`);
  }

  if (hasCollisions && opts.failOnCollision) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Entry point — only when executed directly (not imported by tests)
// ---------------------------------------------------------------------------

/* istanbul ignore next -- entry-point wiring, tested via npm run test:manual */
if (require.main === module) {
  // Suppress @actions/glob ::debug:: workflow commands in terminal output
  const origWrite = process.stdout.write.bind(process.stdout) as
    (chunk: string | Uint8Array, encoding?: BufferEncoding, cb?: (err?: Error | null) => void) => boolean;

  process.stdout.write = ((
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean => {
    if (typeof chunk === 'string' && chunk.startsWith('::debug::')) return true;
    if (typeof encodingOrCb === 'function') return origWrite(chunk, undefined, encodingOrCb);
    return origWrite(chunk, encodingOrCb, cb);
  }) as typeof process.stdout.write;

  runCli(process.argv.slice(2))
    .then(code => process.exit(code))
    .catch(err => {
      console.error(`Fatal: ${err.message}`);
      process.exit(2);
    });
}
