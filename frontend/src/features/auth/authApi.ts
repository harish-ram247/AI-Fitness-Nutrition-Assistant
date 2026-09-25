import { apiClient } from '../../api/client';
import {
  ChangePasswordRequest,
  MessageResponse,
  RefreshTokenRequest,
  TokenResponse,
  UserLoginRequest,
  UserRead,
  UserRegisterRequest,
} from '../../types/user';

/**
 * Authentication & User API service mapping strictly to backend endpoints:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 * - POST /api/v1/auth/change-password
 * - GET  /api/v1/users/me
 */
export const authApi = {
  /**
   * Register a new user account.
   * Backend returns UserRead with status 201.
   */
  async register(data: UserRegisterRequest): Promise<UserRead> {
    return apiClient.post<UserRead>('/api/v1/auth/register', data);
  },

  /**
   * Authenticate with email & password.
   * Backend returns TokenResponse (access_token, refresh_token) with status 200.
   */
  async login(data: UserLoginRequest): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/api/v1/auth/login', data);
  },

  /**
   * Exchange refresh token for a new access token.
   * Backend returns TokenResponse with status 200.
   */
  async refresh(data: RefreshTokenRequest): Promise<TokenResponse> {
    return apiClient.post<TokenResponse>('/api/v1/auth/refresh', data);
  },

  /**
   * Stateless token logout confirmation.
   * Requires Bearer access token; backend returns 204 No Content.
   */
  async logout(): Promise<void> {
    await apiClient.post<null>('/api/v1/auth/logout');
  },

  /**
   * Change user password with current password verification.
   * Backend returns {"message": "Password updated successfully"} with status 200.
   */
  async changePassword(data: ChangePasswordRequest): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>('/api/v1/auth/change-password', data);
  },

  /**
   * Fetch currently authenticated user account information.
   * Requires Bearer access token; backend returns UserRead with status 200.
   */
  async getCurrentUser(): Promise<UserRead> {
    return apiClient.get<UserRead>('/api/v1/users/me');
  },
};
