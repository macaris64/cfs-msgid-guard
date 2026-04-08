/************************************************************************
 * Mock: Base address mapping file
 * Mimics: cfe/modules/core_api/config/default_cfe_core_api_msgid_mapping.h
 *
 * Defines the 4 base addresses and the TOPICID_TO_MIDV conversion macros.
 ************************************************************************/
#ifndef MOCK_CFE_CORE_API_MSGID_MAPPING_H
#define MOCK_CFE_CORE_API_MSGID_MAPPING_H

#include "cfe_core_api_base_msgid_values.h"

#define CFE_PLATFORM_CMD_TOPICID_TO_MIDV(topic) (CFE_PLATFORM_BASE_MIDVAL(CMD) | (topic))
#define DEFAULT_CFE_PLATFORM_CMD_MID_BASE       0x1800

#define CFE_PLATFORM_TLM_TOPICID_TO_MIDV(topic) (CFE_PLATFORM_BASE_MIDVAL(TLM) | (topic))
#define DEFAULT_CFE_PLATFORM_TLM_MID_BASE       0x0800

#define CFE_GLOBAL_CMD_TOPICID_TO_MIDV(topic) (CFE_GLOBAL_BASE_MIDVAL(CMD) | (topic))
#define DEFAULT_GLOBAL_CMD_MID_BASE           0x1860

#define CFE_GLOBAL_TLM_TOPICID_TO_MIDV(topic) (CFE_GLOBAL_BASE_MIDVAL(TLM) | (topic))
#define DEFAULT_GLOBAL_TLM_MID_BASE           0x0860

#endif
