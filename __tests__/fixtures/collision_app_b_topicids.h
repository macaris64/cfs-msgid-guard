/************************************************************************
 * Mock: Collision test - App B ALSO claims topic ID 0x82 for CMD
 * This creates an intentional collision with App A.
 ************************************************************************/
#ifndef MOCK_APP_B_TOPICIDS_H
#define MOCK_APP_B_TOPICIDS_H

#define APP_B_MISSION_CMD_TOPICID             APP_B_MISSION_TIDVAL(CMD)
#define DEFAULT_APP_B_MISSION_CMD_TOPICID     0x82
#define APP_B_MISSION_SEND_HK_TOPICID         APP_B_MISSION_TIDVAL(SEND_HK)
#define DEFAULT_APP_B_MISSION_SEND_HK_TOPICID 0x91
#define APP_B_MISSION_HK_TLM_TOPICID          APP_B_MISSION_TIDVAL(HK_TLM)
#define DEFAULT_APP_B_MISSION_HK_TLM_TOPICID  0x90

#endif
