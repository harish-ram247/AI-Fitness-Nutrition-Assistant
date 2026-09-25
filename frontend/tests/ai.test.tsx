import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import type {
  ConversationListResponse,
  ConversationDetailRead,
  ChatResponse,
  DailySummaryResponse,
} from '../src/types/ai';

describe('Phase 8H — AI Assistant & RAG Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-ai-123',
    email: 'athlete@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  const mockConversationsResponse: ConversationListResponse = {
    items: [
      {
        id: 'conv-1111-uuid',
        title: 'Hypertrophy Training Routine',
        created_at: '2026-09-25T08:00:00Z',
        updated_at: '2026-09-25T08:30:00Z',
      },
      {
        id: 'conv-2222-uuid',
        title: 'High Protein Meal Prep Plan',
        created_at: '2026-09-24T12:00:00Z',
        updated_at: '2026-09-24T12:15:00Z',
      },
    ],
    total: 2,
    page: 1,
    size: 20,
    pages: 1,
  };

  const mockConversationDetail: ConversationDetailRead = {
    id: 'conv-1111-uuid',
    title: 'Hypertrophy Training Routine',
    created_at: '2026-09-25T08:00:00Z',
    updated_at: '2026-09-25T08:30:00Z',
    messages: [
      {
        id: 'msg-u1',
        role: 'user',
        content: 'How should I structure my chest workout?',
        created_at: '2026-09-25T08:00:00Z',
        sources: [],
      },
      {
        id: 'msg-a1',
        role: 'assistant',
        content: 'For hypertrophy, start with a heavy compound press followed by incline and isolation flies.',
        created_at: '2026-09-25T08:00:05Z',
        sources: [
          {
            chunk_id: 'chunk-1',
            document_title: 'Evidence-Based Hypertrophy Guide',
            section_title: 'Chest Volume Recommendations',
            similarity_score: 0.88,
          },
        ],
      },
    ],
  };

  const mockChatResponseNew: ChatResponse = {
    conversation_id: 'conv-new-9999',
    message_id: 'msg-a-new-1',
    response: 'Increasing your daily protein to 1.8g/kg supports muscle repair following intense resistance training.',
    sources: [
      {
        chunk_id: 'chunk-protein-1',
        document_title: 'Clinical Nutrition and Sports Metabolism',
        section_title: 'Protein Intake for Athletes',
        similarity_score: 0.92,
      },
      {
        chunk_id: 'chunk-protein-2',
        document_title: 'Dietary Protein Guidelines',
        section_title: 'Timing and Distribution',
        similarity_score: 0.79,
      },
    ],
    user_data_used: ['profile_weight', 'nutrition_totals'],
    tokens_used: 185,
  };

  const mockDailySummary: DailySummaryResponse = {
    summary: 'You reached 150g of protein today, achieving 94% of your daily macro target.',
    highlights: [
      'Calories remained within your 2200 kcal budget.',
      'Protein was well distributed across 3 meals.',
    ],
    tokens_used: 240,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    localStorage.setItem('fitness_access_token', 'valid-test-token');
    localStorage.setItem('fitness_refresh_token', 'valid-refresh-token');

    // Default mock behavior
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations/conv-1111-uuid')) {
        return new Response(JSON.stringify(mockConversationDetail), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      if (url.includes('/api/v1/ai/summarise-today')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderAIAssistant = async () => {
    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /AI Fitness & Nutrition Assistant/i, level: 2 })).toBeInTheDocument();
    });
  };

  // =========================================================================
  // CONVERSATIONS TESTS
  // =========================================================================

  it('1. /ai route is protected and redirects unauthenticated users', async () => {
    localStorage.removeItem('fitness_access_token');
    localStorage.removeItem('fitness_refresh_token');

    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('2. conversation list loads and renders items in sidebar', async () => {
    await renderAIAssistant();

    await waitFor(() => {
      expect(screen.getByText('Hypertrophy Training Routine')).toBeInTheDocument();
      expect(screen.getByText('High Protein Meal Prep Plan')).toBeInTheDocument();
    });
  });

  it('3. conversation empty state renders when no conversations exist', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 20, pages: 0 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    await waitFor(() => {
      expect(
        screen.getByText(/Start a conversation with your AI fitness assistant/i),
      ).toBeInTheDocument();
    });
  });

  it('4. conversation list error + retry renders error message and allows refetching', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Failed to load conversations from DB' }), {
            status: 500,
          });
        }
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to load conversations/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Hypertrophy Training Routine')).toBeInTheDocument();
    });
  });

  it('5. selecting a conversation loads its messages and updates header', async () => {
    await renderAIAssistant();

    const convButton = await screen.findByText('Hypertrophy Training Routine');
    await userEvent.click(convButton);

    await waitFor(() => {
      expect(screen.getByText('How should I structure my chest workout?')).toBeInTheDocument();
      expect(
        screen.getByText(/For hypertrophy, start with a heavy compound press/i),
      ).toBeInTheDocument();
    });

    // Check header
    expect(screen.getByRole('heading', { level: 1, name: 'Hypertrophy Training Routine' })).toBeInTheDocument();
  });

  it('6. conversation delete requires confirmation dialog', async () => {
    await renderAIAssistant();

    const deleteBtn = await screen.findByRole('button', {
      name: /delete conversation hypertrophy training routine/i,
    });
    await userEvent.click(deleteBtn);

    // Modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /delete conversation/i })).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete/i),
      ).toBeInTheDocument();
    });

    // Cancel closes dialog
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Hypertrophy Training Routine')).toBeInTheDocument();
  });

  it('7. successful deletion removes conversation from list and resets active state', async () => {
    let deletedId = '';
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations/conv-1111-uuid') && init?.method === 'DELETE') {
        deletedId = 'conv-1111-uuid';
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/v1/ai/conversations/conv-1111-uuid')) {
        return new Response(JSON.stringify(mockConversationDetail), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    // Select conversation first
    await userEvent.click(screen.getByText('Hypertrophy Training Routine'));
    await screen.findByText('How should I structure my chest workout?');

    // Click delete
    const deleteBtn = screen.getByRole('button', {
      name: /delete conversation hypertrophy training routine/i,
    });
    await userEvent.click(deleteBtn);

    // Confirm deletion
    const modal = screen.getByRole('dialog', { name: /delete conversation/i });
    const confirmBtn = within(modal).getByRole('button', { name: /delete conversation/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletedId).toBe('conv-1111-uuid');
      expect(screen.queryByText('Hypertrophy Training Routine')).not.toBeInTheDocument();
    });

    // Active state reset to New Chat
    expect(screen.getByRole('heading', { level: 1, name: 'New Chat' })).toBeInTheDocument();
  });

  it('8. failed deletion preserves conversation and displays error in modal', async () => {
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations/conv-1111-uuid') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ detail: 'Database error preventing deletion' }), {
          status: 500,
        });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const deleteBtn = screen.getByRole('button', {
      name: /delete conversation hypertrophy training routine/i,
    });
    await userEvent.click(deleteBtn);

    const modal = screen.getByRole('dialog', { name: /delete conversation/i });
    const confirmBtn = within(modal).getByRole('button', { name: /delete conversation/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Database error preventing deletion/i)).toBeInTheDocument();
    });

    // Close modal, conversation still exists
    await userEvent.click(within(modal).getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('Hypertrophy Training Routine')).toBeInTheDocument();
  });

  // =========================================================================
  // CHAT TESTS
  // =========================================================================

  it('9. chat input validation prevents empty submission', async () => {
    await renderAIAssistant();

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    expect(sendBtn).toBeDisabled();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, '    ');
    expect(sendBtn).toBeDisabled();

    await userEvent.type(input, 'Valid question');
    expect(sendBtn).toBeEnabled();
  });

  it('10. sending message uses exact backend request schema (POST /api/v1/ai/chat)', async () => {
    let capturedBody: Record<string, unknown> = {};

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify(mockChatResponseNew), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'How much protein should I eat per day?');

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    await userEvent.click(sendBtn);

    await waitFor(() => {
      expect(capturedBody).toEqual({
        message: 'How much protein should I eat per day?',
      });
    });
  });

  it('11. assistant response renders with response text', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return new Response(JSON.stringify(mockChatResponseNew), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'How much protein?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Increasing your daily protein to 1.8g\/kg supports muscle repair/i),
      ).toBeInTheDocument();
    });
  });

  it('12. user and assistant messages are visually/semantically distinct', async () => {
    await renderAIAssistant();

    await userEvent.click(screen.getByText('Hypertrophy Training Routine'));
    await screen.findByText('How should I structure my chest workout?');

    const userMessageArticle = screen.getByRole('article', { name: /user message/i });
    const assistantMessageArticle = screen.getByRole('article', { name: /assistant message/i });

    expect(userMessageArticle).toBeInTheDocument();
    expect(assistantMessageArticle).toBeInTheDocument();
    expect(within(userMessageArticle).getByText('You')).toBeInTheDocument();
    expect(within(assistantMessageArticle).getByText('AI Assistant')).toBeInTheDocument();
  });

  it('13. chat loading state shows indicator and disables inputs', async () => {
    let resolveChat: (val: Response) => void;
    const chatPromise = new Promise<Response>((resolve) => {
      resolveChat = resolve;
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return chatPromise;
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'Test prompt');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    // Thinking indicator active
    expect(screen.getByText(/Thinking & citing.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();

    // Resolve
    resolveChat!(new Response(JSON.stringify(mockChatResponseNew), { status: 200 }));

    await waitFor(() => {
      expect(screen.queryByText(/Thinking & citing.../i)).not.toBeInTheDocument();
    });
  });

  it('14. chat error preserves user message and does not fabricate assistant response', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return new Response(JSON.stringify({ detail: 'LLM context timeout' }), { status: 504 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'My important question');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/LLM context timeout/i)).toBeInTheDocument();
    });

    // No assistant message was fabricated
    expect(screen.queryByRole('article', { name: /assistant message/i })).not.toBeInTheDocument();
  });

  it('15. retry after chat failure resends user message', async () => {
    let attempts = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        attempts++;
        if (attempts === 1) {
          return new Response(JSON.stringify({ detail: 'Rate limit error' }), { status: 429 });
        }
        return new Response(JSON.stringify(mockChatResponseNew), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'Retriable question');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    // Expect alert and Retry button
    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Increasing your daily protein to 1.8g\/kg supports muscle repair/i),
      ).toBeInTheDocument();
    });
  });

  it('16. conversation ID is passed in subsequent messages in existing conversation', async () => {
    let capturedBody: Record<string, unknown> = {};
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations/conv-1111-uuid')) {
        return new Response(JSON.stringify(mockConversationDetail), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            ...mockChatResponseNew,
            conversation_id: 'conv-1111-uuid',
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    // Select existing conversation
    await userEvent.click(screen.getByText('Hypertrophy Training Routine'));
    await screen.findByText('How should I structure my chest workout?');

    // Send follow-up
    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'What about warm-up sets?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(capturedBody).toEqual({
        message: 'What about warm-up sets?',
        conversation_id: 'conv-1111-uuid',
      });
    });
  });

  // =========================================================================
  // RAG & CITATIONS TESTS
  // =========================================================================

  it('17. source citations render with document title, section, and relevance', async () => {
    await renderAIAssistant();

    await userEvent.click(screen.getByText('Hypertrophy Training Routine'));
    await screen.findByText('How should I structure my chest workout?');

    // Expand citation
    const citeBtn = screen.getByRole('button', { name: /1 Source Citation/i });
    expect(citeBtn).toBeInTheDocument();
    await userEvent.click(citeBtn);

    expect(screen.getByText(/Evidence-Based Hypertrophy Guide/i)).toBeInTheDocument();

    expect(screen.getByText(/Chest Volume Recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/Relevance: 88%/i)).toBeInTheDocument();
  });

  it('18. multiple sources render correctly and can be toggled', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return new Response(JSON.stringify(mockChatResponseNew), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'Protein advice?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    const citeToggle = await screen.findByRole('button', { name: /2 Source Citations/i });
    expect(citeToggle).toBeInTheDocument();

    await userEvent.click(citeToggle);
    expect(screen.getByText(/Clinical Nutrition and Sports Metabolism/i)).toBeInTheDocument();
    expect(screen.getByText(/Dietary Protein Guidelines/i)).toBeInTheDocument();
    expect(screen.getByText(/Relevance: 92%/i)).toBeInTheDocument();
    expect(screen.getByText(/Relevance: 79%/i)).toBeInTheDocument();
  });

  it('19. source metadata matches exact backend response and is not fabricated', async () => {
    await renderAIAssistant();

    await userEvent.click(screen.getByText('Hypertrophy Training Routine'));
    const citeToggle = await screen.findByRole('button', { name: /1 Source Citation/i });
    await userEvent.click(citeToggle);

    expect(
      screen.getByText(/1\. Evidence-Based Hypertrophy Guide/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Section: Chest Volume Recommendations/i)).toBeInTheDocument();
  });

  it('20. unsafe HTML in assistant response is rendered as plain text (escaped)', async () => {
    const maliciousResponse: ChatResponse = {
      ...mockChatResponseNew,
      response: 'Here is advice: <img src="x" onerror="window.hacked=true" /> <script>alert(1)</script>',
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return new Response(JSON.stringify(maliciousResponse), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'Check security');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      // Must be present as text, not executed as DOM element
      expect(
        screen.getByText(/<img src="x" onerror="window\.hacked=true" \/> <script>alert\(1\)<\/script>/i),
      ).toBeInTheDocument();
    });

    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  // =========================================================================
  // AI SUMMARY TESTS
  // =========================================================================

  it('21. daily summary button opens modal and sends request to POST /api/v1/ai/summarise-today', async () => {
    let summaryRequested = false;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/summarise-today')) {
        summaryRequested = true;
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const summaryBtn = screen.getByRole('button', { name: /Today's Nutrition Summary/i });
    await userEvent.click(summaryBtn);

    await waitFor(() => {
      expect(summaryRequested).toBe(true);
      expect(screen.getByRole('dialog', { name: /Daily Nutrition Narrative/i })).toBeInTheDocument();
    });
  });

  it('22. daily summary renders narrative and highlights', async () => {
    await renderAIAssistant();

    await userEvent.click(screen.getByRole('button', { name: /Today's Nutrition Summary/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You reached 150g of protein today, achieving 94% of your daily macro target/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Calories remained within your 2200 kcal budget/i),
      ).toBeInTheDocument();
    });
  });

  it('23. daily summary error allows retry', async () => {
    let attempts = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/summarise-today')) {
        attempts++;
        if (attempts === 1) {
          return new Response(JSON.stringify({ detail: 'No food entries logged today' }), {
            status: 404,
          });
        }
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    await userEvent.click(screen.getByRole('button', { name: /Today's Nutrition Summary/i }));

    await waitFor(() => {
      expect(screen.getByText(/No food entries logged today/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry summary/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/You reached 150g of protein today/i),
      ).toBeInTheDocument();
    });
  });

  it('24. no client-side nutrition calculation is performed by daily summary modal', async () => {
    await renderAIAssistant();

    await userEvent.click(screen.getByRole('button', { name: /Today's Nutrition Summary/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Totals computed by backend\. AI provides narrative review\./i),
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SAFETY & FALLBACK TESTS
  // =========================================================================

  it('25. medical disclaimer renders on page', async () => {
    await renderAIAssistant();

    expect(
      screen.getByText(
        /AI Assistant guidance is based on validated health documents and your logged activities\. Not medical advice\./i,
      ),
    ).toBeInTheDocument();
  });

  it('26. 429 rate limit error displays informative error message', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/ai/chat')) {
        return new Response(
          JSON.stringify({ detail: 'Rate limit exceeded: please slow down' }),
          { status: 429 },
        );
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify(mockConversationsResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderAIAssistant();

    const input = screen.getByLabelText(/ask the ai assistant/i);
    await userEvent.type(input, 'Quick question');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Rate limit exceeded: please slow down/i)).toBeInTheDocument();
    });
  });

  it('27. 401 unauthorized triggers session refresh or error flow', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/auth/refresh')) {
        return new Response(JSON.stringify({ detail: 'Token expired' }), { status: 401 });
      }
      if (url.includes('/api/v1/ai/conversations')) {
        return new Response(JSON.stringify({ detail: 'Invalid token' }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Because refresh fails with 401, session expires and user is redirected to login
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
  });
});
