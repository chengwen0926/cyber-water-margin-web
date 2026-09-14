import { fetchApi } from './client';
import type { ChatContact, ChatScript, ChatSession, DialogueNode } from './types';

export function getChatScript(scriptId: string): Promise<ChatScript> {
  return fetchApi<ChatScript>(`/api/chat/scripts/${scriptId}`);
}

export function getCurrentNode(scriptId: string): Promise<DialogueNode> {
  return fetchApi<DialogueNode>(`/api/chat/${scriptId}/current`);
}

export function listChatContacts(): Promise<ChatContact[]> {
  return fetchApi<ChatContact[]>('/api/chat/contacts');
}

export function advanceChat(
  scriptId: string,
  optionId: string | null,
): Promise<DialogueNode> {
  return fetchApi<DialogueNode>(`/api/chat/${scriptId}/advance`, {
    method: 'POST',
    body: JSON.stringify({ option_id: optionId }),
  });
}

export function getChatSession(contactId: string, scriptId: string): Promise<ChatSession> {
  return fetchApi<ChatSession>(`/api/chat/sessions/${encodeURIComponent(contactId)}?script_id=${encodeURIComponent(scriptId)}`);
}

export function advanceChatSession(contactId: string, scriptId: string, optionId: string, expectedNodeId: string): Promise<ChatSession> {
  return fetchApi<ChatSession>(`/api/chat/sessions/${encodeURIComponent(contactId)}/advance`, {
    method: 'POST', body: JSON.stringify({ script_id: scriptId, option_id: optionId, expected_node_id: expectedNodeId }),
  });
}

export function sendChatMessage(contactId: string, scriptId: string, text: string, expectedNodeId: string, expectedMessageCount: number): Promise<ChatSession> {
  return fetchApi<ChatSession>(`/api/chat/sessions/${encodeURIComponent(contactId)}/messages`, {
    method: 'POST', body: JSON.stringify({script_id:scriptId, text, expected_node_id:expectedNodeId, expected_message_count:expectedMessageCount}),
  });
}
