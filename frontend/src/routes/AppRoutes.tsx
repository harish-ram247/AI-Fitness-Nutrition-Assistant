import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import {
  LoginPage,
  RegisterPage,
  NotFoundPage,
} from '../pages/PlaceholderPages';

// Route-level code splitting for secondary feature pages
const ProfilePage = React.lazy(() =>
  import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const NutritionPage = React.lazy(() =>
  import('../features/nutrition/NutritionPage').then((m) => ({ default: m.NutritionPage })),
);
const WorkoutsPage = React.lazy(() =>
  import('../features/workouts/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })),
);
const RecommendationsPage = React.lazy(() =>
  import('../features/recommendations/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })),
);
const AIAssistantPage = React.lazy(() =>
  import('../features/ai/AIAssistantPage').then((m) => ({ default: m.AIAssistantPage })),
);

/**
 * AppRoutes: Root route table for the application.
 * Defines public authentication routes, protected application routes, and 404 handler.
 */
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Public Routes (Auth Layout) */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected Routes (App Layout) */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/ai" element={<AIAssistantPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
