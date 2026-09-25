/**
 * AI Assistant & RAG API Client.
 * Communicates with backend /api/v1/ai endpoints.
 */

import { apiClient } from '../../api/client';
import type {
  ChatRequest,
  ChatResponse,
  ConversationDetailRead,
  ConversationListResponse,
  DailySummaryResponse,
} from '../../types/ai';

export const aiApi = {
  /**
   * List all AI conversations for the current user (paginated).
   * GET /api/v1/ai/conversations
   */
  async listConversations(page = 1, size = 20): Promise<ConversationListResponse> {
    return apiClient.get<ConversationListResponse>('/api/v1/ai/conversations', {
      params: { page, size },
    });
  },

  /**
   * Fetch conversation details and full message history.
   * GET /api/v1/ai/conversations/{conversation_id}
   */
  async getConversation(conversationId: string): Promise<ConversationDetailRead> {
    return apiClient.get<ConversationDetailRead>(
      `/api/v1/ai/conversations/${encodeURIComponent(conversationId)}`,
    );
  },

  /**
   * Send a chat message to the AI Assistant.
   * Automatically creates a new conversation if conversation_id is omitted.
   * POST /api/v1/ai/chat
   */
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const payload: { message: string; conversation_id?: string } = {
      message: request.message,
    };
    if (request.conversation_id) {
      payload.conversation_id = request.conversation_id;
    }

    return apiClient.post<ChatResponse>('/api/v1/ai/chat', payload);
  },

  /**
   * Delete an existing conversation and all its messages.
   * DELETE /api/v1/ai/conversations/{conversation_id}
   */
  async deleteConversation(conversationId: string): Promise<void> {
    return apiClient.delete<void>(
      `/api/v1/ai/conversations/${encodeURIComponent(conversationId)}`,
    );
  },

  /**
   * Request an AI narrative summary and highlights for today's (or given date's) nutrition.
   * POST /api/v1/ai/summarise-today
   */
  async summariseToday(targetDate?: string): Promise<DailySummaryResponse> {
    const params = targetDate ? { date: targetDate } : undefined;
    return apiClient.post<DailySummaryResponse>('/api/v1/ai/summarise-today', undefined, {
      params,
    });
  },
};
