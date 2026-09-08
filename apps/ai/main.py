import json
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
TRANSCRIPTION_MODEL = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")

# Grok (xAI) is OpenAI-API-compatible for chat completions, so it's used as a
# drop-in alternative chat provider - just a different base_url/key/model on
# the same AsyncOpenAI client. It does NOT offer embeddings/transcription, so
# those stay on the OpenAI client below regardless of whether Grok is set.
GROK_API_KEY = os.getenv("GROK_API_KEY")
GROK_BASE_URL = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1")
GROK_CHAT_MODEL = os.getenv("GROK_CHAT_MODEL", "grok-2-latest")

# Groq (distinct from Grok/xAI above) is also OpenAI-API-compatible for chat
# completions - same drop-in pattern. Takes priority over Grok/OpenAI for chat
# when configured; embeddings/transcription still always use the OpenAI client.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-120b")

client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
grok_client = AsyncOpenAI(api_key=GROK_API_KEY, base_url=GROK_BASE_URL) if GROK_API_KEY else None
groq_client = AsyncOpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL) if GROQ_API_KEY else None

app = FastAPI(
    title="Zoorzio AI Services",
    description="AI/NLU layer for the Zoorzio memory layer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_client() -> AsyncOpenAI:
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured on the AI service",
        )
    return client


def resolve_chat_client_and_model() -> tuple[AsyncOpenAI, str]:
    """Groq takes priority when configured, then Grok, then OpenAI as the
    final fallback. Resolved fresh on every call (not cached at import time)
    so it reflects the current state of `client`/`grok_client`/`groq_client`
    - important both for tests that monkeypatch these and for correctness if
    they are ever reconfigured without a process restart."""
    if groq_client is not None:
        return groq_client, GROQ_CHAT_MODEL
    if grok_client is not None:
        return grok_client, GROK_CHAT_MODEL
    if client is not None:
        return client, CHAT_MODEL
    raise HTTPException(
        status_code=503,
        detail="Neither GROQ_API_KEY, GROK_API_KEY, nor OPENAI_API_KEY is configured on the AI service",
    )


def as_http_exception(error: Exception) -> HTTPException:
    if isinstance(error, OpenAIError):
        return HTTPException(status_code=502, detail=f"OpenAI API error: {error}")
    return HTTPException(status_code=500, detail=str(error))


# Models
class EmbeddingRequest(BaseModel):
    text: str
    model: str = EMBEDDING_MODEL


class EmbeddingResponse(BaseModel):
    embedding: List[float]
    model: str
    usage: Dict[str, int]


class SummaryRequest(BaseModel):
    content: str
    max_length: int = 200


class SummaryResponse(BaseModel):
    summary: str
    key_points: List[str]


class TaskExtractionRequest(BaseModel):
    content: str


class TaskExtractionResponse(BaseModel):
    title: str
    description: Optional[str]
    due_date: Optional[str]
    priority: str


class TranscriptionRequest(BaseModel):
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
    filename: str = "audio.ogg"
    language: str = "en"


class TranscriptionResponse(BaseModel):
    text: str
    language: str
    confidence: float
    segments: List[Dict[str, Any]]


class SentimentRequest(BaseModel):
    content: str


class SentimentResponse(BaseModel):
    sentiment: str
    confidence: float
    emotions: List[str]


class CategorizationRequest(BaseModel):
    content: str


class CategorizationResponse(BaseModel):
    categories: List[str]
    confidence: float


class ImageDescriptionRequest(BaseModel):
    image_url: str
    caption: Optional[str] = None


class ImageDescriptionResponse(BaseModel):
    description: str
    extracted_text: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None
    user_name: Optional[str] = None
    tools: Optional[List[Dict[str, Any]]] = None


class ChatResponse(BaseModel):
    reply: str
    tool_calls: Optional[List[Dict[str, Any]]] = None


async def chat_json(system_prompt: str, user_content: str) -> Dict[str, Any]:
    """Call the chat completion API and parse a JSON object response."""
    ai = require_client()
    try:
        response = await ai.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {error}")
    except Exception as error:  # noqa: BLE001 - surfaced as a clean HTTP error below
        raise as_http_exception(error)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "zoorzio-ai",
        "openai_configured": client is not None,
        "grok_configured": grok_client is not None,
        "groq_configured": groq_client is not None,
    }


