/************************************************************************
 * Mock: Application style header (hex values, compact layout)
 * Mimics: apps/sample_app/fsw/inc/sample_app_topicids.h
 ************************************************************************/
#ifndef MOCK_SAMPLE_APP_TOPICIDS_H
#define MOCK_SAMPLE_APP_TOPICIDS_H

#include "mock_sample_app_topicid_values.h"

#define SAMPLE_APP_MISSION_CMD_TOPICID             SAMPLE_APP_MISSION_TIDVAL(CMD)
#define DEFAULT_SAMPLE_APP_MISSION_CMD_TOPICID     0x82
#define SAMPLE_APP_MISSION_SEND_HK_TOPICID         SAMPLE_APP_MISSION_TIDVAL(SEND_HK)
#define DEFAULT_SAMPLE_APP_MISSION_SEND_HK_TOPICID 0x83
#define SAMPLE_APP_MISSION_HK_TLM_TOPICID          SAMPLE_APP_MISSION_TIDVAL(HK_TLM)
#define DEFAULT_SAMPLE_APP_MISSION_HK_TLM_TOPICID  0x83

#endif
