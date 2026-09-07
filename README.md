# Anchor

**The memory layer that actually remembers.**

Reliable capture. Real memory retention. Fair pricing. One layer above every app you use.

---

## 🎯 The Problem

Your memory is scattered across a dozen apps, and the tools built to fix that are inconsistent and expensive:

- **Tool sprawl** - Reminders in one app, notes in another, calendar in a third. Nothing talks to anything else.
- **Broken follow-through** - Existing AI memory bots forget stated preferences and miss calendar syncs.
- **Pricing that doesn't match delivery** - Premium subscriptions ($8+/mo) for features that don't reliably work.

## 💡 The Solution

Anchor is a unified memory layer built on four pillars:

1. **Capture** - Anywhere you already are — chat, email, voice, app
2. **Remember** - Persistent, structured memory — not session amnesia
3. **Act** - Tasks, reminders and calendar in real sync
4. **Rediscover** - Resurface what you forgot you knew

## ✨ Key Features

### Capture Anywhere
- WhatsApp & Telegram integration
- Email capture (forward or connect inbox)
- Voice notes with transcription
- Native iOS & Android apps
- Images & screenshots (OCR searchable)
- Zero-setup onboarding

### Organize & Act (The Desk)
- Auto-generated tasks & lists from messages
- Context-aware reminders (adapts to your routine)
- Multi-calendar sync (Google Calendar & Outlook)
- Inbox-linked follow-ups (Gmail-aware)
- Daily briefing summary
- Shared reminders (friend-to-friend)

### Remember & Rediscover (The Vault)
- Persistent memory store (structured facts & preferences)
- Semantic search (ask in plain language)
- Serendipity resurfacing (forgotten notes resurface on their own)
- Unified knowledge bubbles (notes, links, files, images)
- Cross-channel context (WhatsApp memory retrievable from app/email)
- Verified retention (system confirms what it has stored)

### Personalize & Integrate
- AI personality profiles (choose assistant tone)
- 1,000+ app integrations (Jira, Notion, Slack, Google Workspace)
- Meditate mode (optional guided breathing)
- Guided onboarding
- Security-first storage (encryption at rest & in transit)
- Transparent privacy controls

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Clients** | React Native (iOS/Android), Next.js + Tailwind (web), Vercel |
| **Channel Integrations** | WhatsApp Business Cloud API, Telegram Bot API, Postmark/SendGrid |
| **Core API** | Node.js + NestJS (TypeScript) |
| **AI/NLU** | Python + FastAPI, LangChain, Whisper (voice transcription) |
| **Memory & Data** | PostgreSQL, pgvector/Pinecone, Redis + BullMQ |
| **Infrastructure** | AWS (EKS, S3/R2), Docker + Kubernetes, Terraform, GitHub Actions |
| **Security** | OAuth2, KMS encryption, Datadog/Prometheus, Sentry |

## 💰 Business Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | WhatsApp/Telegram capture, basic reminders & lists, 7-day memory window, 1 connected calendar |
| **Core** | $2.99/mo | Everything in Free + Unlimited memory retention, daily briefing, multi-calendar sync |
| **Pro** | $7.99/mo | Everything in Core + Full integration suite (1,000+), AI personality profiles, priority 24hr support |

## 🗺️ Roadmap

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

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- AWS account (for production)
- WhatsApp Business API access
- Telegram Bot API token

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/anchor.git
cd anchor

# Install Node dependencies (npm workspaces - installs apps/api, apps/web,
# apps/mobile, and packages/* together, since they depend on each other)
npm install

# Install the AI service's Python dependencies separately
cd apps/ai && pip install -r requirements.txt && cd ../..

# Set up environment variables (apps/api reads its own .env, not the root one)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
# Edit both with your API keys

# Start Postgres + Redis (+ optionally the full app stack) via Docker
cd infrastructure/docker && docker-compose up -d postgres redis && cd ../..

# Generate the Prisma client and apply migrations
npm run db:generate
npm run db:migrate

# Start the app
npm run dev
```

### Environment Variables

```env
# Core
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/anchor

# Redis
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=your-openai-key
LANGCHAIN_API_KEY=your-langchain-key

# Channel Integrations
WHATSAPP_BUSINESS_TOKEN=your-whatsapp-token
TELEGRAM_BOT_TOKEN=your-telegram-token
SENDGRID_API_KEY=your-sendgrid-key

# Storage
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
S3_BUCKET=anchor-storage

# Monitoring
DATADOG_API_KEY=your-datadog-key
SENTRY_DSN=your-sentry-dsn
```

## 📁 Project Structure

```
anchor/
├── apps/
│   ├── api/                    # NestJS core API
│   ├── web/                    # Next.js web dashboard
│   ├── mobile/                 # React Native mobile app
│   └── ai/                     # Python FastAPI AI services
├── packages/
│   ├── database/               # Prisma schemas & migrations
│   ├── shared/                 # Shared types & utilities
│   └── ui/                     # Shared UI components
├── infrastructure/
│   ├── docker/                 # Docker configurations
│   ├── kubernetes/             # K8s manifests
│   └── terraform/              # IaC configurations
├── docs/                       # Documentation
└── scripts/                    # Build & deployment scripts
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Run AI service tests
cd apps/ai && pytest
```

## 🚢 Deployment

```bash
# Build for production
npm run build

# Deploy to an environment (staging/production) via the deploy script,
# which builds+pushes Docker images and rolls out the EKS deployments
./scripts/deploy.sh staging
./scripts/deploy.sh production
```

CI/CD (`.github/workflows/ci.yml`) runs the same deployment automatically on
pushes to `main`: staging deploys immediately, production requires approval
via the `production` GitHub Environment's protection rule.

## 📊 Monitoring

- **Datadog** - Application performance monitoring
- **Prometheus** - Metrics collection
- **Sentry** - Error tracking
- **CloudWatch** - AWS infrastructure monitoring

## 🔐 Security

- OAuth2 authentication (Google, Microsoft)
- KMS encryption at rest & in transit
- Regular security audits
- SOC 2 compliance (Phase 4)
- Transparent privacy controls
- Data export & deletion on request

## 🤝 Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [docs.anchor.app](https://docs.anchor.app)
- **Email**: support@anchor.app
- **Discord**: [Join our community](https://discord.gg/anchor)
- **Twitter**: [@AnchorApp](https://twitter.com/AnchorApp)

---

**Anchor** — Never re-explain yourself to a tool again.