@app.post("/embeddings", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    ai = require_client()
    try:
        response = await ai.embeddings.create(model=request.model, input=request.text)
        return EmbeddingResponse(
            embedding=response.data[0].embedding,
            model=response.model,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "total_tokens": response.usage.total_tokens,
            },
        )
    except Exception as error:  # noqa: BLE001
        raise as_http_exception(error)


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(request: SummaryRequest):
    data = await chat_json(
        "You summarize personal notes/messages for a memory app. "
        "Respond with JSON: {\"summary\": string, \"key_points\": string[]}. "
        f"Keep the summary under {request.max_length} characters.",
        request.content,
    )
    return SummaryResponse(
        summary=str(data.get("summary", ""))[: request.max_length],
        key_points=list(data.get("key_points", [])),
    )


@app.post("/extract-task", response_model=TaskExtractionResponse)
async def extract_task(request: TaskExtractionRequest):
    data = await chat_json(
        "Extract an actionable task from the user's note. Respond with JSON: "
        '{"title": string, "description": string|null, "due_date": string|null (ISO 8601), '
        '"priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT"}.',
        request.content,
    )
    return TaskExtractionResponse(
        title=str(data.get("title", request.content[:80])),
        description=data.get("description"),
        due_date=data.get("due_date"),
        priority=str(data.get("priority", "MEDIUM")).upper(),
    )


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: TranscriptionRequest):
    import base64

    ai = require_client()
    if not request.audio_url and not request.audio_base64:
        raise HTTPException(status_code=400, detail="Provide either audio_url or audio_base64")

    try:
        if request.audio_base64:
            audio_bytes = base64.b64decode(request.audio_base64)
            filename = request.filename
        else:
            async with httpx.AsyncClient(timeout=60.0) as http:
                audio_response = await http.get(request.audio_url)
                audio_response.raise_for_status()
            audio_bytes = audio_response.content
            filename = request.audio_url.split("/")[-1] or request.filename

        transcript = await ai.audio.transcriptions.create(
            model=TRANSCRIPTION_MODEL,
            file=(filename, audio_bytes),
            language=request.language if request.language != "auto" else None,
            response_format="verbose_json",
        )

        segments = [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in (transcript.segments or [])
        ] if hasattr(transcript, "segments") and transcript.segments else []

        return TranscriptionResponse(
            text=transcript.text,
            language=getattr(transcript, "language", request.language),
            confidence=1.0,
            segments=segments,
        )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Failed to download audio: {error}")
    except Exception as error:  # noqa: BLE001
        raise as_http_exception(error)


