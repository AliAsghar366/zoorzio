# Anchor API Reference

## Overview

The Anchor API provides a RESTful interface for managing memories, tasks, calendars, and user accounts. All endpoints require authentication via JWT tokens.

## Base URL

```
Production: https://api.anchor.app/api
Staging: https://api-staging.anchor.app/api
Development: http://localhost:3000/api
```

## Authentication

### Register User

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd",
  "name": "John Doe",
  "phone": "+923001234567"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx1234567890",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login User

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd"
}
```

**Response:**
```json
{
  "user": {
    "id": "clx1234567890",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Refresh Tokens

```http
POST /auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Logout User

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true
}
```

### Get Current User

```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567890",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+923001234567",
  "avatar": "https://example.com/avatar.jpg",
  "timezone": "Asia/Karachi",
  "language": "en"
}
```

## Memory Endpoints

### Create Memory

```http
POST /memory
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "content": "Meeting with John at 3pm tomorrow about the project",
  "type": "MESSAGE",
  "source": "WHATSAPP",
  "metadata": {
    "sender": "John Doe",
    "phone": "+923001234567"
  },
  "tags": ["meeting", "work", "project"]
}
```

**Response:**
```json
{
  "id": "clx1234567890",
  "userId": "clx1234567891",
  "content": "Meeting with John at 3pm tomorrow about the project",
  "summary": "Meeting scheduled with John for tomorrow at 3pm",
  "type": "MESSAGE",
  "source": "WHATSAPP",
  "metadata": {
    "sender": "John Doe",
    "phone": "+923001234567"
  },
  "tags": ["meeting", "work", "project"],
  "isArchived": false,
  "isVerified": false,
  "lastAccessed": "2026-08-25T10:00:00Z",
  "accessCount": 1,
  "createdAt": "2026-08-25T10:00:00Z",
  "updatedAt": "2026-08-25T10:00:00Z"
}
```

### Get All Memories

```http
GET /memory?type=MESSAGE&source=WHATSAPP&tags=meeting&limit=20&offset=0
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `type` (optional): Filter by memory type (NOTE, TASK, REMINDER, EVENT, MESSAGE, VOICE_NOTE, IMAGE, EMAIL, LINK, FILE)
- `source` (optional): Filter by source channel (WHATSAPP, TELEGRAM, EMAIL, VOICE, NATIVE_APP, WEB, API)
- `tags` (optional): Filter by tags (comma-separated)
- `search` (optional): Search query for semantic search
- `limit` (optional): Max results per page (default: 20, max: 100)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "clx1234567890",
    "content": "Meeting with John at 3pm tomorrow",
    "summary": "Meeting scheduled",
    "type": "MESSAGE",
    "source": "WHATSAPP",
    "tags": ["meeting", "work"],
    "createdAt": "2026-08-25T10:00:00Z"
  }
]
```

### Search Memories

```http
GET /memory/search?q=meeting&limit=10
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Max results (default: 10)

**Response:**
```json
[
  {
    "id": "clx1234567890",
    "content": "Meeting with John at 3pm tomorrow",
    "score": 0.95
  }
]
```

### Get Recent Memories

```http
GET /memory/recent?limit=10
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567890",
    "content": "Meeting with John at 3pm tomorrow",
    "lastAccessed": "2026-08-25T10:00:00Z"
  }
]
```

### Get Frequently Accessed Memories

```http
GET /memory/frequent?limit=10
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567890",
    "content": "Meeting with John at 3pm tomorrow",
    "accessCount": 15
  }
]
```

### Get Memory Statistics

```http
GET /memory/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "total": 150,
  "byType": {
    "MESSAGE": 50,
    "NOTE": 40,
    "TASK": 30,
    "EMAIL": 20,
    "IMAGE": 10
  },
  "bySource": {
    "WHATSAPP": 60,
    "TELEGRAM": 40,
    "EMAIL": 30,
    "NATIVE_APP": 20
  }
}
```

### Get Memory by ID

```http
GET /memory/:id
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567890",
  "content": "Meeting with John at 3pm tomorrow",
  "summary": "Meeting scheduled",
  "type": "MESSAGE",
  "source": "WHATSAPP",
  "metadata": {
    "sender": "John Doe"
  },
  "tags": ["meeting", "work"],
  "isArchived": false,
  "isVerified": false,
  "lastAccessed": "2026-08-25T10:00:00Z",
  "accessCount": 5,
  "createdAt": "2026-08-25T10:00:00Z",
  "updatedAt": "2026-08-25T10:00:00Z"
}
```

### Update Memory

```http
PUT /memory/:id
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "content": "Updated meeting time to 4pm",
  "tags": ["meeting", "work", "updated"]
}
```

**Response:**
```json
{
  "id": "clx1234567890",
  "content": "Updated meeting time to 4pm",
  "tags": ["meeting", "work", "updated"],
  "updatedAt": "2026-08-25T11:00:00Z"
}
```

### Delete Memory

```http
DELETE /memory/:id
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true
}
```

## Task Endpoints

### Create Task

```http
POST /tasks
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread, butter",
  "dueDate": "2026-08-26T10:00:00Z",
  "priority": "MEDIUM",
  "memoryId": "clx1234567890"
}
```

**Response:**
```json
{
  "id": "clx1234567892",
  "userId": "clx1234567891",
  "title": "Buy groceries",
  "description": "Milk, eggs, bread, butter",
  "status": "PENDING",
  "priority": "MEDIUM",
  "dueDate": "2026-08-26T10:00:00Z",
  "completedAt": null,
  "createdAt": "2026-08-25T10:00:00Z",
  "updatedAt": "2026-08-25T10:00:00Z"
}
```

### Get All Tasks

```http
GET /tasks?status=PENDING&limit=50
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional): Filter by status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- `limit` (optional): Max results (default: 50)

