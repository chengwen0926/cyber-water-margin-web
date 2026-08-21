import { fetchApi } from './client';
import type { ChatContact, ChatScript, DialogueNode } from './types';

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
