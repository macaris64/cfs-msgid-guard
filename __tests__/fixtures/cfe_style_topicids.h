/************************************************************************
 * Mock: cFE-core style header (decimal values, multi-topic, column-aligned)
 * Mimics: cfe/modules/es/fsw/inc/cfe_es_topicids.h
 ************************************************************************/
#ifndef MOCK_CFE_ES_TOPICIDS_H
#define MOCK_CFE_ES_TOPICIDS_H

#include "mock_cfe_es_topicid_values.h"

/**
**  cFE Portable Message Numbers for Commands
*/
#define CFE_MISSION_ES_CMD_TOPICID             CFE_MISSION_ES_TIDVAL(CMD)
#define DEFAULT_CFE_MISSION_ES_CMD_TOPICID     6
#define CFE_MISSION_ES_SEND_HK_TOPICID         CFE_MISSION_ES_TIDVAL(SEND_HK)
#define DEFAULT_CFE_MISSION_ES_SEND_HK_TOPICID 8

/**
**  cFE Portable Message Numbers for Telemetry
*/
#define CFE_MISSION_ES_HK_TLM_TOPICID               CFE_MISSION_ES_TIDVAL(HK_TLM)
#define DEFAULT_CFE_MISSION_ES_HK_TLM_TOPICID       0
#define CFE_MISSION_ES_APP_TLM_TOPICID              CFE_MISSION_ES_TIDVAL(APP_TLM)
#define DEFAULT_CFE_MISSION_ES_APP_TLM_TOPICID      11
#define CFE_MISSION_ES_MEMSTATS_TLM_TOPICID         CFE_MISSION_ES_TIDVAL(MEMSTATS_TLM)
#define DEFAULT_CFE_MISSION_ES_MEMSTATS_TLM_TOPICID 16

#endif
