import { fetchApi } from './client';
import type { Email } from './types';

export function listEmails(): Promise<Email[]> {
  return fetchApi<Email[]>('/api/email');
}

export function listDownloadedAttachments(): Promise<{ attachment_ids: string[] }> {
  return fetchApi<{ attachment_ids: string[] }>('/api/email/downloaded');
}

export function getEmail(emailId: string): Promise<Email> {
  return fetchApi<Email>(`/api/email/${emailId}`);
}

export function downloadAttachment(
  emailId: string,
  attachmentId: string,
): Promise<{ case_id: string; downloaded: boolean }> {
  return fetchApi(`/api/email/${emailId}/attachments/${attachmentId}/download`, {
    method: 'POST',
  });
}
