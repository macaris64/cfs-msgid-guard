/************************************************************************
 * Mock: Edge cases for parser robustness testing
 *
 * Tests: zero values, max byte values, large IDs, commented-out defines,
 *        ifdef guards, non-TOPICID defines, and unusual whitespace.
 ************************************************************************/
#ifndef MOCK_EDGE_CASES_TOPICIDS_H
#define MOCK_EDGE_CASES_TOPICIDS_H

/* Valid: zero value (TIME DATA_CMD uses this) */
#define DEFAULT_EDGE_MISSION_ZERO_TOPICID   0

/* Valid: max single-byte value */
#define DEFAULT_EDGE_MISSION_MAXBYTE_TOPICID 0xFF

/* Valid: exceeds single-byte range */
#define DEFAULT_EDGE_MISSION_LARGE_TOPICID  0x0100

/* Valid: uppercase hex digits */
#define DEFAULT_EDGE_MISSION_UPPER_HEX_TOPICID 0xAB

/* Valid: mixed case hex digits */
#define DEFAULT_EDGE_MISSION_MIXED_HEX_TOPICID 0xCd

/* Should NOT match: commented out */
/* #define DEFAULT_EDGE_MISSION_COMMENTED_TOPICID 0x99 */

/* Should NOT match: in a line comment */
// #define DEFAULT_EDGE_MISSION_LINECOMMENT_TOPICID 0x98

/* Should NOT match: not a TOPICID define */
#define DEFAULT_EDGE_MISSION_PERFID 42

/* Should NOT match: missing DEFAULT_ prefix */
#define EDGE_MISSION_NOPFX_TOPICID 0x50

/* Should NOT match: expression value (not a literal) */
#define EDGE_MISSION_EXPR_TOPICID (BASE + 5)

/* Should NOT match: string value */
#define DEFAULT_EDGE_MISSION_STR_TOPICID "not_a_number"

#ifdef SOME_FLAG
/* Valid inside ifdef: parser sees raw text, not preprocessor output */
#define DEFAULT_EDGE_MISSION_IFDEF_TOPICID 0x42
#endif

/* Valid: extreme whitespace alignment */
#define DEFAULT_EDGE_MISSION_WIDE_TOPICID                              77

#endif
