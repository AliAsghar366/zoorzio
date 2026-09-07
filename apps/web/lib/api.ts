import type { AuthTokens, User } from '@anchor/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const ACCESS_TOKEN_KEY = 'anchor_access_token';
const REFRESH_TOKEN_KEY = 'anchor_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: Pick<AuthTokens, 'accessToken' | 'refreshToken'>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const body = await response.json();
    setTokens(body.data);
    return true;
  } catch {
    return false;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuthRetry?: boolean;
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;
  const accessToken = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !skipAuthRetry && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, skipAuthRetry: true });
    }
    clearTokens();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const responseBody = isJson ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const message = Array.isArray(responseBody?.message) ? responseBody.message.join(', ') : responseBody?.message;
    throw new ApiError(response.status, message || response.statusText, responseBody);
  }

  // Successful responses are wrapped by the API's global TransformInterceptor
  // as { success, data, timestamp, path } - unwrap to the actual payload.
  return (responseBody?.data !== undefined ? responseBody.data : responseBody) as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};

export interface LoginResponse {
  user: Pick<User, 'id' | 'email' | 'name' | 'role'>;
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
  setTokens(data);
  return data;
}

export interface RegisterDetails {
  name?: string;
  phone?: string;
  location?: string;
  avatar?: string;
  acceptedPrivacyPolicy?: boolean;
}

export async function register(
  email: string,
  password: string,
  details: RegisterDetails = {},
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, ...details },
  });
  setTokens(data);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    // skipAuthRetry: logging out doesn't need a valid session - if the access
    // token has already expired, there's nothing to refresh and no reason to
    // let that failure block clearing local state and navigating away.
    await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken }, skipAuthRetry: true });
  } catch {
    // Best-effort: the server-side session cleanup is a courtesy, not a
    // requirement - the user is logging out either way.
  } finally {
    clearTokens();
  }
}

export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/auth/me');
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
  return apiFetch('/auth/reset-password', { method: 'POST', body: { token, newPassword } });
}

const IMPERSONATOR_ACCESS_KEY = 'anchor_impersonator_access_token';
const IMPERSONATOR_REFRESH_KEY = 'anchor_impersonator_refresh_token';

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(IMPERSONATOR_ACCESS_KEY) !== null;
}

/** Swaps the current (admin) session for a short-lived session as another user. */
export async function startImpersonation(userId: string): Promise<User> {
  const adminAccessToken = getAccessToken();
  const adminRefreshToken = getRefreshToken();
  if (!adminAccessToken || !adminRefreshToken) {
    throw new ApiError(401, 'You must be logged in as an admin to impersonate a user');
  }

  const data = await apiFetch<{ accessToken: string; user: User }>(`/admin/users/${userId}/impersonate`, {
    method: 'POST',
  });

  window.sessionStorage.setItem(IMPERSONATOR_ACCESS_KEY, adminAccessToken);
  window.sessionStorage.setItem(IMPERSONATOR_REFRESH_KEY, adminRefreshToken);
  setTokens({ accessToken: data.accessToken, refreshToken: '' });
  return data.user;
}

/** Restores the original admin session that started an impersonation. */
export function stopImpersonation(): void {
  if (typeof window === 'undefined') return;
  const adminAccessToken = window.sessionStorage.getItem(IMPERSONATOR_ACCESS_KEY);
  const adminRefreshToken = window.sessionStorage.getItem(IMPERSONATOR_REFRESH_KEY);
  window.sessionStorage.removeItem(IMPERSONATOR_ACCESS_KEY);
  window.sessionStorage.removeItem(IMPERSONATOR_REFRESH_KEY);

  if (adminAccessToken && adminRefreshToken) {
    setTokens({ accessToken: adminAccessToken, refreshToken: adminRefreshToken });
  } else {
    clearTokens();
  }
}

