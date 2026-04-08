/************************************************************************
 * Mock: Indirect-pattern msgids (Pattern B, sample_app + TIME-like)
 * Mimics both:
 *   apps/sample_app/config/default_sample_app_msgids.h
 *   cfe/modules/time/config/default_cfe_time_msgids.h
 *
 * Uses intermediate MIDVAL macros defined in *_msgid_values.h fixtures.
 ************************************************************************/
#ifndef MOCK_INDIRECT_MSGIDS_H
#define MOCK_INDIRECT_MSGIDS_H

#include "sample_app_msgid_values.h"
#include "cfe_time_msgid_values.h"

/*
** Sample App (uses app-style MIDVAL)
*/
#define SAMPLE_APP_CMD_MID     SAMPLE_APP_CMD_PLATFORM_MIDVAL(CMD)
#define SAMPLE_APP_SEND_HK_MID SAMPLE_APP_CMD_PLATFORM_MIDVAL(SEND_HK)
#define SAMPLE_APP_HK_TLM_MID  SAMPLE_APP_TLM_PLATFORM_MIDVAL(HK_TLM)

/*
** CFE TIME (uses cfe-core-style MIDVAL, including global commands)
*/
#define CFE_TIME_CMD_MID       CFE_PLATFORM_TIME_CMD_MIDVAL(CMD)
#define CFE_TIME_SEND_HK_MID   CFE_PLATFORM_TIME_CMD_MIDVAL(SEND_HK)
#define CFE_TIME_DATA_CMD_MID CFE_PLATFORM_TIME_GLBCMD_MIDVAL(DATA_CMD)
#define CFE_TIME_SEND_CMD_MID CFE_PLATFORM_TIME_GLBCMD_MIDVAL(SEND_CMD)
#define CFE_TIME_HK_TLM_MID   CFE_PLATFORM_TIME_TLM_MIDVAL(HK_TLM)
#define CFE_TIME_DIAG_TLM_MID CFE_PLATFORM_TIME_TLM_MIDVAL(DIAG_TLM)

#endif
