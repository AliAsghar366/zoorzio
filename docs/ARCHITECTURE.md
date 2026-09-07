# Anchor Architecture

> **Note:** this document describes the target architecture. See
> [COMPLETE_PROJECT_SUMMARY.md](../COMPLETE_PROJECT_SUMMARY.md) at the repo
> root for what's actually implemented vs. still a gap today - most
> components below are real and match this design, but a few (calendar OAuth
> consent flow, generic file upload, real-time updates) are not yet built.

## Overview

Anchor is a distributed system designed for reliability, scalability, and security. This document describes the high-level architecture, key components, and design decisions.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │  Mobile App  │  │  Web Dashboard│  │  WhatsApp    │  │ Telegram ││
│  │ (React Native)│  │  (Next.js)   │  │  Bot         │  │ Bot      ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway                                  │
│                    (Nginx / AWS ALB)                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    NestJS API Server                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │   Auth   │  │  Memory  │  │  Tasks   │  │ Calendar │   │  │
│  │  │  Module  │  │  Module  │  │  Module  │  │  Module  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │ Channels │  │    AI    │  │  Search  │  │ Security │   │  │
│  │  │  Module  │  │  Module  │  │  Module  │  │  Module  │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   FastAPI AI Services                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
│  │  │Embeddings│  │   LLM    │  │Transcri- │  │Sentiment │   │  │
│  │  │ Service  │  │ Service  │  │ption Svc │  │ Analysis │   │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   PostgreSQL     │  │      Redis       │  │      S3          │ │
│  │  (Primary DB)    │  │  (Cache/Queue)   │  │ (Object Storage) │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Client Layer

##### Mobile App (React Native)
- **Platform**: iOS & Android
- **Framework**: React Native with Expo
- **State Management**: Zustand
- **Navigation**: React Navigation
- **Storage**: SecureStore (expo-secure-store)
- **Push Notifications**: Expo Notifications

##### Web Dashboard (Next.js)
- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State Management**: React Query
- **Authentication**: JWT with refresh tokens

##### Channel Integrations
- **WhatsApp**: WhatsApp Business Cloud API
- **Telegram**: Telegram Bot API
- **Email**: Postmark/SendGrid

#### 2. Application Layer

##### NestJS API Server
- **Framework**: NestJS 10
- **Language**: TypeScript
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Authentication**: JWT with Passport.js

**Core Modules:**
- **Auth Module**: User registration, login, token management
- **Memory Module**: CRUD operations, search, statistics
- **Tasks Module**: Task management, reminders, suggestions
- **Calendar Module**: Google/Outlook integration, sync
- **Channels Module**: WhatsApp/Telegram/Email integration
- **AI Module**: Embeddings, transcription, sentiment analysis
- **Search Module**: Semantic search, full-text search
- **Security Module**: Encryption, rate limiting, audit logging

##### FastAPI AI Services
- **Framework**: FastAPI
- **Language**: Python 3.11
- **AI/ML**: OpenAI, Whisper, Sentence Transformers
- **Async**: asyncio, httpx

**Core Services:**
- **Embedding Service**: Generate vector embeddings
- **LLM Service**: Language model interactions
- **Transcription Service**: Voice-to-text conversion
- **Sentiment Service**: Emotion and sentiment analysis

#### 3. Data Layer

##### PostgreSQL
- **Version**: 16
- **Extensions**: pgvector (vector search), pg_stat_statements
- **Features**: ACID compliance, JSON support, full-text search

##### Redis
- **Version**: 7
- **Use Cases**: Caching, session storage, job queues
- **Features**: Persistence, pub/sub, Lua scripting

##### S3
- **Use Cases**: File storage, backups, static assets
- **Features**: Versioning, encryption, lifecycle policies

## Design Patterns

### 1. Repository Pattern

```typescript
// Abstract repository interface
interface MemoryRepository {
  create(data: CreateMemoryDto): Promise<Memory>;
  findById(id: string): Promise<Memory | null>;
  findByUserId(userId: string): Promise<Memory[]>;
  update(id: string, data: UpdateMemoryDto): Promise<Memory>;
  delete(id: string): Promise<void>;
}

// Prisma implementation
@Injectable()
class PrismaMemoryRepository implements MemoryRepository {
  constructor(private prisma: PrismaService) {}
  
  async create(data: CreateMemoryDto): Promise<Memory> {
    return this.prisma.memory.create({ data });
  }
  // ... other methods
}
```

