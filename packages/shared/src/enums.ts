// Mirrors the enums defined in packages/database/prisma/schema.prisma.
// Kept as plain TS (not re-exported from @prisma/client) so client apps
// (web, mobile) can use these without pulling in Prisma's server-only client.

export enum MemoryType {
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

export enum ChannelType {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  VOICE = 'VOICE',
  NATIVE_APP = 'NATIVE_APP',
  WEB = 'WEB',
  API = 'API',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum CalendarProvider {
  GOOGLE = 'GOOGLE',
  OUTLOOK = 'OUTLOOK',
  APPLE = 'APPLE',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  LOCATION = 'LOCATION',
}

export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum IntegrationType {
  NOTION = 'NOTION',
  SLACK = 'SLACK',
  JIRA = 'JIRA',
  GOOGLE_WORKSPACE = 'GOOGLE_WORKSPACE',
  TRELLO = 'TRELLO',
  ASANA = 'ASANA',
  CUSTOM = 'CUSTOM',
}
