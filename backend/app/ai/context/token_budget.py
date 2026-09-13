from typing import Any

from app.ai.providers.base import Message


def estimate_tokens(text: str) -> int:
    """Accurate heuristic token estimation based on word and character counts.

    In English text, 1 token is roughly 3.5 characters or 0.75 words (1.3 tokens/word).
    """
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    return max(1, int(chars / 3.5), int(words * 1.3))


class TokenBudgetManager:
    """Manages token budgeting and priority trimming for LLM contexts."""

    def __init__(self, max_tokens: int = 5000) -> None:
        self.max_tokens = max_tokens

    def trim_context(
        self,
        system_prompt: str,
        user_profile_context: str,
        domain_context: str,
        rag_chunks: list[dict[str, Any]],
        conversation_history: list[Message],
        current_query: str,
    ) -> tuple[str, list[dict[str, Any]], list[Message]]:
        """Trim non-essential context tiers when total estimated tokens exceed budget.

        Tiered priority order (lowest priority trimmed first):
        1. Trim oldest conversation history first while retaining at least the latest 3 turns.
        2. Then reduce RAG chunks from 5 to 3, removing the lowest-similarity chunks first.
        3. Then trim lower-priority detailed workout-set context.
        4. Then trim individual meal entries.
        5. Never trim system instructions, core profile basics, or the active goal target.
        """
        working_history = list(conversation_history)
        working_rag = list(rag_chunks)
        working_domain = domain_context

        def total_tokens() -> int:
            # Formatting overhead: ~4 tokens per chat message + 3 priming tokens
            msg_count = len(working_history) + 2  # history + system message + user query
            msg_overhead = msg_count * 4 + 3

            history_tokens = sum(estimate_tokens(m.content) for m in working_history)
            rag_tokens = sum(
                estimate_tokens(
                    f"[{c.get('document_title', '')} - {c.get('section_title', '')}]\n"
                    f"{c.get('content', '')}"
                )
                for c in working_rag
            )
            base_tokens = (
                estimate_tokens(system_prompt)
                + estimate_tokens(user_profile_context)
                + estimate_tokens(working_domain)
                + estimate_tokens(current_query)
            )
            return msg_overhead + history_tokens + rag_tokens + base_tokens

        # Tier 1: Trim conversation history turns older than the last 3 turns
        while len(working_history) > 3 and total_tokens() > self.max_tokens:
            working_history.pop(0)

        # Tier 2: Reduce RAG chunks from 5 down to 3 (removing lowest similarity first)
        while len(working_rag) > 3 and total_tokens() > self.max_tokens:
            working_rag.pop(-1)

        # Tier 3: Trim lower-priority detailed workout-set context if still constrained
        if total_tokens() > self.max_tokens and "Recent Workouts:" in working_domain:
            lines = working_domain.split("\n")
            header = [lines[0]] if lines else []
            sessions = [line for line in lines[1:] if line.startswith("- ")]
            if len(sessions) > 1:
                working_domain = "\n".join(header + [sessions[0]])

        # Tier 4: Trim individual meal entries if still constrained (keep daily totals)
        if total_tokens() > self.max_tokens and "Today's Nutrition" in working_domain:
            lines = working_domain.split("\n")
            totals_lines = [
                item
                for item in lines
                if "Consumed:" in item
                or "Protein:" in item
                or "Carbs:" in item
                or "Fat:" in item
                or "Today's Nutrition" in item
            ]
            working_domain = "\n".join(totals_lines)

        # Truncate any remaining excessive domain text if still over budget
        if total_tokens() > self.max_tokens and len(working_domain) > 300:
            working_domain = working_domain[:300] + "... [context truncated for length]"

        return working_domain, working_rag, working_history
