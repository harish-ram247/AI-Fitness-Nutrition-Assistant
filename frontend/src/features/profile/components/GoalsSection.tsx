import React, { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../profileApi';
import { ApiError } from '../../../api/errors';
import { formatDate } from '../../../utils/date';
import { GoalModal } from './GoalModal';
import { DeleteGoalModal } from './DeleteGoalModal';
import type { FitnessGoalRead } from '../../../types/goal';

export const GoalsSection: React.FC = () => {
  const [goals, setGoals] = useState<FitnessGoalRead[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isGoalModalOpen, setIsGoalModalOpen] = useState<boolean>(false);
  const [goalToEdit, setGoalToEdit] = useState<FitnessGoalRead | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [goalToDelete, setGoalToDelete] = useState<FitnessGoalRead | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const statusParam = selectedStatus !== 'all' ? selectedStatus : undefined;
      const res = await profileApi.listGoals(statusParam);
      setGoals(res.items);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load fitness goals.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleOpenCreateModal = () => {
    setGoalToEdit(null);
    setIsGoalModalOpen(true);
  };

  const handleOpenEditModal = (goal: FitnessGoalRead) => {
    setGoalToEdit(goal);
    setIsGoalModalOpen(true);
  };

  const handleOpenDeleteModal = (goal: FitnessGoalRead) => {
    setGoalToDelete(goal);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleGoalSaved = (savedGoal: FitnessGoalRead) => {
    setGoals((prev) => {
      const index = prev.findIndex((g) => g.id === savedGoal.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = savedGoal;
        return copy;
      }
      return [savedGoal, ...prev];
    });
  };

  const handleConfirmDelete = async () => {
    if (!goalToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await profileApi.deleteGoal(goalToDelete.id);
      setGoals((prev) => prev.filter((g) => g.id !== goalToDelete.id));
      setIsDeleteModalOpen(false);
      setGoalToDelete(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete goal. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleComplete = async (goal: FitnessGoalRead) => {
    const nextStatus = goal.status === 'completed' ? 'active' : 'completed';
    try {
      const updated = await profileApi.updateGoal(goal.id, { status: nextStatus });
      handleGoalSaved(updated);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-6)',
        marginBottom: 'var(--spacing-6)',
      }}
    >
      {/* Header and Add Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Fitness Goals
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>
            Set, track, and celebrate your physical health milestones.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            padding: 'var(--spacing-2) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
          }}
        >
          <span>+</span>
          <span>Add New Goal</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--spacing-2)' }}>
        {[
          { id: 'all', label: 'All Goals' },
          { id: 'active', label: 'Active' },
          { id: 'completed', label: 'Completed' },
          { id: 'abandoned', label: 'Abandoned' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedStatus(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: selectedStatus === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: selectedStatus === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: selectedStatus === tab.id ? 600 : 400,
              padding: 'var(--spacing-1) var(--spacing-3)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            marginBottom: 'var(--spacing-4)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadGoals}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div
          data-testid="goals-loading"
          style={{
            padding: 'var(--spacing-8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Loading fitness goals...
          </span>
        </div>
      ) : goals.length === 0 ? (
        /* Empty State */
        <div
          data-testid="goals-empty"
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-10) var(--spacing-4)',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-2)' }}>🎯</div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--spacing-1) 0' }}>
            No Fitness Goals Found
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--spacing-4) 0', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
            {selectedStatus !== 'all'
              ? `You don't have any goals marked as "${selectedStatus}".`
              : 'Set your first fitness milestone to track your transformation and get personalized coaching.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        /* Goal Cards List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          {goals.map((goal) => {
            const isCompleted = goal.status === 'completed';
            const isAbandoned = goal.status === 'abandoned';

            return (
              <div
                key={goal.id}
                data-testid={`goal-item-${goal.id}`}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-3)',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-primary)',
                        backgroundColor: 'var(--bg-surface-hover)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {goal.goal_type.replace(/_/g, ' ')}
                    </span>

                    {/* Status Badge */}
                    <span
                      data-testid={`goal-status-${goal.id}`}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: isCompleted
                          ? 'rgba(34, 197, 94, 0.15)'
                          : isAbandoned
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)',
                        color: isCompleted
                          ? 'var(--color-success)'
                          : isAbandoned
                          ? 'var(--color-error)'
                          : 'var(--color-primary)',
                      }}
                    >
                      {goal.status}
                    </span>
                  </div>

                  {/* Description / Title */}
                  <h4
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 600,
                      color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      margin: '0 0 var(--spacing-1) 0',
                    }}
                  >
                    {goal.description || goal.goal_type.replace(/_/g, ' ')}
                  </h4>

                  {/* Target & Date */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-4)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                    {goal.target_value != null && (
                      <span>
                        Target: <strong style={{ color: 'var(--text-primary)' }}>{goal.target_value} {goal.target_unit || ''}</strong>
                      </span>
                    )}
                    {goal.target_date && (
                      <span>
                        Target Date: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(goal.target_date)}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(goal)}
                    title={isCompleted ? 'Mark as active' : 'Mark as complete'}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: isCompleted ? 'var(--color-success)' : 'var(--text-secondary)',
                      padding: 'var(--spacing-1) var(--spacing-3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    {isCompleted ? '✓ Completed' : 'Mark Done'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(goal)}
                    aria-label={`Edit goal ${goal.description || goal.goal_type}`}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: 'var(--spacing-1) var(--spacing-3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(goal)}
                    aria-label={`Delete goal ${goal.description || goal.goal_type}`}
                    style={{
                      backgroundColor: 'var(--color-error-bg)',
                      border: '1px solid var(--color-error)',
                      color: 'var(--color-error)',
                      padding: 'var(--spacing-1) var(--spacing-3)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        goalToEdit={goalToEdit}
        onGoalSaved={handleGoalSaved}
      />

      {/* Goal Delete Confirmation Modal */}
      <DeleteGoalModal
        isOpen={isDeleteModalOpen}
        goal={goalToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setGoalToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};
