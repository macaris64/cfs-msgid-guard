/**
 * Local Manual Runner for cfs-msgid-guard.
 *
 * Exercises the full scan -> parse -> resolve -> detect -> report pipeline
 * against the test fixtures WITHOUT requiring a GitHub Actions environment.
 * No dependency on @actions/core — imports only the pure library functions.
 *
 * Usage:
 *   npm run test:manual
 *   npm run test:manual -- --near-miss-gap 3
 *   npm run test:manual -- --scan-path /path/to/cfs/checkout
 *   npm run test:manual -- --collision   (run against synthetic collision fixtures)
 *   npm run test:manual -- --json        (print JSON artifact instead of summary)
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseFiles } from '../src/parser';
import { resolve, extractBaseAddresses } from '../src/resolver';
import { detect } from '../src/detector';
import { generateJobSummary, generateJsonArtifact, extractAppName } from '../src/reporter';
import { scanFiles } from '../src/scanner';
import { Channel, BaseAddresses, ResolvedMsgId } from '../src/types';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const FIXTURES = path.resolve(__dirname, '..', '__tests__', 'fixtures');
const REAL_FIXTURES = path.join(FIXTURES, 'real');

const scanPath = getArg('--scan-path', FIXTURES);
const topicIdPattern = getArg('--topicid-pattern',
  hasFlag('--collision') ? '**/collision_app_*_topicids.h' : '**/real/*_topicids.h',
);
const msgIdPattern = getArg('--msgid-pattern', '**/*_msgids.h');
const nearMissGap = parseInt(getArg('--near-miss-gap', '0'), 10);
const showJson = hasFlag('--json');
const showTable = hasFlag('--table') || (!showJson && !hasFlag('--summary'));
const showSummary = hasFlag('--summary') || (!showJson && !hasFlag('--table'));

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ---------------------------------------------------------------------------
// Channel display
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<Channel, string> = {
  [Channel.PLATFORM_CMD]: 'Platform Command  (0x1800)',
  [Channel.PLATFORM_TLM]: 'Platform Telemetry (0x0800)',
  [Channel.GLOBAL_CMD]: 'Global Command    (0x1860)',
  [Channel.GLOBAL_TLM]: 'Global Telemetry  (0x0860)',
};

const CHANNEL_COLORS: Record<Channel, string> = {
  [Channel.PLATFORM_CMD]: CYAN,
  [Channel.PLATFORM_TLM]: GREEN,
  [Channel.GLOBAL_CMD]: YELLOW,
  [Channel.GLOBAL_TLM]: YELLOW,
};

function toHex(value: number, pad = 4): string {
  return '0x' + value.toString(16).toUpperCase().padStart(pad, '0');
}