### 2. Service Layer Pattern

```typescript
// Service with business logic
@Injectable()
class MemoryService {
  constructor(
    private repository: MemoryRepository,
    private aiService: AIService,
    private searchService: SearchService,
  ) {}
  
  async create(userId: string, data: CreateMemoryDto): Promise<Memory> {
    // Business logic
    const summary = await this.aiService.generateSummary(data.content);
    const embedding = await this.aiService.generateEmbedding(data.content);
    
    const memory = await this.repository.create({
      ...data,
      userId,
      summary,
      embedding,
    });
    
    await this.searchService.indexMemory(memory);
    
    return memory;
  }
}
```

### 3. DTO Pattern

```typescript
// Data Transfer Objects
export class CreateMemoryDto {
  @ApiProperty({ description: 'Memory content' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Memory type', enum: MemoryType })
  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;
}
```

### 4. Guard Pattern

```typescript
// Authentication guard
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token');
    }
    return user;
  }
}
```

### 5. Interceptor Pattern

```typescript
// Logging interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        console.log(`${method} ${url} ${duration}ms`);
      }),
    );
  }
}
```

## Data Models

### Core Entities

#### User
```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  phone?: string;
  avatar?: string;
  timezone: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Memory
```typescript
interface Memory {
  id: string;
  userId: string;
  content: string;
  summary?: string;
  type: MemoryType;
  source: ChannelType;
  metadata: Record<string, any>;
  embedding?: number[];
  tags: string[];
  isArchived: boolean;
  isVerified: boolean;
  lastAccessed: Date;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Task
```typescript
interface Task {
  id: string;
  userId: string;
  memoryId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  completedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Calendar
```typescript
interface Calendar {
  id: string;
  userId: string;
  provider: CalendarProvider;
  externalId: string;
  name: string;
  color?: string;
  isActive: boolean;
  lastSync?: Date;
  syncToken?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Enums

```typescript
enum MemoryType {
  NOTE = 'NOTE',
  TASK = 'TASK',
  REMINDER = 'REMINDER',
  EVENT = 'EVENT',
  MESSAGE = 'MESSAGE',
  VOICE_NOTE = 'VOICE_NOTE',
  IMAGE = 'IMAGE',
  EMAIL = 'EMAIL',
  LINK = 'LINK',
  FILE = 'FILE',
}

enum ChannelType {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  VOICE = 'VOICE',
  NATIVE_APP = 'NATIVE_APP',
  WEB = 'WEB',
  API = 'API',
}

enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

enum CalendarProvider {
  GOOGLE = 'GOOGLE',
  OUTLOOK = 'OUTLOOK',
  APPLE = 'APPLE',
}
```

## Security Architecture

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Login Request  │                    │
       │───────────────────▶│                    │
       │                    │  2. Verify User    │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  3. User Found     │
       │                    │◀───────────────────│
       │                    │                    │
       │                    │  4. Generate JWT   │
       │  5. Return Token   │                    │
       │◀───────────────────│                    │
```

### Authorization Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. API Request    │                    │
       │  + JWT Token       │                    │
       │───────────────────▶│                    │
       │                    │  2. Validate JWT   │
       │                    │                    │
       │                    │  3. Extract User   │
       │                    │  from Token        │
       │                    │                    │
       │                    │  4. Check          │
       │                    │  Permissions       │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  5. User Authorized│
       │                    │◀───────────────────│
       │                    │                    │
       │  6. Return Data    │                    │
       │◀───────────────────│                    │
```

### Encryption Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Send Data      │                    │
       │───────────────────▶│                    │
       │                    │  2. Encrypt Data   │
       │                    │  using AES-256-GCM │
       │                    │                    │
       │                    │  3. Store Encrypted│
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  4. Retrieve       │
       │                    │◀───────────────────│
       │                    │                    │
       │                    │  5. Decrypt Data   │
       │  6. Return Data    │                    │
       │◀───────────────────│                    │
```

## Scalability Architecture

### Horizontal Scaling

```
                    ┌─────────────┐
                    │ Load Balancer│
                    └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  API Pod 1  │ │  API Pod 2  │ │  API Pod 3  │
    └─────────────┘ └─────────────┘ └─────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌─────────────┐
                    │  Database   │
                    │  (RDS)      │
                    └─────────────┘
```

### Caching Strategy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   API       │────▶│   Redis     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           │  1. Check Cache    │
                           │───────────────────▶│
                           │                    │
                           │  2. Cache Hit      │
                           │◀───────────────────│
                           │                    │
                           │  3. Return Cached  │
       │◀──────────────────│                    │
       │                    │                    │
       │  Cache Miss:       │                    │
       │  4. Query Database │                    │
       │                    │  5. Store in Cache │
       │                    │───────────────────▶│
```

## Monitoring Architecture

### Metrics Collection

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │────▶│ Prometheus  │────▶│  Grafana    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Emit Metrics   │                    │
       │───────────────────▶│                    │
       │                    │  2. Scrape Metrics │
       │                    │                    │
       │                    │  3. Store Metrics  │
       │                    │                    │
       │                    │  4. Visualize      │
       │                    │───────────────────▶│
```

### Logging Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   API       │────▶│   Fluentd   │────▶│ Elasticsearch│
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Emit Logs      │                    │
       │───────────────────▶│                    │
       │                    │  2. Collect Logs   │
       │                    │                    │
       │                    │  3. Index Logs     │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  4. Search Logs    │
       │                    │◀───────────────────│
```

### Alerting Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Prometheus  │────▶│ Alertmanager│────▶│   PagerDuty  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Alert Triggered│                    │
       │───────────────────▶│                    │
       │                    │  2. Route Alert    │
       │                    │                    │
       │                    │  3. Send to        │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  4. Notify Team    │
       │                    │◀───────────────────│
```

## Deployment Architecture

### Kubernetes Deployment

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      Namespace: anchor                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │  API Pod    │  │  API Pod    │  │  API Pod    │         │  │
│  │  │  (Replica)  │  │  (Replica)  │  │  (Replica)  │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │  AI Pod     │  │  AI Pod     │  │  AI Pod     │         │  │
│  │  │  (Replica)  │  │  (Replica)  │  │  (Replica)  │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │  │
│  │  │  Web Pod    │  │  Web Pod    │  │  Web Pod    │         │  │
│  │  │  (Replica)  │  │  (Replica)  │  │  (Replica)  │         │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│   GitHub    │────▶│   AWS ECR   │
│   Actions   │     │   Actions   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       │  1. Push Code      │                    │
       │───────────────────▶│                    │
       │                    │  2. Build Image    │
       │                    │                    │
       │                    │  3. Push to ECR    │
       │                    │───────────────────▶│
       │                    │                    │
       │                    │  4. Deploy to EKS  │
       │                    │───────────────────▶│
       │                    │                    │
       │  5. Update Status  │                    │
       │◀───────────────────│                    │
```

## Design Decisions

### 1. NestJS vs Express

**Decision**: Use NestJS for API server

**Reasons**:
- Built-in dependency injection
- Modular architecture
- TypeScript support
- Built-in validation
- Swagger integration

### 2. PostgreSQL vs MongoDB

**Decision**: Use PostgreSQL as primary database

**Reasons**:
- ACID compliance
- Complex queries support
- pgvector for vector search
- JSON support
- Maturity and reliability

### 3. Redis vs Memcached

**Decision**: Use Redis for caching

**Reasons**:
- Data structures support
- Persistence option
- Pub/sub capabilities
- Lua scripting
- Cluster support

### 4. FastAPI vs Flask

**Decision**: Use FastAPI for AI services

**Reasons**:
- Async support
- Type hints
- Auto-documentation
- Performance
- Modern Python features

### 5. React Native vs Flutter

**Decision**: Use React Native for mobile app

**Reasons**:
- JavaScript ecosystem
- Expo platform
- Code sharing with web
- Community support
- Performance

## Future Architecture

### Planned Improvements

1. **Microservices**: Break monolith into microservices
2. **Event Sourcing**: Implement event-driven architecture
3. **CQRS**: Separate read and write models
4. **GraphQL**: Add GraphQL API alongside REST
5. **WebSocket**: Real-time updates via WebSocket
6. **Kafka**: Event streaming platform
7. **Elasticsearch**: Advanced search capabilities
8. **Kubernetes Operators**: Custom resource definitions

### Scalability Roadmap

1. **Phase 1**: Horizontal scaling with Kubernetes
2. **Phase 2**: Database sharding
3. **Phase 3**: Geographic distribution
4. **Phase 4**: Multi-region deployment

---

*Last updated: August 2026*
