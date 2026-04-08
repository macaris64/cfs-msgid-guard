/************************************************************************
 * Mock: Direct-pattern msgids (Pattern A, to_lab-like)
 * Mimics: apps/to_lab/config/default_to_lab_msgids.h
 *
 * These call CFE_PLATFORM_*_TOPICID_TO_MIDV directly with the full
 * topic ID macro name -- no intermediate MIDVAL indirection.
 ************************************************************************/
#ifndef MOCK_TO_LAB_MSGIDS_H
#define MOCK_TO_LAB_MSGIDS_H

#include "cfe_core_api_base_msgids.h"
#include "to_lab_topicids.h"

#define TO_LAB_CMD_MID        CFE_PLATFORM_CMD_TOPICID_TO_MIDV(TO_LAB_MISSION_CMD_TOPICID)
#define TO_LAB_SEND_HK_MID    CFE_PLATFORM_CMD_TOPICID_TO_MIDV(TO_LAB_MISSION_SEND_HK_TOPICID)
#define TO_LAB_HK_TLM_MID     CFE_PLATFORM_TLM_TOPICID_TO_MIDV(TO_LAB_MISSION_HK_TLM_TOPICID)
#define TO_LAB_DATA_TYPES_MID CFE_PLATFORM_TLM_TOPICID_TO_MIDV(TO_LAB_MISSION_DATA_TYPES_TOPICID)

#endif