// ---------------------------------------------------------------------------
// Suppress @actions/glob ::debug:: noise when running outside GitHub Actions.
// The glob library writes ::debug:: workflow commands to stdout via
// process.stdout.write. We intercept and swallow them.
// ---------------------------------------------------------------------------
{
  const orig = process.stdout.write.bind(process.stdout) as
    (chunk: string | Uint8Array, encoding?: BufferEncoding, cb?: (err?: Error | null) => void) => boolean;

  process.stdout.write = ((
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void,
  ): boolean => {
    if (typeof chunk === 'string' && chunk.startsWith('::debug::')) return true;
    if (typeof encodingOrCb === 'function') return orig(chunk, undefined, encodingOrCb);
    return orig(chunk, encodingOrCb, cb);
  }) as typeof process.stdout.write;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║          cfs-msgid-guard  —  Local Manual Runner            ║${RESET}`);
  console.log(`${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}`);
  console.log();

  // -- Phase 1: Scan --------------------------------------------------------
  console.log(`${DIM}[1/5]${RESET} ${BOLD}Scanning${RESET} ${scanPath}`);
  console.log(`${DIM}      topicid-pattern: ${topicIdPattern}${RESET}`);
  console.log(`${DIM}      msgid-pattern:   ${msgIdPattern}${RESET}`);

  const scanResult = await scanFiles([scanPath], topicIdPattern, msgIdPattern);

  console.log(`      Found: ${scanResult.topicIdFiles.length} topic ID files, ` +
    `${scanResult.msgIdFiles.length} msgid files, ` +
    `${scanResult.msgIdValueFiles.length} msgid_values files`);
  if (scanResult.baseMappingFile) {
    console.log(`      Base mapping: ${path.basename(scanResult.baseMappingFile)}`);
  }
  console.log();

  if (scanResult.topicIdFiles.length === 0) {
    console.log(`${RED}No topic ID files found. Check --scan-path and --topicid-pattern.${RESET}`);
    process.exit(1);
  }

  // -- Phase 2: Parse -------------------------------------------------------
  console.log(`${DIM}[2/5]${RESET} ${BOLD}Parsing${RESET} topic ID definitions...`);

  const parseResult = parseFiles(scanResult.topicIdFiles);
  const allEntries = parseResult.files.flatMap(f => f.entries);

  console.log(`      ${allEntries.length} definitions from ${parseResult.files.length} files`);
  for (const file of parseResult.files) {
    console.log(`${DIM}        ${path.basename(file.filePath)}: ${file.entries.length} entries${RESET}`);
  }
  console.log();

  // -- Phase 3: Resolve -----------------------------------------------------
  console.log(`${DIM}[3/5]${RESET} ${BOLD}Resolving${RESET} channels and computing MsgIDs...`);

  const resolved = resolve(
    allEntries,
    scanResult.msgIdFiles,
    scanResult.msgIdValueFiles,
    scanResult.baseMappingFile,
  );

  const baseMappingContent = scanResult.baseMappingFile
    ? fs.readFileSync(scanResult.baseMappingFile, 'utf-8')
    : null;
  const bases = extractBaseAddresses(baseMappingContent);

  const tier1Count = resolved.filter(r => r.classifiedBy === 'MSGID_HEADER').length;
  const tier2Count = resolved.filter(r => r.classifiedBy === 'HEURISTIC').length;
  console.log(`      ${resolved.length} topics resolved (${tier1Count} via header, ${tier2Count} via heuristic)`);
  console.log();

  // -- Phase 4: Detect ------------------------------------------------------
  console.log(`${DIM}[4/5]${RESET} ${BOLD}Detecting${RESET} collisions (near-miss gap: ${nearMissGap})...`);

  const result = detect(resolved, nearMissGap);

  if (result.collisions.length === 0) {
    console.log(`      ${GREEN}0 collisions detected${RESET}`);
  } else {
    console.log(`      ${RED}${BOLD}${result.collisions.length} COLLISION(S) DETECTED${RESET}`);
  }
  if (result.nearMisses.length > 0) {
    console.log(`      ${YELLOW}${result.nearMisses.length} near-miss warning(s)${RESET}`);
  }
  console.log();

  // -- Phase 5: Report ------------------------------------------------------
  console.log(`${DIM}[5/5]${RESET} ${BOLD}Generating${RESET} report...\n`);

  // --- Console table (default) ---
  if (showTable) {
    printChannelTable(resolved, result.collisions.map(c => `${c.channel}:${c.topicIdValue}`));
  }

  // --- Collisions detail ---
  if (result.collisions.length > 0) {
    console.log(`${RED}${BOLD}${'═'.repeat(62)}${RESET}`);
    console.log(`${RED}${BOLD}  COLLISIONS${RESET}`);
    console.log(`${RED}${BOLD}${'═'.repeat(62)}${RESET}`);
    for (const c of result.collisions) {
      console.log(`  ${RED}Channel: ${c.channel}  TopicID: ${toHex(c.topicIdValue)}  MsgID: ${toHex(c.msgId)}${RESET}`);
      for (const e of c.entries) {
        console.log(`    ${RED}→ ${extractAppName(e)} (${e.name}) at ${path.basename(e.filePath)}:${e.line}${RESET}`);
      }
    }
    console.log();
  }

  // --- Near-misses detail ---
  if (result.nearMisses.length > 0) {
    console.log(`${YELLOW}${BOLD}Near-Miss Warnings:${RESET}`);
    for (const nm of result.nearMisses) {
      console.log(`  ${YELLOW}${nm.channel}: ${nm.entryA.entry.name} (${toHex(nm.entryA.entry.value)}) ↔ ` +
        `${nm.entryB.entry.name} (${toHex(nm.entryB.entry.value)}) — gap: ${nm.gap}${RESET}`);
    }
    console.log();
  }

  // --- Markdown Job Summary ---
  if (showSummary && !showTable) {
    console.log(`${BOLD}${'─'.repeat(62)}${RESET}`);
    console.log(`${BOLD}  Job Summary (Markdown)${RESET}`);
    console.log(`${'─'.repeat(62)}`);
    console.log(generateJobSummary(result, bases));
    console.log();
  }

  // --- JSON Artifact ---
  if (showJson) {
    console.log(`${BOLD}${'─'.repeat(62)}${RESET}`);
    console.log(`${BOLD}  JSON Artifact${RESET}`);
    console.log(`${'─'.repeat(62)}`);
    console.log(generateJsonArtifact(result, bases));
    console.log();
  }

  // --- Final status line ---
  const status = result.collisions.length === 0
    ? `${GREEN}${BOLD}PASS${RESET} — ${resolved.length} topics, 0 collisions`
    : `${RED}${BOLD}FAIL${RESET} — ${result.collisions.length} collision(s) in ${resolved.length} topics`;

  console.log(`${'═'.repeat(62)}`);
  console.log(`  Result: ${status}`);
  console.log(`${'═'.repeat(62)}`);

  process.exit(result.collisions.length > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Pretty channel table
// ---------------------------------------------------------------------------

function printChannelTable(
  resolved: ResolvedMsgId[],
  collisionKeys: string[],
): void {
  const collisionSet = new Set(collisionKeys);
  const byChannel = new Map<Channel, ResolvedMsgId[]>();
  for (const r of resolved) {
    const group = byChannel.get(r.channel) ?? [];
    group.push(r);
    byChannel.set(r.channel, group);
  }

  const channels: Channel[] = [Channel.PLATFORM_CMD, Channel.PLATFORM_TLM, Channel.GLOBAL_CMD, Channel.GLOBAL_TLM];

  for (const ch of channels) {
    const entries = byChannel.get(ch);
    if (!entries || entries.length === 0) continue;

    const color = CHANNEL_COLORS[ch];
    console.log(`${color}${BOLD}┌─ ${CHANNEL_LABELS[ch]} ─${'─'.repeat(Math.max(0, 44 - CHANNEL_LABELS[ch].length))}┐${RESET}`);
    console.log(`${DIM}  ${'App'.padEnd(14)} ${'Topic Name'.padEnd(38)} TopicID  MsgID   Tier${RESET}`);

    const sorted = [...entries].sort((a, b) => a.entry.value - b.entry.value);
    for (const r of sorted) {
      const app = extractAppName(r.entry).padEnd(14);
      const topic = r.entry.name.padEnd(38);
      const tid = toHex(r.entry.value);
      const mid = toHex(r.msgId);
      const tier = r.classifiedBy === 'MSGID_HEADER' ? 'T1' : `${DIM}T2${RESET}`;
      const key = `${r.channel}:${r.entry.value}`;
      const marker = collisionSet.has(key) ? ` ${RED}${BOLD}!!${RESET}` : '';

      console.log(`  ${app} ${topic} ${tid}   ${mid}   ${tier}${marker}`);
    }
    console.log(`${color}${BOLD}└${'─'.repeat(61)}┘${RESET}`);
    console.log();
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------
main().catch(err => {
  console.error(`${RED}Fatal error: ${err.message}${RESET}`);
  process.exit(2);
});
