/**
 * AI Assistant & RAG TypeScript definitions matching backend Phase 6 schemas:
 * backend/app/schemas/ai.py
 */

/**
 * Payload sent to POST /api/v1/ai/chat.
 * Backend Pydantic config: extra="forbid", min_length=1, max_length=2000.
 */
export interface ChatRequest {
  message: string;
  conversation_id?: string | null;
}

/**
 * Source citation returned with assistant messages.
 * Matches backend ChatSourceRead schema.
 */
export interface ChatSourceRead {
  chunk_id: string; // UUID
  document_title: string;
  section_title: string | null;
  similarity_score: number;
}

/**
 * Response payload from POST /api/v1/ai/chat.
 * Matches backend ChatResponse schema.
 */
export interface ChatResponse {
  conversation_id: string; // UUID
  message_id: string; // UUID
  response: string;
  sources: ChatSourceRead[];
  user_data_used: string[];
  tokens_used: number;
}

/**
 * Conversation metadata item in list responses.
 * Matches backend ConversationSummaryRead schema.
 */
export interface ConversationSummaryRead {
  id: string; // UUID
  title: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * Detailed message item with optional source citations.
 * Matches backend MessageDetailRead schema.
 */
export interface MessageDetailRead {
  id: string; // UUID
  role: 'user' | 'assistant' | string;
  content: string;
  created_at: string; // ISO 8601
  sources: ChatSourceRead[];
}

/**
 * Full conversation detail with message history.
 * Matches backend ConversationDetailRead schema.
 */
export interface ConversationDetailRead {
  id: string; // UUID
  title: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  messages: MessageDetailRead[];
}

/**
 * Response payload from POST /api/v1/ai/summarise-today.
 * Matches backend DailySummaryResponse schema.
 */
export interface DailySummaryResponse {
  summary: string;
  highlights: string[];
  tokens_used: number;
}

/**
 * Paginated list response from GET /api/v1/ai/conversations.
 * Matches backend ConversationListResponse schema.
 */
export interface ConversationListResponse {
  items: ConversationSummaryRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
