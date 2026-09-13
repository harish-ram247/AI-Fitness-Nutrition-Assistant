from app.ai.context.intent import classify_intent
from app.ai.context.token_budget import TokenBudgetManager
from app.ai.providers.base import Message


def test_classify_intent_nutrition() -> None:
    assert classify_intent("How many calories should I eat on rest days?") == "nutrition"
    assert classify_intent("What is my daily protein macro target?") == "nutrition"
    assert classify_intent("I had oatmeal for breakfast and chicken for lunch") == "nutrition"


def test_classify_intent_workout() -> None:
    assert classify_intent("What is progressive overload for bench press?") == "workout"
    assert classify_intent("Can you check my squat sets and reps volume?") == "workout"
    assert classify_intent("How much rest between deadlift heavy sets?") == "workout"


def test_classify_intent_progress() -> None:
    assert classify_intent("Show my scale weigh-in trend over the last month") == "progress"
    assert classify_intent("I hit a weight plateau, why is my body fat not dropping?") == "progress"


def test_classify_intent_general() -> None:
    assert classify_intent("Hello! Who are you?") == "general"
    assert classify_intent("Tell me a motivational quote") == "general"


def test_token_budget_manager_under_budget() -> None:
    manager = TokenBudgetManager(max_tokens=5000)
    history = [
        Message(role="user", content="Hi"),
        Message(role="assistant", content="Hello"),
    ]
    rag_chunks = [
        {"chunk_id": "c1", "content": "RAG chunk 1", "similarity_score": 0.85},
    ]

    d, r, h = manager.trim_context(
        system_prompt="System prompt",
        user_profile_context="User profile",
        domain_context="Domain context",
        rag_chunks=rag_chunks,
        conversation_history=history,
        current_query="What is protein?",
    )

    assert len(h) == 2
    assert len(r) == 1
    assert d == "Domain context"


def test_token_budget_manager_trims_old_history_first() -> None:
    # Set small budget that forces trimming
    manager = TokenBudgetManager(max_tokens=100)
    history = [
        Message(role="user", content="Turn 1 " + "x" * 50),
        Message(role="assistant", content="Turn 2 " + "x" * 50),
        Message(role="user", content="Turn 3 " + "x" * 50),
        Message(role="assistant", content="Turn 4 " + "x" * 50),
        Message(role="user", content="Turn 5 " + "x" * 50),
    ]
    rag_chunks = [
        {"chunk_id": "c1", "content": "Chunk 1", "similarity_score": 0.90},
        {"chunk_id": "c2", "content": "Chunk 2", "similarity_score": 0.80},
    ]

    _, _, trimmed_history = manager.trim_context(
        system_prompt="Sys",
        user_profile_context="Profile",
        domain_context="Domain",
        rag_chunks=rag_chunks,
        conversation_history=history,
        current_query="Query",
    )

    # Retains at least 3 turns, older turns popped from front
    assert len(trimmed_history) == 3
    assert "Turn 3" in trimmed_history[0].content


def test_token_budget_manager_trims_rag_chunks() -> None:
    manager = TokenBudgetManager(max_tokens=80)
    history = [
        Message(role="user", content="Turn 1"),
        Message(role="assistant", content="Turn 2"),
        Message(role="user", content="Turn 3"),
    ]
    rag_chunks = [
        {"chunk_id": "c1", "content": "High score chunk " + "x" * 50, "similarity_score": 0.95},
        {"chunk_id": "c2", "content": "Med score chunk " + "x" * 50, "similarity_score": 0.85},
        {"chunk_id": "c3", "content": "Low score chunk " + "x" * 50, "similarity_score": 0.75},
        {"chunk_id": "c4", "content": "Lowest score chunk " + "x" * 50, "similarity_score": 0.70},
        {"chunk_id": "c5", "content": "Drop me chunk " + "x" * 50, "similarity_score": 0.65},
    ]

    _, trimmed_rag, _ = manager.trim_context(
        system_prompt="Sys",
        user_profile_context="Profile",
        domain_context="Domain",
        rag_chunks=rag_chunks,
        conversation_history=history,
        current_query="Query",
    )

    # Chunks trimmed down to 3, lowest similarity popped first
    assert len(trimmed_rag) == 3
    assert trimmed_rag[0]["chunk_id"] == "c1"
    assert trimmed_rag[1]["chunk_id"] == "c2"
    assert trimmed_rag[2]["chunk_id"] == "c3"
