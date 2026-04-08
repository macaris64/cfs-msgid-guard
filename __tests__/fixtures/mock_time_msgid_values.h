/************************************************************************
 * Mock: cFE TIME msgid_values (indirect MIDVAL pattern)
 * Mimics: cfe/modules/time/config/default_cfe_time_msgid_values.h
 *
 * Defines MIDVAL template macros that map topic IDs to channels.
 * TIME is unique: it has a GLBCMD channel for broadcast commands.
 ************************************************************************/
#ifndef MOCK_CFE_TIME_MSGID_VALUES_H
#define MOCK_CFE_TIME_MSGID_VALUES_H

#include "cfe_core_api_base_msgids.h"
#include "cfe_time_topicids.h"

#define CFE_PLATFORM_TIME_CMD_MIDVAL(x) CFE_PLATFORM_CMD_TOPICID_TO_MIDV(CFE_MISSION_TIME_##x##_TOPICID)
#define CFE_PLATFORM_TIME_TLM_MIDVAL(x) CFE_PLATFORM_TLM_TOPICID_TO_MIDV(CFE_MISSION_TIME_##x##_TOPICID)

/* TIME uses global commands for DATA_CMD and SEND_CMD */
#define CFE_PLATFORM_TIME_GLBCMD_MIDVAL(x) CFE_GLOBAL_CMD_TOPICID_TO_MIDV(CFE_MISSION_TIME_##x##_TOPICID)

#endif
