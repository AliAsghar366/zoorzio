# Changelog

All notable changes to Anchor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure and architecture
- Core backend API with NestJS
- AI services with FastAPI
- Database schema with Prisma
- WhatsApp integration service
- Telegram integration service
- Email integration service
- Memory storage and retrieval system
- Task management with auto-generation
- Calendar sync with Google and Outlook
- Semantic search with vector embeddings
- Full-text search with PostgreSQL
- React Native mobile app
- Next.js web dashboard
- Security module with encryption
- Rate limiting service
- Audit logging system
- Docker and Kubernetes configurations
- Terraform infrastructure as code
- Comprehensive documentation

### Security
- AES-256-GCM encryption for data at rest
- Argon2id password hashing
- JWT-based authentication with refresh tokens
- Rate limiting on all endpoints
- Input validation and sanitization
- Security headers implementation
- Audit logging for all actions
- Session management with Redis

## [0.1.0] - 2026-08-25

### Added

#### Core Features
- **Memory Capture**
  - WhatsApp Business Cloud API integration
  - Telegram Bot API integration
  - Email capture with Postmark/SendGrid
  - Voice note transcription with Whisper
  - Image OCR support
  - Zero-setup onboarding

- **Memory Storage**
  - Persistent memory store with PostgreSQL
  - Vector embeddings for semantic search
  - Full-text search with tsvector
  - Automatic categorization and tagging
  - Cross-channel context linking
  - Verified retention with confirmation

- **Task Management**
  - Auto-generated tasks from memories
  - Context-aware reminders
  - Priority-based task sorting
  - Due date tracking
  - Task completion with history

- **Calendar Integration**
  - Google Calendar two-way sync
  - Outlook Calendar two-way sync
  - Idempotent sync engine
  - Conflict resolution
  - Multi-calendar view

- **Search & Discovery**
  - Semantic search with embeddings
  - Full-text search with ranking
  - Serendipity resurfacing
  - Unified knowledge bubbles
  - Cross-channel search

#### Technical Implementation

- **Backend API (NestJS)**
  - Modular architecture
  - Dependency injection
  - TypeScript strict mode
  - Swagger API documentation
  - Global validation pipes
  - Rate limiting middleware

- **AI Services (FastAPI)**
  - OpenAI integration for embeddings
  - Whisper integration for transcription
  - LangChain for LLM orchestration
  - Sentence Transformers for embeddings
  - Structured logging with structlog
  - Prometheus metrics

- **Database (Prisma)**
  - PostgreSQL with pgvector
  - Redis for caching and queues
  - Automated migrations
  - Seed data support
  - Connection pooling

- **Mobile App (React Native)**
  - Expo SDK 50
  - React Navigation
  - Secure storage with expo-secure-store
  - Push notifications
  - Camera and voice recording
  - Haptic feedback

- **Web Dashboard (Next.js)**
  - Server-side rendering
  - Tailwind CSS
  - Radix UI components
  - Responsive design
  - Dark mode support
  - Real-time updates

#### Security Features

- **Authentication**
  - JWT access tokens (15min)
  - Refresh token rotation (7 days)
  - Argon2id password hashing
  - API key authentication
  - OAuth2 for Google/Microsoft

- **Encryption**
  - AES-256-GCM for data at rest
  - TLS 1.3 for data in transit
  - KMS integration for key management
  - Hardware-backed key storage on mobile

- **Access Control**
  - Role-based access control
  - Resource-level permissions
  - API key scoping
  - Session management

- **Monitoring**
  - Audit logging for all actions
  - Failed login tracking
  - Rate limit monitoring
  - Anomaly detection

#### Infrastructure

- **Docker**
  - Multi-stage builds
  - Production-ready images
  - Health checks
  - Resource limits

- **Kubernetes**
  - Horizontal pod autoscaling
  - Rolling deployments
  - ConfigMaps and Secrets
  - Service mesh ready

- **Terraform**
  - VPC with public/private subnets
  - RDS PostgreSQL with encryption
  - ElastiCache Redis
  - S3 with versioning and encryption
  - KMS for key management
  - CloudWatch logging

#### Documentation

- **README.md**
  - Product overview
  - Feature list
  - Tech stack
  - Business model
  - Roadmap
  - Getting started guide

- **agent.md**
  - Complete pitch deck analysis
  - Feature specifications
  - Architecture details
  - Development guidelines

- **SECURITY.md**
  - Security architecture
  - Implementation details
  - Compliance information
  - Incident response

## [0.0.1] - 2026-08-25

### Added
- Initial project setup
- Package.json files
- TypeScript configuration
- ESLint configuration
- Prettier configuration
- Git ignore rules
- License file

---

## Versioning Strategy

- **Major**: Breaking changes or major feature additions
- **Minor**: New features without breaking changes
- **Patch**: Bug fixes and security patches

## Release Process

1. Update version in package.json files
2. Update CHANGELOG.md
3. Create git tag
4. Build and test
5. Deploy to staging
6. QA verification
7. Deploy to production
8. Monitor for issues

## Support

For questions about releases:
- **GitHub Issues**: github.com/anchor/memory/issues
- **Email**: support@anchor.app
- **Discord**: discord.gg/anchor
