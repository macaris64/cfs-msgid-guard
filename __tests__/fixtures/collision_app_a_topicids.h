/************************************************************************
 * Mock: Collision test - App A claims topic ID 0x82 for CMD
 * Used in pair with collision_app_b_topicids.h to test collision detection.
 ************************************************************************/
#ifndef MOCK_APP_A_TOPICIDS_H
#define MOCK_APP_A_TOPICIDS_H

#define APP_A_MISSION_CMD_TOPICID             APP_A_MISSION_TIDVAL(CMD)
#define DEFAULT_APP_A_MISSION_CMD_TOPICID     0x82
#define APP_A_MISSION_SEND_HK_TOPICID         APP_A_MISSION_TIDVAL(SEND_HK)
#define DEFAULT_APP_A_MISSION_SEND_HK_TOPICID 0x90
#define APP_A_MISSION_HK_TLM_TOPICID          APP_A_MISSION_TIDVAL(HK_TLM)
#define DEFAULT_APP_A_MISSION_HK_TLM_TOPICID  0x82

#endif
