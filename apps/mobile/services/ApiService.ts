import StorageService from './StorageService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method: string;
  headers?: Record<string, string>;
  body?: any;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export class ApiService {
  private static instance: ApiService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = API_BASE_URL;
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await StorageService.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...(await this.getAuthHeaders()),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry request with new token
            return this.request<T>(endpoint, options);
          }
          // Logout user
          await this.logout();
          throw new Error('Session expired');
        }
        throw new Error(data.message || 'Request failed');
      }

      return data.data || data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<any> {
    const response = await this.request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    await StorageService.setAccessToken(response.accessToken);
    await StorageService.setRefreshToken(response.refreshToken);

    return response;
  }

  async register(
    email: string,
    password: string,
    name?: string
  ): Promise<any> {
    const response = await this.request<any>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });

    await StorageService.setAccessToken(response.accessToken);
    await StorageService.setRefreshToken(response.refreshToken);

    return response;
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await StorageService.getRefreshToken();
      if (!refreshToken) return false;

      const response = await this.request<any>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });

      await StorageService.setAccessToken(response.accessToken);
      await StorageService.setRefreshToken(response.refreshToken);

      return true;
    } catch (error) {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = await StorageService.getRefreshToken();
      if (refreshToken) {
        await this.request<any>('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await StorageService.clearAuthTokens();
    }
  }

  // Memory endpoints
  async getMemories(params?: {
    type?: string;
    source?: string;
    tags?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.source) queryParams.append('source', params.source);
    if (params?.tags) queryParams.append('tags', params.tags.join(','));
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const endpoint = `/memory${queryString ? `?${queryString}` : ''}`;

    return this.request<any[]>(endpoint, { method: 'GET' });
  }

  async getMemory(id: string): Promise<any> {
    return this.request<any>(`/memory/${id}`, { method: 'GET' });
  }

  async createMemory(data: {
    content: string;
    type?: string;
    source?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }): Promise<any> {
    return this.request<any>('/memory', {
      method: 'POST',
      body: data,
    });
  }

  async createVoiceMemory(audioBase64: string, tags?: string[]): Promise<any> {
    return this.request<any>('/memory/voice', {
      method: 'POST',
      body: { audioBase64, tags },
    });
  }

  async updateMemory(
    id: string,
    data: {
      content?: string;
      type?: string;
      source?: string;
      metadata?: Record<string, any>;
      tags?: string[];
    }
  ): Promise<any> {
    return this.request<any>(`/memory/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.request<any>(`/memory/${id}`, { method: 'DELETE' });
  }

  async searchMemories(query: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.append('limit', limit.toString());

    return this.request<any[]>(`/memory/search?${params.toString()}`, {
      method: 'GET',
    });
  }

  // Task endpoints
  async getTasks(params?: {
    status?: string;
    limit?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const endpoint = `/tasks${queryString ? `?${queryString}` : ''}`;

    return this.request<any[]>(endpoint, { method: 'GET' });
  }

  async getTask(id: string): Promise<any> {
    return this.request<any>(`/tasks/${id}`, { method: 'GET' });
  }

  async createTask(data: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    memoryId?: string;
  }): Promise<any> {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: data,
    });
  }

  async updateTask(
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      dueDate?: string;
    }
  ): Promise<any> {
    return this.request<any>(`/tasks/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async completeTask(id: string): Promise<any> {
    return this.request<any>(`/tasks/${id}/complete`, {
      method: 'PUT',
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request<any>(`/tasks/${id}`, { method: 'DELETE' });
  }

  // Calendar endpoints
  async getCalendarEvents(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const queryString = queryParams.toString();
    const endpoint = `/calendar/events${queryString ? `?${queryString}` : ''}`;

    return this.request<any[]>(endpoint, { method: 'GET' });
  }

  async getTodayEvents(): Promise<any[]> {
    return this.request<any[]>('/calendar/today', { method: 'GET' });
  }

  async getUpcomingEvents(days?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());

    const queryString = params.toString();
    const endpoint = `/calendar/upcoming${queryString ? `?${queryString}` : ''}`;

    return this.request<any[]>(endpoint, { method: 'GET' });
  }

  // User endpoints
  async getProfile(): Promise<any> {
    return this.request<any>('/users/me', { method: 'GET' });
  }

  async updateProfile(data: {
    name?: string;
    phone?: string;
    timezone?: string;
    language?: string;
  }): Promise<any> {
    return this.request<any>('/users/me', {
      method: 'PUT',
      body: data,
    });
  }

  async getStats(): Promise<any> {
    return this.request<any>('/users/me/stats', { method: 'GET' });
  }

  async deleteAccount(): Promise<void> {
    await this.request<any>('/users/me', { method: 'DELETE' });
    // The account (and its sessions) no longer exist server-side, so just
    // drop local tokens instead of calling /auth/logout with a dead token.
    await StorageService.clearAuthTokens();
  }
}

export default ApiService.getInstance();