**Response:**
```json
[
  {
    "id": "clx1234567892",
    "title": "Buy groceries",
    "status": "PENDING",
    "priority": "MEDIUM",
    "dueDate": "2026-08-26T10:00:00Z",
    "memory": {
      "id": "clx1234567890",
      "content": "Buy groceries tomorrow"
    }
  }
]
```

### Get Tasks Due Today

```http
GET /tasks/today
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567892",
    "title": "Buy groceries",
    "dueDate": "2026-08-25T10:00:00Z"
  }
]
```

### Get Overdue Tasks

```http
GET /tasks/overdue
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567893",
    "title": "Call dentist",
    "dueDate": "2026-08-24T10:00:00Z"
  }
]
```

### Get Task Statistics

```http
GET /tasks/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "total": 50,
  "completed": 30,
  "pending": 15,
  "overdue": 5,
  "completionRate": 60
}
```

### Get Task Suggestions

```http
GET /tasks/suggest
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "memoryId": "clx1234567890",
    "memoryContent": "I need to buy groceries tomorrow",
    "suggestedTask": {
      "title": "Buy groceries",
      "description": "From memory: I need to buy groceries tomorrow",
      "priority": "MEDIUM"
    }
  }
]
```

### Get Task by ID

```http
GET /tasks/:id
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567892",
  "title": "Buy groceries",
  "description": "Milk, eggs, bread, butter",
  "status": "PENDING",
  "priority": "MEDIUM",
  "dueDate": "2026-08-26T10:00:00Z",
  "memory": {
    "id": "clx1234567890",
    "content": "Buy groceries tomorrow"
  },
  "reminders": [
    {
      "id": "clx1234567894",
      "scheduledAt": "2026-08-26T09:00:00Z"
    }
  ]
}
```

### Update Task

```http
PUT /tasks/:id
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "Buy groceries and cooking supplies",
  "status": "IN_PROGRESS",
  "priority": "HIGH"
}
```

**Response:**
```json
{
  "id": "clx1234567892",
  "title": "Buy groceries and cooking supplies",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "updatedAt": "2026-08-25T11:00:00Z"
}
```

### Complete Task

