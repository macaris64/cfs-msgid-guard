/************************************************************************
 * Mock: Application-style msgid_values (indirect MIDVAL pattern)
 * Mimics: apps/sample_app/config/default_sample_app_msgid_values.h
 *
 * Uses the same topic prefix for both CMD and TLM channels.
 * The specific channel is determined by which MIDVAL macro is invoked.
 ************************************************************************/
#ifndef MOCK_SAMPLE_APP_MSGID_VALUES_H
#define MOCK_SAMPLE_APP_MSGID_VALUES_H

#include "cfe_core_api_base_msgids.h"
#include "sample_app_topicids.h"

#define SAMPLE_APP_CMD_PLATFORM_MIDVAL(x) CFE_PLATFORM_CMD_TOPICID_TO_MIDV(SAMPLE_APP_MISSION_##x##_TOPICID)
#define SAMPLE_APP_TLM_PLATFORM_MIDVAL(x) CFE_PLATFORM_TLM_TOPICID_TO_MIDV(SAMPLE_APP_MISSION_##x##_TOPICID)

#endif