export async function downloadAuditLogCsv(): Promise<void> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/admin/audit-logs/export`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to export audit log');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-log-${Date.now()}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function setUserPlan(userId: string, planId?: string): Promise<{ success: boolean }> {
  return apiFetch(`/admin/users/${userId}/plan`, { method: 'PATCH', body: { planId } });
}

export interface AppNotification {
  id: string;
  type: 'REMINDER_DUE' | 'SHARED_WITH_YOU' | 'SYSTEM';
  title: string;
  message: string;
  isRead: boolean;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
}

export async function getNotifications(unreadOnly = false): Promise<AppNotification[]> {
  return apiFetch(`/notifications?unreadOnly=${unreadOnly}&limit=20`);
}

export async function getUnreadNotificationCount(): Promise<number> {
  return apiFetch('/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  return apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}

export interface Friend {
  friendshipId: string;
  friend: { id: string; email: string; name: string | null; avatar: string | null };
  since: string;
}

export interface FriendRequest {
  id: string;
  createdAt: string;
  requester: { id: string; email: string; name: string | null; avatar: string | null };
}

export interface FriendQuota {
  friends: { used: number; limit: number };
  requestsToday: { used: number; limit: number };
  remindersToday: { used: number; limit: number };
  remindersThisMonth: { used: number; limit: number };
}

export interface FriendReminderReceived {
  id: string;
  message: string;
  scheduledAt: string | null;
  createdAt: string;
  sender: { id: string; email: string; name: string | null; avatar: string | null };
}

export interface GamificationProgress {
  completed: number;
  total: number;
  actions: { key: string; title: string; completed: boolean }[];
}

export async function getGamificationProgress(): Promise<GamificationProgress> {
  return apiFetch('/gamification/progress');
}

export interface LinkedChannel {
  id: string;
  type: 'WHATSAPP' | 'TELEGRAM' | 'SMS' | 'DISCORD' | 'SLACK';
  externalId: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface WhatsAppLinkResult {
  code: string;
  waLink: string | null;
  configured: boolean;
}

export interface TelegramLinkResult {
  deepLink: string | null;
  configured: boolean;
}

export interface SmsLinkResult {
  code: string;
  smsLink: string | null;
  configured: boolean;
}

export interface CodeLinkResult {
  code: string;
  configured: boolean;
}

export const channelsApi = {
  listLinked: () => apiFetch<LinkedChannel[]>('/channels/linked'),
  unlink: (id: string) => apiFetch(`/channels/${id}`, { method: 'DELETE' }),
  linkWhatsApp: () => apiFetch<WhatsAppLinkResult>('/channels/whatsapp/link', { method: 'POST' }),
  linkTelegram: () => apiFetch<TelegramLinkResult>('/channels/telegram/link', { method: 'POST' }),
  linkSms: () => apiFetch<SmsLinkResult>('/channels/sms/link', { method: 'POST' }),
  linkDiscord: () => apiFetch<CodeLinkResult>('/channels/discord/link', { method: 'POST' }),
  linkSlack: () => apiFetch<CodeLinkResult>('/channels/slack/link', { method: 'POST' }),
};

export interface Board {
  id: string;
  name: string;
  createdAt: string;
  _count: { tasks: number };
}

export interface BoardWithTasks extends Omit<Board, '_count'> {
  tasks: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    dueDate?: string | null;
  }[];
}

export const boardsApi = {
  list: () => apiFetch<Board[]>('/boards'),
  create: (name: string) => apiFetch<Board>('/boards', { method: 'POST', body: { name } }),
  get: (id: string) => apiFetch<BoardWithTasks>(`/boards/${id}`),
  rename: (id: string, name: string) => apiFetch<Board>(`/boards/${id}`, { method: 'PUT', body: { name } }),
  remove: (id: string) => apiFetch(`/boards/${id}`, { method: 'DELETE' }),
};

export interface IntegrationCard {
  key: string;
  name: string;
  description: string;
  category: 'Active' | 'Documents' | 'Calendar' | 'Email' | 'Team Chat';
  isConnected: boolean;
  connectedAt: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  stars: number;
  updatedAt: string;
}

export interface GitHubIssue {
  id: number;
  title: string;
  number: number;
  repo: string;
  url: string;
  state: string;
  updatedAt: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEditedAt: string;
  object: 'page' | 'database';
}

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  modifiedAt: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
}

export const integrationsApi = {
  list: () => apiFetch<IntegrationCard[]>('/integrations'),
  authorize: (provider: string) => apiFetch<{ url: string }>(`/integrations/${provider}/authorize`),
  disconnect: (key: string) => apiFetch(`/integrations/${key}`, { method: 'DELETE' }),
  githubRepos: () => apiFetch<GitHubRepo[]>('/integrations/github/repos'),
  githubIssues: () => apiFetch<GitHubIssue[]>('/integrations/github/issues'),
  notionSearch: (query?: string) => apiFetch<NotionPage[]>(`/integrations/notion/search${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  googleWorkspaceEmails: () => apiFetch<GmailMessage[]>('/integrations/google-workspace/emails'),
  googleWorkspaceFiles: () => apiFetch<DriveFile[]>('/integrations/google-workspace/files'),
  slackChannels: () => apiFetch<SlackChannel[]>('/integrations/slack/channels'),
  slackSend: (channelId: string, message: string) =>
    apiFetch<{ ts: string }>('/integrations/slack/send', { method: 'POST', body: { channelId, message } }),
};

export const friendsApi = {
  list: () => apiFetch<Friend[]>('/friends'),
  requests: () => apiFetch<FriendRequest[]>('/friends/requests'),
  quota: () => apiFetch<FriendQuota>('/friends/quota'),
  reminders: () => apiFetch<FriendReminderReceived[]>('/friends/reminders'),
  sendRequest: (targetEmail: string) => apiFetch('/friends/request', { method: 'POST', body: { targetEmail } }),
  accept: (id: string) => apiFetch(`/friends/${id}/accept`, { method: 'POST' }),
  decline: (id: string) => apiFetch(`/friends/${id}/decline`, { method: 'POST' }),
  remove: (id: string) => apiFetch(`/friends/${id}`, { method: 'DELETE' }),
  remind: (friendId: string, message: string) =>
    apiFetch(`/friends/${friendId}/remind`, { method: 'POST', body: { message } }),
};
