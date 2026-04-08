import * as path from 'path';
import { scanFiles } from '../src/scanner';

const FIXTURES = path.resolve(__dirname, 'fixtures');

describe('scanFiles', () => {
  it('discovers *_topicids.h files', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const basenames = result.topicIdFiles.map(f => path.basename(f));
    expect(basenames).toContain('cfe_style_topicids.h');
    expect(basenames).toContain('app_style_topicids.h');
    expect(basenames).toContain('edge_cases_topicids.h');
    expect(basenames).toContain('empty_topicids.h');
    expect(basenames).toContain('collision_app_a_topicids.h');
    expect(basenames).toContain('collision_app_b_topicids.h');
    expect(basenames).toContain('global_style_topicids.h');
  });

  it('discovers real cFS *_topicids.h fixtures', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const basenames = result.topicIdFiles.map(f => path.basename(f));
    expect(basenames).toContain('cfe_es_topicids.h');
    expect(basenames).toContain('cfe_time_topicids.h');
    expect(basenames).toContain('sample_app_topicids.h');
  });

  it('discovers *_msgids.h files', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const basenames = result.msgIdFiles.map(f => path.basename(f));
    expect(basenames).toContain('global_style_msgids.h');
    expect(basenames).toContain('mock_app_msgids.h');
    expect(basenames).toContain('mock_indirect_msgids.h');
  });

  it('discovers *_msgid_values.h files', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const basenames = result.msgIdValueFiles.map(f => path.basename(f));
    expect(basenames).toContain('mock_time_msgid_values.h');
    expect(basenames).toContain('mock_app_msgid_values.h');
  });

  it('discovers base mapping file', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    expect(result.baseMappingFile).not.toBeNull();
    expect(path.basename(result.baseMappingFile!)).toBe(
      'default_cfe_core_api_msgid_mapping.h',
    );
  });

  it('returns null baseMappingFile when not found', async () => {
    const result = await scanFiles(
      [path.join(FIXTURES, 'real')],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    expect(result.baseMappingFile).toBeNull();
  });

  it('returns sorted results for deterministic output', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    const sorted = [...result.topicIdFiles].sort();
    expect(result.topicIdFiles).toEqual(sorted);

    const sortedMsgId = [...result.msgIdFiles].sort();
    expect(result.msgIdFiles).toEqual(sortedMsgId);
  });

  it('has no duplicate entries', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    expect(new Set(result.topicIdFiles).size).toBe(result.topicIdFiles.length);
    expect(new Set(result.msgIdFiles).size).toBe(result.msgIdFiles.length);
    expect(new Set(result.msgIdValueFiles).size).toBe(result.msgIdValueFiles.length);
  });

  it('handles patterns without **/ prefix', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '*_topicids.h',
      '*_msgids.h',
    );

    expect(result.topicIdFiles).toBeDefined();
    expect(result.msgIdFiles).toBeDefined();
    expect(result.msgIdValueFiles).toBeDefined();
  });

  it('falls back to cwd when scanPaths is empty', async () => {
    const result = await scanFiles(
      [],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    expect(result).toHaveProperty('topicIdFiles');
    expect(result).toHaveProperty('msgIdFiles');
    expect(result).toHaveProperty('msgIdValueFiles');
    expect(result).toHaveProperty('baseMappingFile');
  });

  it('does not cross-contaminate categories', async () => {
    const result = await scanFiles(
      [FIXTURES],
      '**/*_topicids.h',
      '**/*_msgids.h',
    );

    for (const f of result.topicIdFiles) {
      expect(f).toMatch(/_topicids\.h$/);
    }
    for (const f of result.msgIdFiles) {
      expect(f).toMatch(/_msgids\.h$/);
    }
    for (const f of result.msgIdValueFiles) {
      expect(f).toMatch(/_msgid_values\.h$/);
    }
  });
});
