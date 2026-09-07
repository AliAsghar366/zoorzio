# Anchor - Agent Instructions

## Project Overview

**Anchor** is an AI-powered memory layer that helps users capture, organize, and retrieve information across multiple platforms. The product aims to solve the problem of scattered digital memories across different apps by providing a unified, reliable memory system.

## Product Vision

"The memory layer that actually remembers."

Anchor captures information from WhatsApp, Telegram, email, voice notes, and screenshots, then organizes it into actionable tasks, reminders, and searchable knowledge. It provides cross-channel context and serendipitous resurfacing of forgotten information.

## Core Features

### 1. Capture (Anywhere)
- WhatsApp & Telegram integration
- Email capture (forward or connect inbox)
- Voice notes with transcription
- Native iOS & Android apps
- Images & screenshots (OCR searchable)
- Zero-setup onboarding

### 2. Organize & Act (The Desk)
- Auto-generated tasks & lists from messages
- Context-aware reminders (adapts to routine)
- Multi-calendar sync (Google Calendar, Outlook)
- Inbox-linked follow-ups (Gmail-aware)
- Daily briefing summary
- Shared reminders (friend-to-friend)

### 3. Remember & Rediscover (The Vault)
- Persistent memory store (structured facts & preferences)
- Semantic search (plain language queries)
- Serendipity resurfacing (forgotten notes resurface)
- Unified knowledge bubbles (notes, links, files, images)
- Cross-channel context (WhatsApp memory retrievable from app/email)
- Verified retention (confirms what's stored)

### 4. Personalize & Integrate
- AI personality profiles (tone selection)
- 1,000+ integrations (Jira, Notion, Slack, Google Workspace)
- Meditate mode (guided breathing)
- Guided onboarding
- Security-first storage (encryption at rest & in transit)
- Transparent privacy controls

## Technical Architecture

### Clients
- React Native (iOS/Android)
- Next.js + Tailwind (web dashboard)
- Vercel hosting

### Channel Integrations
- WhatsApp Business Cloud API
- Telegram Bot API
- Postmark/SendGrid inbound email

### Core API
- Node.js + NestJS (TypeScript)
- Auth, billing, tasks, reminders, sync orchestration

### AI/NLU Layer
- Python + FastAPI microservices
- LangChain for LLM orchestration
- Whisper for voice transcription

### Memory & Data
- PostgreSQL (core data)
- pgvector / Pinecone (semantic memory search)
- Redis + BullMQ (cache & queues)

### Infrastructure
- AWS (EKS, S3/R2 object storage)
- Docker + Kubernetes
- Terraform IaC
- GitHub Actions CI/CD

### Security & Observability
- OAuth2 (Google/Microsoft)
- KMS encryption at rest & in transit
- Datadog/Prometheus monitoring
- Sentry error tracking

## Business Model

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | WhatsApp/Telegram capture, basic reminders & lists, 7-day memory window, 1 connected calendar |
| Core | $2.99/mo | Unlimited memory retention, daily briefing, multi-calendar sync |
| Pro | $7.99/mo | Full integration suite (1,000+), AI personality profiles, priority 24hr support |

## Development Roadmap

### Phase 1 (0-3 months): Reliable Capture + Sync Engine
- WhatsApp/Telegram/email capture
- Durable memory store
- Calendar sync engine hardened against silent failures

### Phase 2 (3-6 months): Memory & Rediscovery
- Semantic search
- Serendipity resurfacing
- Unified knowledge vault
- Native apps

### Phase 3 (6-12 months): Integrations & Personalization
- 1,000+ app integrations
- AI personality profiles
- Friend-to-friend reminders

### Phase 4 (12+ months): Platform & Enterprise
- Team memory spaces
- API for developers
- SOC 2 compliance

## Engineering Principles

### Reliability is the Product
1. **Idempotent sync engine** - Every calendar write retried and reconciled with health check
2. **Durable memory writes** - Preferences committed to structured store, confirmed back to user
3. **Support SLA + self-serve billing** - Cancel in two taps, 24hr response time
4. **Usage-honest pricing** - Free tier actually useful, paid tiers priced against delivery

## Competitive Advantages

1. **Reliability focus** - Competitors have inconsistent features
2. **Cross-channel memory** - Unified view across WhatsApp, Telegram, email, app
3. **Serendipity resurfacing** - Surfaces forgotten knowledge proactively
4. **Transparent pricing** - $2.99 entry point vs $8+ competitors

## Success Metrics

- User retention rate (daily/weekly active users)
- Memory retrieval accuracy
- Calendar sync success rate
- Support response time
- Feature adoption rates
- Revenue per user (ARPU)

## Risk Mitigation

1. **API dependency** - Build fallbacks for WhatsApp/Telegram API changes
2. **Privacy concerns** - End-to-end encryption, transparent data policies
3. **Competition** - Focus on reliability moat, first-mover in memory layer space
4. **Scaling** - Design for horizontal scaling from day one

---

*Last updated: August 2026*
