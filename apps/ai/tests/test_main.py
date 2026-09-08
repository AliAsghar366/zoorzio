import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402


class FakeChatCompletions:
    def __init__(self, content: dict):
        self._content = content

    async def create(self, **kwargs):
        message = SimpleNamespace(content=json.dumps(self._content))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class FakeEmbeddings:
    async def create(self, model: str, input: str):
        return SimpleNamespace(
            data=[SimpleNamespace(embedding=[0.1, 0.2, 0.3])],
            model=model,
            usage=SimpleNamespace(prompt_tokens=3, total_tokens=3),
        )


class FakeOpenAIClient:
    def __init__(self, chat_content: dict):
        self.chat = SimpleNamespace(completions=FakeChatCompletions(chat_content))
        self.embeddings = FakeEmbeddings()


@pytest.fixture
def test_client():
    return TestClient(main.app)


def test_health_reports_openai_configuration(test_client, monkeypatch):
    monkeypatch.setattr(main, "client", None)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "zoorzio-ai",
        "openai_configured": False,
        "grok_configured": False,
        "groq_configured": False,
    }


def test_health_reports_groq_configuration(test_client, monkeypatch):
    monkeypatch.setattr(main, "groq_client", FakeOpenAIClient({}))
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json()["groq_configured"] is True


def test_embeddings_without_configured_key_returns_503(test_client, monkeypatch):
    monkeypatch.setattr(main, "client", None)
    response = test_client.post("/embeddings", json={"text": "hello world"})
    assert response.status_code == 503


def test_embeddings_returns_real_shaped_vector(test_client, monkeypatch):
    monkeypatch.setattr(main, "client", FakeOpenAIClient({}))
    response = test_client.post("/embeddings", json={"text": "hello world"})
    assert response.status_code == 200
    body = response.json()
    assert body["embedding"] == [0.1, 0.2, 0.3]
    assert body["usage"]["total_tokens"] == 3


def test_summarize_parses_model_json_response(test_client, monkeypatch):
    monkeypatch.setattr(
        main,
        "client",
        FakeOpenAIClient({"summary": "Buy milk", "key_points": ["groceries"]}),
    )
    response = test_client.post(
        "/summarize", json={"content": "Remember to buy milk on the way home", "max_length": 100}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "Buy milk"
    assert body["key_points"] == ["groceries"]


def test_sentiment_defaults_when_fields_missing(test_client, monkeypatch):
    monkeypatch.setattr(main, "client", FakeOpenAIClient({}))
    response = test_client.post("/sentiment", json={"content": "I am okay"})
    assert response.status_code == 200
    body = response.json()
    assert body["sentiment"] == "neutral"
    assert body["confidence"] == 0.5


def test_chat_returns_plain_text_reply(test_client, monkeypatch):
    class FakePlainChatCompletions:
        async def create(self, **kwargs):
            message = SimpleNamespace(content="Sure, I can help with that!")
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = FakeOpenAIClient({})
    fake_client.chat = SimpleNamespace(completions=FakePlainChatCompletions())
    monkeypatch.setattr(main, "client", fake_client)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)

    response = test_client.post(
        "/chat", json={"messages": [{"role": "user", "content": "What's on my plate today?"}]}
    )
    assert response.status_code == 200
    assert response.json() == {"reply": "Sure, I can help with that!", "tool_calls": None}


def test_chat_without_configured_key_returns_503(test_client, monkeypatch):
    monkeypatch.setattr(main, "client", None)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)
    response = test_client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 503


def test_chat_prefers_grok_over_openai_when_both_configured(test_client, monkeypatch):
    seen_models = []

    class FakeGrokChatCompletions:
        async def create(self, **kwargs):
            seen_models.append(kwargs.get("model"))
            message = SimpleNamespace(content="Grok reply", tool_calls=None)
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_grok = FakeOpenAIClient({})
    fake_grok.chat = SimpleNamespace(completions=FakeGrokChatCompletions())
    monkeypatch.setattr(main, "grok_client", fake_grok)
    monkeypatch.setattr(main, "groq_client", None)
    monkeypatch.setattr(main, "GROK_CHAT_MODEL", "grok-test-model")

    response = test_client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})

    assert response.status_code == 200
    assert response.json()["reply"] == "Grok reply"
    assert seen_models == ["grok-test-model"]


