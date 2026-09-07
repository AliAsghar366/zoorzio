import {
  MemoryType,
  ChannelType,
  TaskStatus,
  TaskPriority,
  CalendarProvider,
} from './enums';

// Shape of API responses as consumed by web/mobile clients.
// These intentionally mirror packages/database/prisma/schema.prisma
// but use plain string dates (JSON over the wire) instead of Date objects.

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  location?: string | null;
  role: UserRole;
  timezone: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  userId: string;
  content: string;
  summary?: string | null;
  type: MemoryType;
  source: ChannelType;
  metadata: Record<string, unknown>;
  tags: string[];
  isArchived: boolean;
  isVerified: boolean;
  lastAccessed: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  memoryId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId?: string | null;
  memoryId?: string | null;
  title: string;
  message?: string | null;
  scheduledAt: string;
  completedAt?: string | null;
}

export interface Calendar {
  id: string;
  userId: string;
  provider: CalendarProvider;
  externalId: string;
  name: string;
  color?: string | null;
  isActive: boolean;
  lastSync?: string | null;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  externalId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  calendar?: Pick<Calendar, 'name' | 'color' | 'provider'>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
