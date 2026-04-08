import * as glob from '@actions/glob';
import { ScanResult } from './types';

const BASE_MAPPING_FILENAME = 'default_cfe_core_api_msgid_mapping.h';

/**
 * Discover all cFS header files relevant to MsgID collision detection.
 *
 * Categorises results into four groups:
 *  - topicIdFiles:     *_topicids.h   (contain numeric DEFAULT_*_TOPICID defines)
 *  - msgIdFiles:       *_msgids.h     (channel classification – direct TOPICID_TO_MIDV refs)
 *  - msgIdValueFiles:  *_msgid_values.h (channel classification – MIDVAL template defs)
 *  - baseMappingFile:  default_cfe_core_api_msgid_mapping.h (4 base address constants)
 */
export async function scanFiles(
  scanPaths: string[],
  topicIdPattern: string,
  msgIdPattern: string,
): Promise<ScanResult> {
  const patterns = buildPatterns(scanPaths, topicIdPattern, msgIdPattern);

  const [topicIdFiles, msgIdFiles, msgIdValueFiles, baseMappingFiles] =
    await Promise.all([
      globUnique(patterns.topicId),
      globUnique(patterns.msgId),
      globUnique(patterns.msgIdValues),
      globUnique(patterns.baseMapping),
    ]);

  return {
    topicIdFiles: topicIdFiles.sort(),
    msgIdFiles: msgIdFiles.sort(),
    msgIdValueFiles: msgIdValueFiles.sort(),
    baseMappingFile: baseMappingFiles.length > 0 ? baseMappingFiles.sort()[0] : null,
  };
}

interface GlobPatterns {
  topicId: string;
  msgId: string;
  msgIdValues: string;
  baseMapping: string;
}

function buildPatterns(
  scanPaths: string[],
  topicIdPattern: string,
  msgIdPattern: string,
): GlobPatterns {
  const roots = scanPaths.length > 0 ? scanPaths : ['.'];

  const topicIdGlobs = roots.map(r => joinPattern(r, topicIdPattern));
  const msgIdGlobs = roots.map(r => joinPattern(r, msgIdPattern));
  const msgIdValueGlobs = roots.map(r =>
    joinPattern(r, msgIdPattern.replace(/_msgids\.h/g, '_msgid_values.h')),
  );
  const baseMappingGlobs = roots.map(r =>
    joinPattern(r, `**/${BASE_MAPPING_FILENAME}`),
  );

  return {
    topicId: topicIdGlobs.join('\n'),
    msgId: msgIdGlobs.join('\n'),
    msgIdValues: msgIdValueGlobs.join('\n'),
    baseMapping: baseMappingGlobs.join('\n'),
  };
}

function joinPattern(root: string, pattern: string): string {
  const cleanRoot = root.replace(/\/+$/, '');
  const cleanPattern = pattern.replace(/^\/+/, '');
  if (cleanPattern.startsWith('**/')) {
    return `${cleanRoot}/${cleanPattern}`;
  }
  return `${cleanRoot}/${cleanPattern}`;
}

async function globUnique(pattern: string): Promise<string[]> {
  const globber = await glob.create(pattern, { followSymbolicLinks: false });
  const files = await globber.glob();
  return [...new Set(files)];
}
