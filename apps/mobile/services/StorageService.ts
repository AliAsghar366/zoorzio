import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  // Secure Storage (for sensitive data)
  async setSecureItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error setting secure item:', error);
      throw error;
    }
  }

  async getSecureItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error getting secure item:', error);
      return null;
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing secure item:', error);
      throw error;
    }
  }

  // Regular Storage (for non-sensitive data)
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error setting item:', error);
      throw error;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error getting item:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Auth Token Management
  async setAccessToken(token: string): Promise<void> {
    await this.setSecureItem('access_token', token);
  }

  async getAccessToken(): Promise<string | null> {
    return this.getSecureItem('access_token');
  }

  async setRefreshToken(token: string): Promise<void> {
    await this.setSecureItem('refresh_token', token);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.getSecureItem('refresh_token');
  }

  async clearAuthTokens(): Promise<void> {
    await this.removeSecureItem('access_token');
    await this.removeSecureItem('refresh_token');
  }

  // User Preferences
  async setUserPreferences(preferences: Record<string, any>): Promise<void> {
    await this.setItem('user_preferences', preferences);
  }

  async getUserPreferences(): Promise<Record<string, any> | null> {
    return this.getItem<Record<string, any>>('user_preferences');
  }

  // Cache Management
  async setCacheItem(key: string, value: any, ttl: number = 3600): Promise<void> {
    const cacheItem = {
      value,
      expiresAt: Date.now() + ttl * 1000,
    };
    await this.setItem(`cache_${key}`, cacheItem);
  }

  async getCacheItem<T>(key: string): Promise<T | null> {
    const cacheItem = await this.getItem<{ value: T; expiresAt: number }>(
      `cache_${key}`
    );

    if (!cacheItem) {
      return null;
    }

    if (Date.now() > cacheItem.expiresAt) {
      await this.removeItem(`cache_${key}`);
      return null;
    }

    return cacheItem.value;
  }

  async clearExpiredCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith('cache_'));

      for (const key of cacheKeys) {
        const cacheItem = await this.getItem<{ expiresAt: number }>(key);
        if (cacheItem && Date.now() > cacheItem.expiresAt) {
          await this.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }
}

export default StorageService.getInstance();