```http
PUT /tasks/:id/complete
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567892",
  "status": "COMPLETED",
  "completedAt": "2026-08-25T12:00:00Z"
}
```

### Delete Task

```http
DELETE /tasks/:id
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true
}
```

### Add Reminder to Task

```http
POST /tasks/:id/reminder
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "scheduledAt": "2026-08-26T09:00:00Z"
}
```

**Response:**
```json
{
  "id": "clx1234567894",
  "taskId": "clx1234567892",
  "title": "Buy groceries",
  "scheduledAt": "2026-08-26T09:00:00Z"
}
```

## Calendar Endpoints

### Connect Google Calendar

```http
POST /calendar/google/connect
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "accessToken": "ya29.a0AfH6SMBx...",
  "refreshToken": "1//0gkB..."
}
```

**Response:**
```json
{
  "success": true,
  "calendarsCount": 3
}
```

### Connect Outlook Calendar

```http
POST /calendar/outlook/connect
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "accessToken": "EwBIA8l6...",
  "refreshToken": "0AURA..."
}
```

**Response:**
```json
{
  "success": true,
  "calendarsCount": 2
}
```

### Sync Google Calendar

```http
POST /calendar/google/sync
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "eventsSynced": 25
}
```

### Sync Outlook Calendar

```http
POST /calendar/outlook/sync
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "eventsSynced": 18
}
```

### Get Calendar Events

```http
GET /calendar/events?startDate=2026-08-25&endDate=2026-08-31
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `startDate` (optional): Start date (ISO format)
- `endDate` (optional): End date (ISO format)

**Response:**
```json
[
  {
    "id": "clx1234567895",
    "title": "Team Meeting",
    "description": "Weekly team sync",
    "location": "Conference Room A",
    "startTime": "2026-08-25T10:00:00Z",
    "endTime": "2026-08-25T11:00:00Z",
    "allDay": false,
    "calendar": {
      "name": "Work",
      "color": "#4285f4",
      "provider": "GOOGLE"
    }
  }
]
```

### Get Today's Events

```http
GET /calendar/today
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567895",
    "title": "Team Meeting",
    "startTime": "2026-08-25T10:00:00Z",
    "endTime": "2026-08-25T11:00:00Z"
  }
]
```

### Get Upcoming Events

```http
GET /calendar/upcoming?days=7
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `days` (optional): Number of days to look ahead (default: 7)

**Response:**
```json
[
  {
    "id": "clx1234567895",
    "title": "Team Meeting",
    "startTime": "2026-08-25T10:00:00Z"
  }
]
```

### Get Calendar Health

```http
GET /calendar/health
Authorization: Bearer <access_token>
```

**Response:**
```json
[
  {
    "id": "clx1234567896",
    "name": "Work",
    "provider": "GOOGLE",
    "isActive": true,
    "lastSync": "2026-08-25T10:00:00Z",
    "syncHealth": "healthy"
  }
]
```

### Create Calendar Event

```http
POST /calendar/events
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "calendarId": "clx1234567896",
  "title": "New Meeting",
  "description": "Discussion about project timeline",
  "location": "Conference Room B",
  "startTime": "2026-08-26T14:00:00Z",
  "endTime": "2026-08-26T15:00:00Z",
  "allDay": false
}
```

**Response:**
```json
{
  "id": "clx1234567897",
  "calendarId": "clx1234567896",
  "externalId": "google-event-123",
  "title": "New Meeting",
  "startTime": "2026-08-26T14:00:00Z",
  "endTime": "2026-08-26T15:00:00Z"
}
```

### Delete Calendar Event

```http
DELETE /calendar/events/:id
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true
}
```

## User Endpoints

### Get Current User Profile

```http
GET /users/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567890",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+923001234567",
  "avatar": "https://example.com/avatar.jpg",
  "timezone": "Asia/Karachi",
  "language": "en",
  "createdAt": "2026-08-25T10:00:00Z"
}
```

### Update User Profile

