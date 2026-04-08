/************************************************************************
 * Mock: MsgID definitions for the global-style TIME module.
 * Shows which topics route through PLATFORM vs GLOBAL base addresses.
 * Mimics: cfe/modules/time/config/default_cfe_time_msgids.h
 ************************************************************************/
#ifndef MOCK_CFE_TIME_MSGIDS_H
#define MOCK_CFE_TIME_MSGIDS_H

#include "cfe_core_api_base_msgids.h"
#include "mock_cfe_time_msgid_values.h"

/*
** cFE Command Message Id's
*/
#define CFE_TIME_CMD_MID       CFE_PLATFORM_TIME_CMD_MIDVAL(CMD)
#define CFE_TIME_SEND_HK_MID   CFE_PLATFORM_TIME_CMD_MIDVAL(SEND_HK)
#define CFE_TIME_TONE_CMD_MID  CFE_PLATFORM_TIME_CMD_MIDVAL(TONE_CMD)
#define CFE_TIME_ONEHZ_CMD_MID CFE_PLATFORM_TIME_CMD_MIDVAL(ONEHZ_CMD)

/*
** cFE Global Command Message Id's
*/
#define CFE_TIME_DATA_CMD_MID CFE_PLATFORM_TIME_GLBCMD_MIDVAL(DATA_CMD)
#define CFE_TIME_SEND_CMD_MID CFE_PLATFORM_TIME_GLBCMD_MIDVAL(SEND_CMD)

/*
** CFE Telemetry Message Id's
*/
#define CFE_TIME_HK_TLM_MID   CFE_PLATFORM_TIME_TLM_MIDVAL(HK_TLM)
#define CFE_TIME_DIAG_TLM_MID CFE_PLATFORM_TIME_TLM_MIDVAL(DIAG_TLM)

#endif