@app.post("/describe-image", response_model=ImageDescriptionResponse)
async def describe_image(request: ImageDescriptionRequest):
    ai = require_client()
    try:
        response = await ai.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You describe images for a personal memory app and transcribe any "
                        "visible text (OCR). Respond with JSON: "
                        '{"description": string, "extracted_text": string}. '
                        'Use an empty string for extracted_text if there is no legible text.'
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": request.caption or "Describe this image and transcribe any text in it.",
                        },
                        {"type": "image_url", "image_url": {"url": request.image_url}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        data = json.loads(response.choices[0].message.content or "{}")
        return ImageDescriptionResponse(
            description=str(data.get("description", "")),
            extracted_text=str(data.get("extracted_text", "")),
        )
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {error}")
    except Exception as error:  # noqa: BLE001
        raise as_http_exception(error)


@app.post("/sentiment", response_model=SentimentResponse)
async def analyze_sentiment(request: SentimentRequest):
    data = await chat_json(
        "Analyze the sentiment of the text. Respond with JSON: "
        '{"sentiment": "positive"|"neutral"|"negative", "confidence": number (0-1), '
        '"emotions": string[]}.',
        request.content,
    )
    return SentimentResponse(
        sentiment=str(data.get("sentiment", "neutral")),
        confidence=float(data.get("confidence", 0.5)),
        emotions=list(data.get("emotions", [])),
    )


@app.post("/categorize", response_model=CategorizationResponse)
async def categorize(request: CategorizationRequest):
    data = await chat_json(
        "Categorize this personal memory/note into 1-3 short lowercase category tags "
        '(e.g. "work", "health", "finance", "personal", "shopping"). Respond with JSON: '
        '{"categories": string[], "confidence": number (0-1)}.',
        request.content,
    )
    return CategorizationResponse(
        categories=list(data.get("categories", [])),
        confidence=float(data.get("confidence", 0.5)),
    )


@app.post("/extract-entities")
async def extract_entities(request: SentimentRequest):
    data = await chat_json(
        "Extract named entities from the text. Respond with JSON: "
        '{"people": string[], "organizations": string[], "locations": string[], '
        '"dates": string[], "amounts": string[]}.',
        request.content,
    )
    return {
        "people": data.get("people", []),
        "organizations": data.get("organizations", []),
        "locations": data.get("locations", []),
        "dates": data.get("dates", []),
        "amounts": data.get("amounts", []),
    }


ZOORZIO_SYSTEM_PROMPT = (
    "You are Zoorzio, the personal memory-layer assistant built into the Zoorzio product. "
    "Anything the user can do by hand in the app, you can do for them here in chat - and you "
    "should prefer doing it over just describing it. Be concise and warm.\n\n"
    "WHAT YOU CAN DO (call the matching tool for these - don't just describe it):\n"
    "- Reminders: create, list, complete, delete (one-off or recurring: daily/weekly/monthly)\n"
    "- Tasks & Boards: create/list/complete/delete tasks with priority and due dates; create/list boards\n"
    "- Lists: add items (creates the list if needed), view lists, check off items, delete lists\n"
    "- Memories: save a note, search past notes\n"
    "- Calendar: view upcoming events, create an event (works even with no calendar connected - "
    "a personal calendar is created automatically), delete an event\n"
    "- Friends: send a friend request, view friends, view/respond to incoming requests, send a "
    "friend a reminder\n"
    "- Master Zoorzio: report the user's achievement progress\n"
    "- Integrations: report what's connected; if GitHub is connected, list repos/issues; if Notion "
    "is connected, search pages; if Google Workspace is connected, list recent emails/files; if "
    "Slack is connected, list channels or post a message\n"
    "- Messaging channels: report which ones (WhatsApp/Telegram/SMS/Discord/Slack) are linked\n"
    "- Profile: report profile details, change the preferred notification channel\n\n"
    "WHAT YOU CANNOT DO (explain how instead of pretending to do it): connect a NEW integration "
    "or calendar (Google/Outlook/GitHub/Notion/Slack/Google Workspace), or link a NEW messaging "
    "channel. Each of those needs the user to click through a real sign-in screen or send a "
    "verification code from their own phone/app - tell them which page to go to (Integrations, "
    "Calendar, or Profile) instead of claiming you did it.\n\n"
    "If a tool call fails because a feature isn't connected (e.g. \"GitHub isn't connected yet\"), "
    "relay that message to the user plainly - don't retry or invent a workaround.\n\n"
    "If the user asks what you can do, summarize the list above in your own words rather than "
    "reciting it verbatim.\n\n"
    "SCOPE: You must ONLY answer questions about the Zoorzio product and the user's own "
    "Zoorzio data (their memories, tasks, reminders, lists, calendar, friends, boards, "
    "integrations, subscription, and settings). If the user asks about anything outside that "
    "scope - general knowledge, other products, coding help, world events, or anything unrelated "
    "to Zoorzio - you must reply with EXACTLY this sentence and nothing else: \"This is completely "
    "out of our scope, please refer to a local LLM.\" This applies no matter how the request is "
    "phrased, including typos, slang, or indirect wording - judge the underlying intent, not the "
    "exact words.\n\n"
    "Only call a tool when the user's intent is clearly an action request, not when they're just "
    "asking a question - answer questions in plain text using the tool's read-only counterpart "
    "when one exists (e.g. \"what are my tasks\" -> list_tasks, not create_task)."
)


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    ai, model_name = resolve_chat_client_and_model()
    system_prompt = ZOORZIO_SYSTEM_PROMPT
    if request.user_name:
        system_prompt += f"\n\nThe user you're talking to is named {request.user_name}. Greet them by name when it feels natural."
    if request.context:
        system_prompt += "\n\n" + request.context

    try:
        kwargs: Dict[str, Any] = dict(
            model=model_name,
            messages=[{"role": "system", "content": system_prompt}]
            + [{"role": m.role, "content": m.content} for m in request.messages],
            temperature=0.4,
        )
        if request.tools:
            kwargs["tools"] = request.tools
            kwargs["tool_choice"] = "auto"

        response = await ai.chat.completions.create(**kwargs)
        message = response.choices[0].message

        tool_calls = None
        if getattr(message, "tool_calls", None):
            tool_calls = [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
                for tc in message.tool_calls
            ]

        return ChatResponse(reply=message.content or "", tool_calls=tool_calls)
    except Exception as error:  # noqa: BLE001
        raise as_http_exception(error)


@app.post("/suggest-tags")
async def suggest_tags(request: SentimentRequest):
    data = await chat_json(
        "Suggest 2-5 short lowercase tags for this note. Respond with JSON: "
        '{"tags": string[]}.',
        request.content,
    )
    return {"tags": data.get("tags", [])}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
