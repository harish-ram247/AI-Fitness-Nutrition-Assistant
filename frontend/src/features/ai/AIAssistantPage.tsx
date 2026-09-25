import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiApi } from './aiApi';
import type {
  ConversationSummaryRead,
  MessageDetailRead,
  ChatSourceRead,
} from '../../types/ai';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ChatMessageItem } from './components/ChatMessageItem';
import { ChatComposer } from './components/ChatComposer';
import { DeleteConversationModal } from './components/DeleteConversationModal';
import { DailySummaryModal } from './components/DailySummaryModal';
import { getErrorMessage } from '../../utils/errorHandling';

interface EnhancedMessage extends MessageDetailRead {
  userDataUsed?: string[];
  tokensUsed?: number;
}

const STARTER_PROMPTS = [
  'How does my protein intake today look relative to my goals?',
  'Suggest exercise alternatives for bench press using dumbbells.',
  'How can I structure my weekly workouts for muscle hypertrophy?',
];

export const AIAssistantPage: React.FC = () => {
  // Conversation list state
  const [conversations, setConversations] = useState<ConversationSummaryRead[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  // Active conversation state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>('New Chat');
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Message sending state
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Daily summary modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  // Mobile sidebar drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Message scroll anchor
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sendingMessage]);

  // Load conversations list
  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationsError(null);
    try {
      const res = await aiApi.listConversations();
      setConversations(res.items || []);
    } catch (err) {
      setConversationsError(getErrorMessage(err, 'Failed to load conversations.'));
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  // Load active conversation messages when selected
  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
    setLoadingHistory(true);
    setHistoryError(null);
    setSendError(null);

    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveTitle(conv.title || 'Conversation');
    }

    try {
      const detail = await aiApi.getConversation(id);
      setActiveTitle(detail.title || 'Conversation');
      setMessages(
        detail.messages.map((m) => ({
          ...m,
          sources: m.sources || [],
        })),
      );
    } catch (err) {
      setHistoryError(getErrorMessage(err, 'Failed to load conversation history.'));
    } finally {
      setLoadingHistory(false);
    }
  }, [conversations]);

  // Switch to New Chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveTitle('New Chat');
    setMessages([]);
    setSendError(null);
    setHistoryError(null);
    setLastFailedMessage(null);
    setMobileSidebarOpen(false);
  };

  // Send message
  const handleSendMessage = async (userText: string) => {
    setSendingMessage(true);
    setSendError(null);
    setLastFailedMessage(null);

    // Optimistic user message
    const tempUserMsg: EnhancedMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString(),
      sources: [],
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await aiApi.sendChatMessage({
        message: userText,
        conversation_id: activeConversationId || undefined,
      });

      // Assistant message
      const assistantMsg: EnhancedMessage = {
        id: res.message_id,
        role: 'assistant',
        content: res.response,
        created_at: new Date().toISOString(),
        sources: (res.sources || []) as ChatSourceRead[],
        userDataUsed: res.user_data_used || [],
        tokensUsed: res.tokens_used,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If this was a new conversation, update active conversation ID and refresh sidebar
      if (!activeConversationId && res.conversation_id) {
        setActiveConversationId(res.conversation_id);
        void fetchConversations();
      }
    } catch (err) {
      setLastFailedMessage(userText);
      const msg = getErrorMessage(err, 'Failed to get a response from AI Assistant.');
      setSendError(msg);
      // Remove optimistic message on failure so it can be retried cleanly
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      throw err;
    } finally {
      setSendingMessage(false);
    }
  };

  // Retry sending failed message
  const handleRetryFailed = () => {
    if (lastFailedMessage) {
      void handleSendMessage(lastFailedMessage);
    }
  };

  // Request deletion confirmation
  const handleRequestDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteError(null);
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await aiApi.deleteConversation(deleteTarget.id);

      // If active conversation was deleted, reset to new chat
      if (activeConversationId === deleteTarget.id) {
        handleNewChat();
      }

      // Remove from sidebar list
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete conversation.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 70px)',
        maxHeight: 'calc(100vh - 70px)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 30,
          }}
        />
      )}

      {/* Sidebar (Desktop fixed width / Mobile sliding drawer) */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          height: '100%',
          position: mobileSidebarOpen ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: mobileSidebarOpen ? 40 : 1,
          display: 'flex',
          flexDirection: 'column',
        }}
        className="ai-sidebar-container"
      >
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          loading={loadingConversations}
          error={conversationsError}
          onSelectConversation={(id) => void handleSelectConversation(id)}
          onNewChat={handleNewChat}
          onRequestDelete={handleRequestDelete}
          onRetry={() => void fetchConversations()}
          onOpenDailySummary={() => setSummaryModalOpen(true)}
        />
      </div>

      {/* Embedded Sidebar for Desktop (Always visible on screens >= 768px) */}
      <style>{`
        @media (min-width: 768px) {
          .ai-sidebar-container {
            display: block !important;
            position: relative !important;
            z-index: 1 !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Chat Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          backgroundColor: 'var(--bg-default, #0f172a)',
          overflow: 'hidden',
        }}
      >
        {/* Chat Header */}
        <header
          style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle, #1f2937)',
            backgroundColor: 'var(--bg-surface, #111827)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              className="btn btn-secondary mobile-menu-btn"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle conversations sidebar"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.875rem' }}
            >
              ☰
            </button>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-base, 1rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #f9fafb)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '300px',
                }}
              >
                {activeTitle}
              </h1>
              <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)' }}>
                {activeConversationId ? 'Active Conversation' : 'Ready to start'}
              </span>
            </div>
          </div>

          {/* Quick Action: Daily Nutrition Summary */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSummaryModalOpen(true)}
            style={{
              fontSize: 'var(--font-size-xs, 0.75rem)',
              padding: '0.35rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>🥗</span>
            <span>Nutrition Summary</span>
          </button>
        </header>

        {/* Message Stream */}
        <div
          role="region"
          aria-label="Conversation messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Loading History State */}
          {loadingHistory && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary, #9ca3af)' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: '28px',
                  height: '28px',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: 'var(--color-primary, #3b82f6)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '0.75rem',
                }}
              />
              <p style={{ margin: 0, fontSize: 'var(--font-size-sm, 0.875rem)' }}>Loading conversation...</p>
            </div>
          )}

          {/* Error Loading History */}
          {historyError && !loadingHistory && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div
                role="alert"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--color-danger, #ef4444)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem',
                  color: '#fca5a5',
                  marginBottom: '1rem',
                  maxWidth: '400px',
                  margin: '0 auto 1rem auto',
                }}
              >
                {historyError}
              </div>
              {activeConversationId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleSelectConversation(activeConversationId)}
                >
                  Retry Loading
                </button>
              )}
            </div>
          )}

          {/* Empty Chat State */}
          {!loadingHistory && !historyError && messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                maxWidth: '550px',
                margin: '0 auto',
                padding: '2rem 1rem',
              }}
            >
              <div
                style={{
                  fontSize: '2.5rem',
                  marginBottom: '1rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '1rem',
                  borderRadius: '50%',
                  display: 'inline-flex',
                }}
              >
                🤖
              </div>
              <h2
                style={{
                  fontSize: 'var(--font-size-xl, 1.25rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary, #f9fafb)',
                  marginBottom: '0.5rem',
                }}
              >
                AI Fitness &amp; Nutrition Assistant
              </h2>
              <p
                style={{
                  color: 'var(--text-secondary, #9ca3af)',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                  lineHeight: 1.5,
                  marginBottom: '1.5rem',
                }}
              >
                Ask about your nutrition, workouts, or progress.
              </p>

              {/* Starter Prompts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%' }}>
                {STARTER_PROMPTS.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleSendMessage(promptText)}
                    disabled={sendingMessage}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle, #374151)',
                      borderRadius: 'var(--radius-md, 8px)',
                      color: 'var(--text-primary, #e2e8f0)',
                      fontSize: 'var(--font-size-xs, 0.8125rem)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary, #3b82f6)';
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle, #374151)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    💬 {promptText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render Messages */}
          {!loadingHistory &&
            messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.created_at}
                sources={msg.sources}
                userDataUsed={msg.userDataUsed}
                tokensUsed={msg.tokensUsed}
              />
            ))}

          {/* Assistant Generating Indicator */}
          {sendingMessage && (
            <div
              aria-label="Assistant is thinking"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-surface, #1e293b)',
                border: '1px solid var(--border-subtle, #334155)',
                borderRadius: '16px 16px 16px 4px',
                maxWidth: '220px',
                marginBottom: '1rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: '#a78bfa',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-secondary, #94a3b8)' }}>
                Thinking &amp; citing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* AI Disclaimer Banner */}
        <div
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: 'var(--font-size-xs, 0.6875rem)',
            color: 'var(--text-muted, #64748b)',
            textAlign: 'center',
          }}
        >
          AI Assistant guidance is based on validated health documents and your logged activities. Not medical advice.
        </div>

        {/* Message Composer */}
        <ChatComposer
          onSend={handleSendMessage}
          disabled={sendingMessage || loadingHistory}
          error={sendError}
          onRetry={lastFailedMessage ? handleRetryFailed : undefined}
        />
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConversationModal
        isOpen={deleteTarget !== null}
        conversationTitle={deleteTarget?.title || ''}
        isDeleting={isDeleting}
        error={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      {/* Daily Nutrition Summary Modal */}
      <DailySummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
      />
    </div>
  );
};