def test_chat_prefers_groq_over_grok_and_openai_when_all_configured(test_client, monkeypatch):
    seen_models = []

    class FakeGroqChatCompletions:
        async def create(self, **kwargs):
            seen_models.append(kwargs.get("model"))
            message = SimpleNamespace(content="Groq reply", tool_calls=None)
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_groq = FakeOpenAIClient({})
    fake_groq.chat = SimpleNamespace(completions=FakeGroqChatCompletions())
    monkeypatch.setattr(main, "groq_client", fake_groq)
    monkeypatch.setattr(main, "grok_client", FakeOpenAIClient({}))
    monkeypatch.setattr(main, "GROQ_CHAT_MODEL", "groq-test-model")

    response = test_client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})

    assert response.status_code == 200
    assert response.json()["reply"] == "Groq reply"
    assert seen_models == ["groq-test-model"]


def test_chat_falls_back_to_openai_when_groq_and_grok_not_configured(test_client, monkeypatch):
    class FakePlainChatCompletions:
        async def create(self, **kwargs):
            message = SimpleNamespace(content="OpenAI reply", tool_calls=None)
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = FakeOpenAIClient({})
    fake_client.chat = SimpleNamespace(completions=FakePlainChatCompletions())
    monkeypatch.setattr(main, "client", fake_client)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)

    response = test_client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})

    assert response.status_code == 200
    assert response.json()["reply"] == "OpenAI reply"


def test_chat_returns_tool_calls_when_the_model_wants_to_act(test_client, monkeypatch):
    class FakeToolCall:
        id = "call_1"
        function = SimpleNamespace(name="create_reminder", arguments='{"title": "Call mom"}')

    class FakeToolChatCompletions:
        async def create(self, **kwargs):
            message = SimpleNamespace(content=None, tool_calls=[FakeToolCall()])
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = FakeOpenAIClient({})
    fake_client.chat = SimpleNamespace(completions=FakeToolChatCompletions())
    monkeypatch.setattr(main, "client", fake_client)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)

    response = test_client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "remind me to call mom"}],
            "tools": [{"type": "function", "function": {"name": "create_reminder"}}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tool_calls"] == [
        {"id": "call_1", "name": "create_reminder", "arguments": '{"title": "Call mom"}'}
    ]


def test_chat_system_prompt_identifies_as_zoorzio_and_restricts_scope():
    assert "Zoorzio" in main.ZOORZIO_SYSTEM_PROMPT
    assert "out of our scope" in main.ZOORZIO_SYSTEM_PROMPT
    assert "local LLM" in main.ZOORZIO_SYSTEM_PROMPT


def test_chat_includes_personalized_greeting_instruction_when_user_name_given(test_client, monkeypatch):
    captured_messages = []

    class FakeCapturingChatCompletions:
        async def create(self, **kwargs):
            captured_messages.extend(kwargs["messages"])
            message = SimpleNamespace(content="Hi!", tool_calls=None)
            return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    fake_client = FakeOpenAIClient({})
    fake_client.chat = SimpleNamespace(completions=FakeCapturingChatCompletions())
    monkeypatch.setattr(main, "client", fake_client)
    monkeypatch.setattr(main, "grok_client", None)
    monkeypatch.setattr(main, "groq_client", None)

    test_client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "hi"}], "user_name": "Zeesha"},
    )

    system_message = captured_messages[0]["content"]
    assert "Zeesha" in system_message


def test_describe_image_returns_description_and_ocr_text(test_client, monkeypatch):
    monkeypatch.setattr(
        main,
        "client",
        FakeOpenAIClient({"description": "A receipt", "extracted_text": "TOTAL $12.34"}),
    )
    response = test_client.post(
        "/describe-image", json={"image_url": "https://example.com/receipt.jpg"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["description"] == "A receipt"
    assert body["extracted_text"] == "TOTAL $12.34"
