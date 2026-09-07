import React, { createContext, useContext, useEffect, useState } from 'react';
import StorageService from '../services/StorageService';
import ApiService from '../services/ApiService';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    StorageService.getAccessToken()
      .then((token) => setIsAuthenticated(!!token))
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = () => setIsAuthenticated(true);

  const signOut = async () => {
    await ApiService.logout();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
