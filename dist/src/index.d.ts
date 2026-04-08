export declare function run(): Promise<void>;
export { parseFile, parseFiles, parseFileContent, parseNumericValue } from './parser';
export { scanFiles } from './scanner';
export { extractBaseAddresses, buildChannelMap, classifyByHeuristic, resolveTopicIds, resolve, } from './resolver';
export { detectCollisions, detectNearMisses, detect } from './detector';
export { extractAppName, generateJobSummary, writeJobSummary, emitAnnotations, generateJsonArtifact, } from './reporter';
export * from './types';
//# sourceMappingURL=index.d.ts.map