```http
PUT /users/me
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "name": "John Smith",
  "phone": "+923007654321",
  "timezone": "Asia/Karachi",
  "language": "en"
}
```

**Response:**
```json
{
  "id": "clx1234567890",
  "name": "John Smith",
  "phone": "+923007654321",
  "timezone": "Asia/Karachi",
  "language": "en"
}
```

### Get User Preferences

```http
GET /users/me/preferences
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clx1234567898",
  "userId": "clx1234567890",
  "aiTone": "professional",
  "notifications": {
    "email": true,
    "push": true,
    "sms": false
  },
  "privacy": {
    "profileVisibility": "private",
    "dataSharing": false
  }
}
```

### Update User Preferences

```http
PUT /users/me/preferences
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "aiTone": "friendly",
  "notifications": {
    "email": true,
    "push": false,
    "sms": true
  }
}
```

**Response:**
```json
{
  "aiTone": "friendly",
  "notifications": {
    "email": true,
    "push": false,
    "sms": true
  }
}
```

### Get User Statistics

```http
GET /users/me/stats
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "memories": 150,
  "tasks": 50,
  "calendars": 3,
  "channels": 5
}
```

### Delete User Account

```http
DELETE /users/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true
}
```

## Health Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-08-25T10:00:00Z",
  "service": "anchor-api",
  "version": "1.0.0"
}
```

### Detailed Health Check

```http
GET /health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "memory": true,
    "uptime": 3600,
    "timestamp": "2026-08-25T10:00:00Z"
  },
  "service": "anchor-api",
  "version": "1.0.0"
}
```

## Channel Endpoints

### WhatsApp Webhook Verification

```http
GET /channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

**Response:**
```
CHALLENGE
```

### WhatsApp Webhook Handler

```http
POST /channels/whatsapp/webhook
```

**Request Body:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "923001234567",
                "type": "text",
                "text": {
                  "body": "Hello, I need help with my crops"
                },
                "timestamp": "1234567890",
                "id": "message-123"
              }
            ],
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "923001234567"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "status": "ok"
}
```

### Telegram Webhook Handler

```http
POST /channels/telegram/webhook
```

**Request Body:**
```json
{
  "message": {
    "chat": {
      "id": 123456789
    },
    "from": {
      "id": 123456789,
      "first_name": "John",
      "last_name": "Doe",
      "username": "johndoe"
    },
    "text": "Hello, I need help",
    "date": 1234567890,
    "message_id": 123
  }
}
```

**Response:**
```json
{
  "status": "ok"
}
```

### Send WhatsApp Message

```http
POST /channels/whatsapp/send
```

**Request Body:**
```json
{
  "userId": "clx1234567890",
  "to": "923001234567",
  "message": "Your task has been completed!"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg_1234567890"
}
```

### Send Telegram Message

```http
POST /channels/telegram/send
```

**Request Body:**
```json
{
  "userId": "clx1234567890",
  "chatId": 123456789,
  "message": "Your task has been completed!"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg_1234567890"
}
```

### Channels Health Check

```http
GET /channels/health
```

**Response:**
```json
{
  "whatsapp": "initialized",
  "telegram": "initialized"
}
```

## Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

### 403 Forbidden

```json
{
  "statusCode": 403,
  "message": "Access denied",
  "error": "Forbidden"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Memory not found",
  "error": "Not Found"
}
```

### 409 Conflict

```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "error": "Conflict"
}
```

### 429 Too Many Requests

```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Rate Limiting

All API endpoints are rate limited:

- **Global**: 100 requests per minute per IP
- **Login**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Password Reset**: 3 attempts per hour per email
- **API Endpoints**: 1000 requests per hour per API key
- **Memory Operations**: 100 per hour per user
- **Search**: 50 queries per hour per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

## Pagination

All list endpoints support pagination:

```http
GET /memory?limit=20&offset=0
```

**Response includes pagination metadata:**

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## Versioning

The API is versioned via URL path:

```
/api/v1/memory
/api/v2/memory
```

Current version: **v1**

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API changes.

---

*Last updated: August 2026*
