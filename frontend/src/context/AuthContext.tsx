import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { apiClient } from '../api/client';
import { authApi } from '../features/auth/authApi';
import {
  ChangePasswordRequest,
  UserLoginRequest,
  UserRead,
  UserRegisterRequest,
} from '../types/user';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserRead | null;
  accessToken: string | null;
  login: (credentials: UserLoginRequest) => Promise<void>;
  register: (data: UserRegisterRequest) => Promise<UserRead>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  reloadCurrentUser: () => Promise<UserRead | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserRead | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('fitness_access_token') : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep a mutable ref of the current access token for synchronous API client calls
  const accessTokenRef = useRef<string | null>(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  /**
   * Internal session cleanup on expiration or logout.
   */
  const handleAuthExpired = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fitness_access_token');
        localStorage.removeItem('fitness_refresh_token');
      }
    } catch {
      // Storage unavailable
    }
    accessTokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  /**
   * Refresh session exchanging stored refresh token for a new access token.
   * Bound to ApiClient onUnauthorized to handle 401s automatically.
   */
  const refreshSession = useCallback(async (): Promise<string | null> => {
    let storedRefreshToken: string | null = null;
    try {
      if (typeof window !== 'undefined') {
        storedRefreshToken = localStorage.getItem('fitness_refresh_token');
      }
    } catch {
      storedRefreshToken = null;
    }

    if (!storedRefreshToken) {
      handleAuthExpired();
      return null;
    }

    try {
      const tokenResponse = await authApi.refresh({ refresh_token: storedRefreshToken });
      const newAccessToken = tokenResponse.access_token;

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('fitness_access_token', newAccessToken);
          // Update refresh token if server sent a fresh one, otherwise preserve
          if (tokenResponse.refresh_token) {
            localStorage.setItem('fitness_refresh_token', tokenResponse.refresh_token);
          }
        }
      } catch {
        // Storage unavailable
      }

      accessTokenRef.current = newAccessToken;
      setAccessToken(newAccessToken);
      return newAccessToken;
    } catch {
      handleAuthExpired();
      return null;
    }
  }, [handleAuthExpired]);

  /**
   * Reload currently authenticated user profile from GET /api/v1/users/me.
   */
  const reloadCurrentUser = useCallback(async (): Promise<UserRead | null> => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Configure ApiClient callbacks
  useEffect(() => {
    apiClient.setTokenGetter(() => accessTokenRef.current);
    apiClient.setOnUnauthorized(refreshSession);
    apiClient.setOnAuthExpired(handleAuthExpired);
  }, [refreshSession, handleAuthExpired]);

  /**
   * Initialize session on mount:
   * 1. Check for stored access token
   * 2. If present, load current user
   * 3. If access token missing or fails, attempt refresh
   */
  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      setIsLoading(true);
      let initialAccessToken: string | null = null;
      let initialRefreshToken: string | null = null;

      try {
        if (typeof window !== 'undefined') {
          initialAccessToken = localStorage.getItem('fitness_access_token');
          initialRefreshToken = localStorage.getItem('fitness_refresh_token');
        }
      } catch {
        // Storage unavailable
      }

      if (initialAccessToken) {
        accessTokenRef.current = initialAccessToken;
        setAccessToken(initialAccessToken);

        try {
          const currentUser = await authApi.getCurrentUser();
          if (isMounted) {
            setUser(currentUser);
            setIsLoading(false);
          }
          return;
        } catch {
          // Access token might be expired; refreshSession will be attempted below
        }
      }

      // If no valid access token or users/me failed, try refresh token
      if (initialRefreshToken) {
        const refreshed = await refreshSession();
        if (refreshed && isMounted) {
          try {
            const currentUser = await authApi.getCurrentUser();
            if (isMounted) {
              setUser(currentUser);
              setIsLoading(false);
            }
            return;
          } catch {
            // Failed to fetch user after refresh
          }
        }
      }

      // Neither token worked or available
      if (isMounted) {
        handleAuthExpired();
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
    };
  }, [refreshSession, handleAuthExpired]);

  /**
   * Login with email and password.
   */
  const login = useCallback(
    async (credentials: UserLoginRequest): Promise<void> => {
      setIsLoading(true);
      try {
        const tokenResponse = await authApi.login(credentials);

        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('fitness_access_token', tokenResponse.access_token);
            localStorage.setItem('fitness_refresh_token', tokenResponse.refresh_token);
          }
        } catch {
          // Storage unavailable
        }

        accessTokenRef.current = tokenResponse.access_token;
        setAccessToken(tokenResponse.access_token);

        // Fetch user record
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Register a new user.
   */
  const register = useCallback(
    async (data: UserRegisterRequest): Promise<UserRead> => {
      return authApi.register(data);
    },
    [],
  );

  /**
   * Logout user and clear tokens.
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Stateless backend token disposal; proceed with local cleanup
    } finally {
      handleAuthExpired();
    }
  }, [handleAuthExpired]);

  /**
   * Change password for the current user.
   */
  const changePassword = useCallback(
    async (data: ChangePasswordRequest): Promise<void> => {
      await authApi.changePassword(data);
    },
    [],
  );

  const contextValue: AuthContextType = {
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    user,
    accessToken,
    login,
    register,
    logout,
    refreshSession,
    changePassword,
    reloadCurrentUser,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

/**
 * Hook to consume AuthContext.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
