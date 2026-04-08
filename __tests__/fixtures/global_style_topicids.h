/************************************************************************
 * Mock: Global channel style (CFE_TIME-like with global commands)
 * Mimics: cfe/modules/time/fsw/inc/cfe_time_topicids.h
 *
 * Contains three sections: platform commands, global commands, telemetry.
 * DATA_CMD and SEND_CMD use the GLOBAL_CMD base (0x1860), not PLATFORM_CMD.
 ************************************************************************/
#ifndef MOCK_CFE_TIME_TOPICIDS_H
#define MOCK_CFE_TIME_TOPICIDS_H

#include "mock_cfe_time_topicid_values.h"

/**
**  cFE Portable Message Numbers for Commands
*/
#define CFE_MISSION_TIME_CMD_TOPICID               CFE_MISSION_TIME_TIDVAL(CMD)
#define DEFAULT_CFE_MISSION_TIME_CMD_TOPICID       5
#define CFE_MISSION_TIME_SEND_HK_TOPICID           CFE_MISSION_TIME_TIDVAL(SEND_HK)
#define DEFAULT_CFE_MISSION_TIME_SEND_HK_TOPICID   13

/**
**  cFE Portable Message Numbers for Global Messages
*/
#define CFE_MISSION_TIME_DATA_CMD_TOPICID         CFE_MISSION_TIME_TIDVAL(DATA_CMD)
#define DEFAULT_CFE_MISSION_TIME_DATA_CMD_TOPICID 0
#define CFE_MISSION_TIME_SEND_CMD_TOPICID         CFE_MISSION_TIME_TIDVAL(SEND_CMD)
#define DEFAULT_CFE_MISSION_TIME_SEND_CMD_TOPICID 2

/**
**  cFE Portable Message Numbers for Telemetry
*/
#define CFE_MISSION_TIME_HK_TLM_TOPICID           CFE_MISSION_TIME_TIDVAL(HK_TLM)
#define DEFAULT_CFE_MISSION_TIME_HK_TLM_TOPICID   5
#define CFE_MISSION_TIME_DIAG_TLM_TOPICID         CFE_MISSION_TIME_TIDVAL(DIAG_TLM)
#define DEFAULT_CFE_MISSION_TIME_DIAG_TLM_TOPICID 6

#endif
