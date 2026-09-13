# Testing Strategy
## AI-Powered Personalized Fitness & Nutrition Assistant

**Version:** 1.0  
**Status:** Draft — Phase 0  
**Date:** 2026-09-10

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Pyramid](#test-pyramid)
3. [Backend Unit Tests](#backend-unit-tests)
4. [Backend Integration Tests](#backend-integration-tests)
5. [API Tests (End-to-End API)](#api-tests)
6. [Database / Repository Tests](#database--repository-tests)
7. [AI Tests](#ai-tests)
8. [RAG Tests](#rag-tests)
9. [Frontend Tests](#frontend-tests)
10. [AI/RAG Evaluation vs. Conventional Testing](#airag-evaluation-vs-conventional-testing)
11. [Test Infrastructure](#test-infrastructure)
12. [CI/CD Integration](#cicd-integration)
13. [Coverage Targets](#coverage-targets)

---

## 1. Testing Philosophy

### Core Principles

1. **Test behaviour, not implementation** — Tests verify that the system does the right thing, not that it calls a specific function
2. **Deterministic calculation is fully tested** — Nutrition math has zero tolerance for bugs
3. **AI/LLM output is not tested for exact values** — Test structure, safety, and failure handling
4. **Fast tests run frequently** — Unit tests in < 1 minute; integration tests in < 5 minutes
5. **Mock external dependencies in unit tests** — LLM API, embedding API; use real DB in integration
6. **Tests document expected behaviour** — Test names describe the scenario precisely

---

## 2. Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E / API     │  ← Few, slow, high-value
                    │     Tests       │
                   ┌┴─────────────────┴┐
                   │  Integration Tests │  ← Medium number, real DB
                  ┌┴───────────────────┴┐
                  │    Unit Tests        │  ← Many, fast, mocked deps
                  └──────────────────────┘

                     AI/RAG Evaluation    ← Separate track (not pytest)
```

| Layer | Count | Speed | Dependencies |
|-------|-------|-------|-------------|
| Unit tests | 200+ | < 1 min | Mocked DB, mocked LLM |
| Integration tests | 50+ | < 5 min | Real test DB, mocked LLM |
| API tests | 30+ | < 10 min | Full stack, mocked LLM |
| RAG evaluation | Offline | Minutes | Real embeddings, real vectors |

---

## 3. Backend Unit Tests

### 3.1 What to Unit Test

| Component | What to Test |
|-----------|-------------|
| `utils/nutrition_calculator.py` | All macro calculations; edge cases |
| `services/*.py` | Business logic; mocked repositories |
| `ai/context/builder.py` | Context assembly; token budget management |
| `ai/parsers/*.py` | Structured output parsing; malformed input handling |
| `core/security.py` | Password hashing; JWT generation and validation |
| `schemas/*.py` | Pydantic validation rules |

### 3.2 Nutrition Calculator Tests

```python
# tests/unit/test_nutrition_calculator.py

class TestCalculateMacros:
    def test_calculates_protein_correctly_for_100g(self):
        food = FoodItemFactory(protein_per_100g=25.0)
        result = calculate_macros(food, quantity_g=100)
        assert result.protein_g == 25.0

    def test_scales_correctly_for_partial_serving(self):
        food = FoodItemFactory(protein_per_100g=25.0, calories_per_100g=200)
        result = calculate_macros(food, quantity_g=50)
        assert result.protein_g == pytest.approx(12.5, abs=0.01)
        assert result.calories == pytest.approx(100.0, abs=0.01)

    def test_handles_zero_quantity(self):
        food = FoodItemFactory(protein_per_100g=25.0)
        with pytest.raises(ValueError, match="Quantity must be positive"):
            calculate_macros(food, quantity_g=0)

    def test_rounds_to_two_decimal_places(self):
        food = FoodItemFactory(protein_per_100g=10.0)
        result = calculate_macros(food, quantity_g=33)
        assert result.protein_g == pytest.approx(3.30, abs=0.01)

class TestCalculateTDEE:
    def test_mifflin_st_jeor_male(self):
        """BMR for 30-year-old male, 80kg, 178cm = 1848 kcal; moderately active × 1.55 = 2864"""
        tdee = calculate_tdee(
            weight_kg=80, height_cm=178, age=30,
            sex="male", activity_level="moderately_active"
        )
        assert tdee == pytest.approx(2864, abs=10)

    def test_mifflin_st_jeor_female(self):
        tdee = calculate_tdee(
            weight_kg=65, height_cm=165, age=28,
            sex="female", activity_level="lightly_active"
        )
        assert tdee == pytest.approx(1957, abs=10)

class TestDailyRemaining:
    def test_calculates_remaining_correctly(self):
        remaining = calculate_remaining(
            targets=MacroTargets(calories=2200, protein_g=165, carbs_g=220, fat_g=73),
            consumed=MacroTotals(calories=1450, protein_g=98, carbs_g=162, fat_g=44)
        )
        assert remaining.calories == 750
        assert remaining.protein_g == pytest.approx(67.0, abs=0.1)

    def test_remaining_can_be_negative(self):
        """Users can exceed targets; remaining should show negative"""
        remaining = calculate_remaining(
            targets=MacroTargets(calories=2200, protein_g=165),
            consumed=MacroTotals(calories=2500, protein_g=170)
        )
        assert remaining.calories == -300
        assert remaining.protein_g == pytest.approx(-5.0, abs=0.1)
```

### 3.3 Service Tests (Mocked Repositories)

```python
# tests/unit/test_nutrition_service.py

class TestNutritionService:
    @pytest.fixture
    def service(self, mock_food_repo, mock_nutrition_repo, mock_goal_repo):
        return NutritionService(mock_food_repo, mock_nutrition_repo, mock_goal_repo)

    async def test_log_food_entry_calculates_macros_from_db(self, service, mock_food_repo, mock_nutrition_repo):
        food = FoodItemFactory(protein_per_100g=31.0, calories_per_100g=165.0)
        mock_food_repo.get_by_id.return_value = food

        await service.log_food_entry(user_id=uuid4(), entry_data=FoodEntryCreate(
            food_item_id=food.id, quantity_g=174.0, meal_type="lunch"
        ), db=mock_db)

        # Verify macro calculation was deterministic
        call_args = mock_nutrition_repo.create_entry.call_args
        assert call_args.kwargs["protein_g"] == pytest.approx(53.94, abs=0.1)
        assert call_args.kwargs["calories"] == pytest.approx(286.95, abs=0.1)

    async def test_log_food_entry_raises_when_food_not_found(self, service, mock_food_repo):
        mock_food_repo.get_by_id.return_value = None
        with pytest.raises(FoodItemNotFoundError):
            await service.log_food_entry(user_id=uuid4(), entry_data=..., db=mock_db)
```

### 3.4 JWT Tests

```python
class TestJWTSecurity:
    def test_creates_valid_access_token(self):
        user_id = uuid4()
        token = create_access_token(subject=str(user_id))
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "access"

    def test_expired_token_raises_error(self):
        token = create_access_token(subject=str(uuid4()), expires_delta=timedelta(seconds=-1))
        with pytest.raises(JWTError):
            decode_token(token)

    def test_tampered_token_raises_error(self):
        token = create_access_token(subject=str(uuid4()))
        tampered = token[:-5] + "xxxxx"
        with pytest.raises(JWTError):
            decode_token(tampered)
```

---

## 4. Backend Integration Tests

### 4.1 Setup

- Use a dedicated test PostgreSQL database (separate from development)
- SQLAlchemy `create_all()` for schema; Alembic migrations for migration tests
- LLM is mocked (no real API calls in integration tests)
- Each test runs in a transaction that is rolled back after the test

```python
# tests/conftest.py
@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(settings.TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db(engine):
    async with AsyncSession(engine) as session:
        async with session.begin():
            yield session
            await session.rollback()  # Never commits; always rolls back
```

### 4.2 Integration Test Examples

```python
# tests/integration/test_nutrition_integration.py

class TestFoodEntryIntegration:
    async def test_daily_totals_aggregate_correctly(self, db):
        user = await UserFactory.create(db)
        food_a = await FoodItemFactory.create(db, protein_per_100g=25.0, calories_per_100g=200)
        food_b = await FoodItemFactory.create(db, protein_per_100g=10.0, calories_per_100g=100)

        await create_food_entry(db, user_id=user.id, food_item=food_a, quantity_g=100)
        await create_food_entry(db, user_id=user.id, food_item=food_b, quantity_g=200)

        summary = await nutrition_service.get_daily_summary(db, user.id, date.today())

        assert summary.totals.protein_g == pytest.approx(45.0, abs=0.1)  # 25 + 20
        assert summary.totals.calories == pytest.approx(400.0, abs=0.1)  # 200 + 200

    async def test_deleted_entries_excluded_from_totals(self, db):
        user = await UserFactory.create(db)
        food = await FoodItemFactory.create(db, protein_per_100g=25.0)
        entry = await create_food_entry(db, user_id=user.id, food_item=food, quantity_g=100)

        await nutrition_service.delete_entry(db, entry_id=entry.id, user_id=user.id)
        summary = await nutrition_service.get_daily_summary(db, user.id, date.today())

        assert summary.totals.protein_g == 0.0

    async def test_user_isolation_between_users(self, db):
        user_a = await UserFactory.create(db)
        user_b = await UserFactory.create(db)
        food = await FoodItemFactory.create(db, calories_per_100g=200)

        await create_food_entry(db, user_id=user_a.id, food_item=food, quantity_g=100)

        summary_b = await nutrition_service.get_daily_summary(db, user_b.id, date.today())
        assert summary_b.totals.calories == 0.0  # User B sees no data from User A
```

---

## 5. API Tests

### 5.1 Full HTTP Stack Tests

Use `httpx.AsyncClient` with FastAPI `TestClient`:

```python
# tests/e2e/test_auth_api.py

class TestAuthAPI:
    async def test_register_creates_user(self, client):
        response = await client.post("/api/v1/auth/register", json={
            "email": "test@example.com",
            "password": "SecurePass123!"
        })
        assert response.status_code == 201
        assert response.json()["email"] == "test@example.com"
        assert "password" not in response.json()
        assert "hashed_password" not in response.json()

    async def test_register_duplicate_email_returns_409(self, client):
        await client.post("/api/v1/auth/register", json={"email": "dup@example.com", "password": "Pass123!"})
        response = await client.post("/api/v1/auth/register", json={"email": "dup@example.com", "password": "Pass456!"})
        assert response.status_code == 409

    async def test_login_returns_tokens(self, client, registered_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": registered_user.email,
            "password": "SecurePass123!"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert "refresh_token" in response.json()

    async def test_protected_route_requires_auth(self, client):
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401

    async def test_user_cannot_access_other_users_food_entry(self, client, user_a_token, user_b_entry):
        response = await client.delete(
            f"/api/v1/nutrition/entries/{user_b_entry.id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        assert response.status_code == 403
```

---

## 6. Database / Repository Tests

### 6.1 Repository Tests

```python
# tests/integration/test_food_repository.py

class TestFoodRepository:
    async def test_search_by_name_finds_exact_match(self, db):
        food = await FoodItemFactory.create(db, name="Chicken Breast")
        results = await food_repo.search(db, query="Chicken Breast")
        assert any(r.id == food.id for r in results)

    async def test_search_is_case_insensitive(self, db):
        await FoodItemFactory.create(db, name="Greek Yogurt")
        results = await food_repo.search(db, query="greek yogurt")
        assert len(results) > 0

    async def test_soft_deleted_items_not_returned(self, db):
        food = await FoodItemFactory.create(db, name="Deleted Food")
        await food_repo.soft_delete(db, food.id)
        results = await food_repo.search(db, query="Deleted Food")
        assert not any(r.id == food.id for r in results)
```

### 6.2 Migration Tests

```python
# tests/integration/test_migrations.py

async def test_migrations_apply_cleanly(fresh_db_engine):
    """Verify that all Alembic migrations apply without error."""
    await run_alembic_upgrade(fresh_db_engine, revision="head")

async def test_migrations_are_reversible(fresh_db_engine):
    """Verify that downgrade migrations work."""
    await run_alembic_upgrade(fresh_db_engine, revision="head")
    await run_alembic_downgrade(fresh_db_engine, revision="base")
```

---

## 7. AI Tests

### 7.1 Structured Output Parsing Tests

The most critical AI tests verify that the parser correctly handles LLM output:

```python
# tests/unit/test_food_extraction_parser.py

class TestFoodExtractionParser:
    def test_parses_valid_extraction_correctly(self):
        llm_json = {
            "food_mentions": [
                {"raw_text": "3 eggs", "food_name": "egg", "quantity": 3, "unit": "whole", "confidence": "high"},
            ]
        }
        result = FoodExtractionResult.model_validate(llm_json)
        assert len(result.food_mentions) == 1
        assert result.food_mentions[0].quantity == 3

    def test_handles_empty_food_mentions(self):
        result = FoodExtractionResult.model_validate({"food_mentions": [], "ambiguous": []})
        assert result.food_mentions == []

    def test_raises_on_negative_quantity(self):
        with pytest.raises(ValidationError):
            FoodExtractionResult.model_validate({
                "food_mentions": [{"food_name": "egg", "quantity": -1, "unit": "whole", "confidence": "high"}]
            })

    def test_handles_malformed_llm_response(self):
        """What happens when LLM returns unexpected structure?"""
        with pytest.raises(ValidationError):
            FoodExtractionResult.model_validate({"unexpected_key": "value"})
```

### 7.2 Prompt Tests

```python
# tests/unit/test_prompts.py

class TestFoodExtractionPrompt:
    def test_prompt_includes_safety_instruction(self):
        prompt = build_food_extraction_prompt("I had eggs")
        system_msg = next(m for m in prompt if m.role == "system")
        assert "Do NOT invent nutritional data" in system_msg.content

    def test_prompt_includes_user_text(self):
        prompt = build_food_extraction_prompt("I had 3 eggs and toast")
        user_msg = next(m for m in prompt if m.role == "user")
        assert "3 eggs and toast" in user_msg.content

class TestAssistantSystemPrompt:
    def test_safety_boundaries_present(self):
        prompt = build_system_prompt()
        assert "medical professional" in prompt.lower()
        assert "consult a doctor" in prompt.lower() or "healthcare professional" in prompt.lower()

    def test_data_integrity_rule_present(self):
        prompt = build_system_prompt()
        assert "do not invent" in prompt.lower() or "do not fabricate" in prompt.lower()
```

### 7.3 Context Builder Tests

```python
class TestAIContextBuilder:
    def test_respects_token_budget(self):
        builder = AIContextBuilder()
        # Create context items that together exceed the budget
        large_history = [AIMessage(content="x" * 1000) for _ in range(20)]
        context = builder.build(
            user_profile=minimal_profile,
            rag_chunks=[],
            conversation_history=large_history,
            budget=TokenBudget(max_context_tokens=2000),
        )
        # Context should not exceed budget (approximate check)
        estimated_tokens = len(context) // 4
        assert estimated_tokens <= 2100  # Allow small buffer

    def test_always_includes_profile(self):
        context = builder.build(user_profile=profile, ...)
        assert profile.first_name in context
```

### 7.4 AI Failure Handling Tests

```python
class TestAIOrchestrator:
    async def test_handles_llm_timeout_gracefully(self, mock_llm_provider):
        mock_llm_provider.complete.side_effect = asyncio.TimeoutError()
        with pytest.raises(AIServiceError) as exc_info:
            await orchestrator.chat(message="test", ...)
        assert exc_info.value.status_code == 503

    async def test_retries_on_rate_limit(self, mock_llm_provider):
        mock_llm_provider.complete.side_effect = [
            RateLimitError("rate limit"),
            LLMResponse(content="success", ...)  # Second attempt succeeds
        ]
        result = await orchestrator.chat(message="test", ...)
        assert result.content == "success"
        assert mock_llm_provider.complete.call_count == 2
```

---

## 8. RAG Tests

### 8.1 Retrieval Tests

```python
# tests/integration/test_rag_retrieval.py

class TestRAGRetrieval:
    async def test_retrieves_relevant_chunks_for_protein_query(self, db_with_knowledge_base):
        """Integration test: real embeddings, real pgvector"""
        chunks = await retriever.retrieve("protein requirements for muscle building", top_k=3)
        assert len(chunks) > 0
        assert all(c.similarity_score >= 0.70 for c in chunks)

    async def test_metadata_filter_applied(self, db_with_knowledge_base):
        chunks = await retriever.retrieve(
            "training frequency", top_k=5, topic_filter=["training"]
        )
        assert all(c.topic_category == "training" for c in chunks)

    async def test_irrelevant_query_returns_empty_or_low_similarity(self, db_with_knowledge_base):
        chunks = await retriever.retrieve(
            "quantum mechanics and black holes", top_k=5, min_similarity=0.80
        )
        # An off-topic query should return few/no results above threshold
        assert len(chunks) == 0
```

### 8.2 Ingestion Pipeline Tests

```python
class TestRAGIngestion:
    async def test_document_is_chunked_correctly(self):
        document_text = "Section 1\n\n" + ("word " * 200) + "\n\nSection 2\n\n" + ("word " * 200)
        chunks = chunker.chunk(document_text, chunk_size=100, chunk_overlap=10)
        assert len(chunks) > 1
        assert all(len(c.content) > 0 for c in chunks)

    async def test_chunks_stored_with_embeddings(self, db):
        doc = KnowledgeDocumentFactory.build()
        await ingestor.ingest(db, doc, content="Protein is essential for muscle repair...")
        chunks = await knowledge_repo.get_chunks_for_document(db, doc.id)
        assert len(chunks) > 0
        assert all(c.embedding is not None for c in chunks)
        assert all(len(c.embedding) == 1536 for c in chunks)

    async def test_re_ingestion_replaces_old_chunks(self, db):
        doc = await KnowledgeDocumentFactory.create(db)
        await ingestor.ingest(db, doc, content="Original content")
        first_chunk_ids = {c.id for c in await knowledge_repo.get_chunks_for_document(db, doc.id)}

        await ingestor.ingest(db, doc, content="Updated content")
        new_chunk_ids = {c.id for c in await knowledge_repo.get_chunks_for_document(db, doc.id)}

        assert first_chunk_ids.isdisjoint(new_chunk_ids)  # No overlap — old chunks replaced
```

### 8.3 Relevance Evaluation (Offline — Not pytest)

```python
# scripts/evaluate_rag.py
# Run: python scripts/evaluate_rag.py

EVALUATION_DATASET = [
    {
        "query": "How much protein do I need to build muscle?",
        "expected_topic": "nutrition",
        "relevant_keywords": ["protein", "muscle", "g/kg", "synthesis"],
    },
    {
        "query": "How often should I train each muscle group?",
        "expected_topic": "training",
        "relevant_keywords": ["frequency", "recovery", "48 hours", "sessions per week"],
    },
    # ... 48 more
]

for test_case in EVALUATION_DATASET:
    chunks = await retriever.retrieve(test_case["query"], top_k=5)
    retrieved_text = " ".join(c.content for c in chunks)

    keyword_hits = sum(1 for kw in test_case["relevant_keywords"] if kw in retrieved_text.lower())
    precision = keyword_hits / len(test_case["relevant_keywords"])

    print(f"Query: {test_case['query']}")
    print(f"Precision: {precision:.2f}")
    print(f"Top-1 similarity: {chunks[0].similarity_score:.3f}" if chunks else "No results")
```

### 8.4 Hallucination Testing

```python
# Detect if AI response contains claims not in retrieved context
def check_for_hallucination(response: str, retrieved_chunks: list[RetrievedChunk]) -> list[str]:
    """
    Check if the response contains numerical claims that can't be found in retrieved context.
    Simple heuristic: extract specific numbers from response; verify in chunks.
    """
    import re
    numbers_in_response = re.findall(r'\d+\.?\d*', response)
    context_text = " ".join(c.content for c in retrieved_chunks)

    suspicious = []
    for number in numbers_in_response:
        if number not in context_text:
            suspicious.append(number)

    return suspicious  # Manual review if non-empty
```

---

## 9. Frontend Tests

### 9.1 Component Tests (Vitest + React Testing Library)

```typescript
// frontend/src/components/NutritionSummary.test.tsx

describe("NutritionSummary", () => {
  it("displays remaining calories correctly", () => {
    render(<NutritionSummary
      consumed={{ calories: 1450, protein: 98 }}
      targets={{ calories: 2200, protein: 165 }}
    />);
    expect(screen.getByText("750 kcal remaining")).toBeInTheDocument();
  });

  it("shows danger state when calories exceeded", () => {
    render(<NutritionSummary
      consumed={{ calories: 2500 }}
      targets={{ calories: 2200 }}
    />);
    expect(screen.getByTestId("calorie-bar")).toHaveClass("danger");
  });
});
```

### 9.2 E2E Tests (Playwright)

```typescript
// tests/e2e/food-logging.spec.ts

test("user can log food manually", async ({ page }) => {
  await page.goto("/dashboard");
  await page.click("[data-testid='add-food-button']");
  await page.fill("[data-testid='food-search-input']", "chicken breast");
  await page.click("[data-testid='food-result-0']");
  await page.fill("[data-testid='quantity-input']", "174");
  await page.click("[data-testid='log-food-submit']");
  await expect(page.locator("[data-testid='daily-calories']")).toContainText("287");
});

test("AI food logging shows confirmation step", async ({ page }) => {
  await page.goto("/dashboard");
  await page.click("[data-testid='ai-log-button']");
  await page.fill("[data-testid='nl-input']", "I had 2 boiled eggs");
  await page.click("[data-testid='extract-button']");
  await expect(page.locator("[data-testid='confirmation-dialog']")).toBeVisible();
  await expect(page.locator("[data-testid='extracted-food-0']")).toContainText("egg");
});
```

---

## 10. AI/RAG Evaluation vs. Conventional Testing

### 10.1 Key Differences

| Aspect | Conventional Testing | AI/RAG Evaluation |
|--------|---------------------|-------------------|
| Output | Deterministic; exact match | Probabilistic; structure and quality |
| Pass/fail | Binary | Graded (score-based) |
| Speed | Milliseconds | Seconds to minutes |
| Reproducibility | 100% | Not guaranteed (temperature > 0) |
| Tools | pytest, assertion libraries | Custom eval scripts, LLM-as-judge |
| What's tested | Correctness | Relevance, faithfulness, groundedness |

### 10.2 What Can Be Conventionally Tested for AI

- Prompt structure (is the safety instruction present?)
- Structured output parsing (does the parser handle valid and invalid JSON?)
- Token budget management (does context fit within limits?)
- Failure handling (do errors propagate correctly?)
- Input sanitisation (is user input cleaned before injection?)

### 10.3 What Requires Evaluation (Not pytest)

- Retrieval relevance (are the right documents retrieved?)
- Response faithfulness (does the response only use provided context?)
- Response quality (is the recommendation actually useful?)
- Safety boundary adherence (does the AI refuse medical questions?)

### 10.4 LLM-as-Judge for Evaluation

For faithfulness evaluation:

```python
FAITHFULNESS_PROMPT = """
Given the following:
CONTEXT: {retrieved_chunks}
RESPONSE: {ai_response}

Rate whether every factual claim in the RESPONSE can be found in the CONTEXT.
Score: 1 (all claims grounded) / 0.5 (mostly grounded) / 0 (response contains invented claims).
Return JSON: {"score": 0|0.5|1, "reasoning": "..."}
"""
# Use a separate LLM call to evaluate the first LLM's output
```

---

## 11. Test Infrastructure

### 11.1 Test Fixtures

```python
# tests/factories.py — Use factory_boy for test data creation

class UserFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = User
        sqlalchemy_session_persistence = "commit"

    email = factory.LazyAttribute(lambda o: f"user-{uuid4()}@test.com")
    hashed_password = factory.LazyAttribute(lambda o: hash_password("TestPass123!"))
    is_active = True

class FoodItemFactory(AsyncSQLAlchemyModelFactory):
    class Meta:
        model = FoodItem

    name = factory.Sequence(lambda n: f"Test Food {n}")
    calories_per_100g = 100.0
    protein_per_100g = 10.0
    carbs_per_100g = 10.0
    fat_per_100g = 5.0
```

### 11.2 Mock LLM Provider

```python
class MockLLMProvider(AbstractLLMProvider):
    """Test double for LLM provider. Returns configurable responses."""

    def __init__(self, responses: dict[str, str] | None = None):
        self.responses = responses or {}
        self.call_count = 0
        self.last_messages = None

    async def complete(self, messages, **kwargs) -> LLMResponse:
        self.call_count += 1
        self.last_messages = messages
        content = self.responses.get("default", '{"food_mentions": []}')
        return LLMResponse(
            content=content,
            prompt_tokens=100,
            completion_tokens=50,
            model="mock-model",
            finish_reason="stop"
        )
```

---

## 12. CI/CD Integration

### 12.1 Pipeline Stages

```yaml
# .github/workflows/ci.yml (or equivalent)

stages:
  - lint          # ruff, mypy (< 30s)
  - unit-tests    # pytest tests/unit (< 60s)
  - integration   # pytest tests/integration (< 5min, needs test DB)
  - api-tests     # pytest tests/e2e (< 10min, full stack)
  - frontend      # vitest, playwright (< 5min)
```

### 12.2 Pre-commit Hooks

```
ruff check .
ruff format --check .
mypy app/
```

---

## 13. Coverage Targets

| Module | Coverage Target | Notes |
|--------|----------------|-------|
| `utils/nutrition_calculator.py` | 100% | Zero tolerance for calculation bugs |
| `services/` | 90%+ | Business logic is critical |
| `repositories/` | 80%+ | Integration tests cover the gap |
| `api/routes/` | 80%+ | API tests provide coverage |
| `ai/parsers/` | 95%+ | Parsing failures are serious |
| `ai/context/` | 85%+ | Token budget critical |
| `core/security.py` | 95%+ | Security-critical |
| `rag/` | 70%+ | Harder to unit test; relies on integration |

```bash
# Run with coverage
pytest --cov=app --cov-report=html --cov-fail-under=80
```
