import { ScanResult } from './types';
/**
 * Discover all cFS header files relevant to MsgID collision detection.
 *
 * Categorises results into four groups:
 *  - topicIdFiles:     *_topicids.h   (contain numeric DEFAULT_*_TOPICID defines)
 *  - msgIdFiles:       *_msgids.h     (channel classification – direct TOPICID_TO_MIDV refs)
 *  - msgIdValueFiles:  *_msgid_values.h (channel classification – MIDVAL template defs)
 *  - baseMappingFile:  default_cfe_core_api_msgid_mapping.h (4 base address constants)
 */
export declare function scanFiles(scanPaths: string[], topicIdPattern: string, msgIdPattern: string): Promise<ScanResult>;
//# sourceMappingURL=scanner.d.ts.map