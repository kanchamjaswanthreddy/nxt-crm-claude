"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchTasks, updateTaskStatus, updateTaskDetails, deleteTask } from '@/app/actions/tasks';
import TaskQuickAddModal from '@/components/TaskQuickAddModal';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CalendarView({ tasks, month, onMonthChange, onTaskClick, getPriorityColor, isOverdue, userUid }) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDay = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) => d === today.getDate() && mon === today.getMonth() && year === today.getFullYear();

  // Build map of date -> tasks
  const tasksByDate = {};
  tasks.forEach(t => {
    if (!t.dueAt) return;
    const due = new Date(t.dueAt);
    if (due.getMonth() === mon && due.getFullYear() === year) {
      const day = due.getDate();
      if (!tasksByDate[day]) tasksByDate[day] = [];
      tasksByDate[day].push(t);
    }
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => onMonthChange(new Date(year, mon - 1, 1));
  const nextMonth = () => onMonthChange(new Date(year, mon + 1, 1));
  const goToday = () => onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Card style={{ padding: 'var(--space-3)' }}>
      {/* Calendar header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px' }}>&larr;</button>
          <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-body)', fontWeight: '600', minWidth: '180px', textAlign: 'center' }}>{monthLabel}</h3>
          <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 10px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px' }}>&rarr;</button>
        </div>
        <button onClick={goToday} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '4px 14px', cursor: 'pointer', color: 'var(--brand-navy)', fontSize: 'var(--text-caption)', fontWeight: '500' }}>Today</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '1px' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', backgroundColor: 'var(--border-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {cells.map((day, i) => {
          const dayTasks = day ? (tasksByDate[day] || []) : [];
          return (
            <div key={i} style={{
              backgroundColor: day ? 'var(--surface-card)' : 'var(--surface-inset)',
              minHeight: '90px',
              padding: '4px',
              position: 'relative',
            }}>
              {day && (
                <>
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: isToday(day) ? '700' : '400',
                    color: isToday(day) ? 'var(--brand-gold)' : 'var(--text-secondary)',
                    marginBottom: '2px',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isToday(day) ? 'rgba(201, 154, 61, 0.12)' : 'transparent',
                  }}>
                    {day}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {dayTasks.slice(0, 3).map(t => (
                      <button
                        key={t.id}
                        onClick={() => onTaskClick(t)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '2px 4px',
                          fontSize: '10px',
                          lineHeight: '1.3',
                          fontWeight: '500',
                          color: t.status === 'completed' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                          textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                          backgroundColor: t.status === 'completed' ? 'rgba(0,0,0,0.03)' : `color-mix(in srgb, ${getPriorityColor(t.priority)} 10%, transparent)`,
                          borderLeft: `2px solid ${getPriorityColor(t.priority)}`,
                          borderRadius: '2px',
                          border: 'none',
                          borderLeftWidth: '2px',
                          borderLeftStyle: 'solid',
                          borderLeftColor: getPriorityColor(t.priority),
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', paddingLeft: '4px' }}>+{dayTasks.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  // Detail modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', dueAt: '' });
  const [isSaving, setIsSaving] = useState(false);

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'medium',
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
    });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) return toast.info('Title is required');
    setIsSaving(true);
    const res = await updateTaskDetails(selectedTask.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      priority: editForm.priority,
      dueAt: editForm.dueAt ? new Date(editForm.dueAt + 'T23:59:59').toISOString() : null,
    });
    setIsSaving(false);
    if (res.success) {
      const updated = { ...selectedTask, ...editForm, dueAt: editForm.dueAt ? new Date(editForm.dueAt + 'T23:59:59').toISOString() : null };
      setSelectedTask(updated);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, ...updated } : t));
      setIsEditing(false);
    } else {
      toast.error('Failed to save: ' + res.error);
    }
  };

  // Filters
  const [viewType, setViewType] = useState('my');
  const [viewMode, setViewMode] = useState('list');
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [statusFilter, setStatusFilter] = useState('open');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = userProfile?.is_owner || ['admin', 'it_engineer'].includes(userProfile?.role);

  const loadTasks = async (profile, currentView) => {
    setIsLoading(true);
    try {
      const res = await fetchTasks(
        profile.hierarchyPath,
        currentView,
        profile.is_owner || ['admin', 'it_engineer'].includes(profile.role)
      );
      if (res.success) {
        setTasks(res.tasks);
      } else {
        // silenced
      }
    } catch (e) {
      // silenced
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (userProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTasks(userProfile, viewType);
    }
  }, [userProfile, viewType]);

  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'open' ? 'completed' : 'open';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    const res = await updateTaskStatus(task.id, newStatus);
    if (!res.success) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      toast.error("Failed to update task: " + res.error);
    }
  };

  const handleDelete = (taskId) => {
    setConfirmState({
      open: true,
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      variant: 'danger',
      onConfirm: async () => {
        const res = await deleteTask(taskId);
        if (res.success) {
          setTasks(prev => prev.filter(t => t.id !== taskId));
        } else {
          toast.error("Failed to delete task: " + res.error);
        }
      },
    });
  };

  const isOverdue = (dueAt) => dueAt && new Date(dueAt) < new Date();
  const isDueToday = (dueAt) => {
    if (!dueAt) return false;
    const due = new Date(dueAt);
    const today = new Date();
    return due.getDate() === today.getDate() && due.getMonth() === today.getMonth() && due.getFullYear() === today.getFullYear();
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchAssignee = t.ownerAgentName?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => {
    const aOverdue = a.status === 'open' && isOverdue(a.dueAt);
    const bOverdue = b.status === 'open' && isOverdue(b.dueAt);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return new Date(a.dueAt || 0) - new Date(b.dueAt || 0);
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'var(--status-error, #D33F3F)';
      case 'medium': return 'var(--brand-gold)';
      case 'low': return 'var(--brand-silver, #A9ACB1)';
      default: return 'var(--brand-silver, #A9ACB1)';
    }
  };

  const openCount = tasks.filter(t => t.status === 'open').length;
  const overdueCount = tasks.filter(t => t.status === 'open' && isOverdue(t.dueAt)).length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>Tasks</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', margin: '4px 0 0 0' }}>
            {viewType === 'my' ? 'Your tasks' : 'All team tasks'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {isAdmin && (
            <div style={{ display: 'flex', backgroundColor: 'var(--surface-card)', borderRadius: '999px', padding: '4px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setViewType('my')}
                style={{
                  padding: 'var(--space-1) 16px', borderRadius: '999px', border: 'none',
                  backgroundColor: viewType === 'my' ? 'var(--brand-navy)' : 'transparent',
                  color: viewType === 'my' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 'var(--text-caption)', fontWeight: '500',
                }}
              >
                My Tasks
              </button>
              <button
                onClick={() => setViewType('team')}
                style={{
                  padding: 'var(--space-1) 16px', borderRadius: '999px', border: 'none',
                  backgroundColor: viewType === 'team' ? 'var(--brand-navy)' : 'transparent',
                  color: viewType === 'team' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 'var(--text-caption)', fontWeight: '500',
                }}
              >
                Team Tasks
              </button>
            </div>
          )}
          <div style={{ display: 'flex', backgroundColor: 'var(--surface-card)', borderRadius: '999px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: 'var(--space-1) 16px', borderRadius: '999px', border: 'none',
                backgroundColor: viewMode === 'list' ? 'var(--brand-navy)' : 'transparent',
                color: viewMode === 'list' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 'var(--text-caption)', fontWeight: '500',
              }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: 'var(--space-1) 16px', borderRadius: '999px', border: 'none',
                backgroundColor: viewMode === 'calendar' ? 'var(--brand-navy)' : 'transparent',
                color: viewMode === 'calendar' ? 'white' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 'var(--text-caption)', fontWeight: '500',
              }}
            >
              Calendar
            </button>
          </div>
          <Button onClick={() => setIsTaskModalOpen(true)}>+ New Task</Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView
          tasks={tasks}
          month={calMonth}
          onMonthChange={setCalMonth}
          onTaskClick={openTaskDetail}
          getPriorityColor={getPriorityColor}
          isOverdue={isOverdue}
          userUid={userProfile?.uid}
        />
      ) : (
      <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <Card style={{ padding: 'var(--space-2) var(--space-3)', cursor: 'pointer', border: statusFilter === 'open' ? '2px solid var(--brand-navy)' : undefined }}
          onClick={() => setStatusFilter('open')}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Open</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--brand-navy)' }}>{openCount}</p>
        </Card>
        <Card style={{ padding: 'var(--space-2) var(--space-3)', cursor: 'pointer', border: statusFilter === 'overdue' ? '2px solid var(--status-error)' : undefined }}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'open' : 'overdue')}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Overdue</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: overdueCount > 0 ? 'var(--status-error)' : 'var(--brand-navy)' }}>{overdueCount}</p>
        </Card>
        <Card style={{ padding: 'var(--space-2) var(--space-3)', cursor: 'pointer', border: statusFilter === 'completed' ? '2px solid var(--status-success)' : undefined }}
          onClick={() => setStatusFilter('completed')}>
          <p style={{ margin: '0 0 4px 0', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Completed</p>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--status-success)' }}>{completedCount}</p>
        </Card>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: 'var(--space-1) 16px', borderRadius: '12px',
            border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)',
            fontFamily: 'inherit', fontSize: 'var(--text-secondary)',
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: 'var(--space-1) 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)' }}
        >
          <option value="open">Open</option>
          <option value="completed">Completed</option>
          <option value="all">All Statuses</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          style={{ padding: 'var(--space-1) 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)' }}
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Task List */}
      {isLoading && tasks.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-secondary)' }}>
          Loading tasks...
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 'var(--text-body)', marginBottom: 'var(--space-2)' }}>
            {statusFilter === 'open' ? "No open tasks — you're all caught up!" : "No tasks found for the current filters."}
          </p>
          <Button onClick={() => setIsTaskModalOpen(true)}>+ Create Task</Button>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {filteredTasks.map(task => {
            const overdue = task.status === 'open' && isOverdue(task.dueAt);
            const dueToday = task.status === 'open' && isDueToday(task.dueAt);
            const isCompleted = task.status === 'completed';
            const isMyTask = task.ownerAgentId === userProfile?.uid;

            return (
              <Card key={task.id} style={{
                padding: 'var(--space-2) var(--space-3)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                opacity: isCompleted ? 0.7 : 1,
                borderLeft: overdue ? '4px solid var(--status-error)' : dueToday ? '4px solid var(--status-warning)' : '4px solid transparent',
              }}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={() => handleToggleStatus(task)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--brand-gold)', flexShrink: 0 }}
                />

                {/* Content */}
                <div role="button" tabIndex={0} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openTaskDetail(task)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTaskDetail(task); } }}>
                  <div style={{
                    fontWeight: '600', marginBottom: '4px', fontSize: 'var(--text-secondary)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    color: isCompleted ? 'var(--text-secondary)' : 'var(--brand-navy)',
                  }}>
                    {task.title}
                  </div>

                  {task.description && (
                    <div style={{
                      fontSize: 'var(--text-caption)', color: 'var(--text-secondary)',
                      marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    {/* Priority */}
                    <div style={{
                      padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(0,0,0,0.05)',
                      color: getPriorityColor(task.priority), fontWeight: '600',
                    }}>
                      {(task.priority || 'medium').toUpperCase()}
                    </div>

                    {/* Due date */}
                    <div style={{
                      color: overdue ? 'var(--status-error)' : dueToday ? 'var(--status-warning)' : 'inherit',
                      fontWeight: overdue || dueToday ? '600' : '400',
                    }}>
                      {overdue ? 'Overdue' : dueToday ? 'Due Today' : task.dueAt ? 'Due ' + new Date(task.dueAt).toLocaleDateString('en-US') : ''}
                    </div>

                    {/* Assignee — show in team view or if created by someone else */}
                    {(viewType === 'team' || !isMyTask) && task.ownerAgentName && (
                      <div style={{
                        padding: '2px 8px', borderRadius: '999px',
                        backgroundColor: 'rgba(15, 42, 82, 0.06)',
                        fontWeight: '500', color: 'var(--brand-navy)',
                      }}>
                        {isMyTask ? 'You' : task.ownerAgentName}
                      </div>
                    )}

                    {/* Created by — show if different from assignee */}
                    {task.createdByAgentId && task.createdByAgentId !== task.ownerAgentId && task.createdByAgentName && (
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                        by {task.createdByAgentName}
                      </div>
                    )}

                    {/* Linked lead/deal */}
                    {task.relatedDealId && (
                      <Link href={`/dashboard/deals/${task.relatedDealId}`} style={{ color: 'var(--brand-blue-accent, #2D6FC4)', textDecoration: 'none', backgroundColor: 'rgba(45, 111, 196, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                        Linked Deal
                      </Link>
                    )}
                    {task.relatedLeadId && !task.relatedDealId && (
                      <Link href={`/dashboard/leads/${task.relatedLeadId}`} style={{ color: 'var(--brand-blue-accent, #2D6FC4)', textDecoration: 'none', backgroundColor: 'rgba(45, 111, 196, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                        Linked Lead
                      </Link>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(task.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--status-error)',
                    cursor: 'pointer', opacity: 0.6, padding: 'var(--space-1)',
                    fontSize: 'var(--text-caption)', fontWeight: '500', flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </Card>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div
          onClick={() => { setSelectedTask(null); setIsEditing(false); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
            padding: 'var(--space-3)',
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '560px', maxHeight: '80vh',
              overflowY: 'auto', padding: 'var(--space-4)',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
              {isEditing ? (
                <input
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  style={{
                    flex: 1, fontSize: 'var(--text-h2, 20px)', fontWeight: '700',
                    color: 'var(--brand-navy)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', padding: '6px 10px', fontFamily: 'inherit',
                    marginRight: 'var(--space-2)',
                  }}
                />
              ) : (
                <h2 style={{
                  margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-h2, 20px)',
                  textDecoration: selectedTask.status === 'completed' ? 'line-through' : 'none',
                }}>
                  {selectedTask.title}
                </h2>
              )}
              <button
                onClick={() => { setSelectedTask(null); setIsEditing(false); }}
                style={{
                  background: 'none', border: 'none', fontSize: '20px',
                  cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px 8px',
                  lineHeight: 1, flexShrink: 0,
                }}
              >
                &times;
              </button>
            </div>

            {/* Meta badges / editable fields */}
            {isEditing ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={e => setEditForm({ ...editForm, priority: e.target.value })}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', fontFamily: 'inherit' }}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>Due Date</label>
                  <input
                    type="date"
                    value={editForm.dueAt}
                    onChange={e => setEditForm({ ...editForm, dueAt: e.target.value })}
                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: '600', color: getPriorityColor(selectedTask.priority),
                  backgroundColor: 'rgba(0,0,0,0.05)',
                }}>
                  {(selectedTask.priority || 'medium').toUpperCase()}
                </span>
                <span style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                  fontWeight: '600',
                  color: selectedTask.status === 'completed' ? 'var(--status-success)' : 'var(--brand-navy)',
                  backgroundColor: selectedTask.status === 'completed' ? 'rgba(47,168,79,0.1)' : 'rgba(15,42,82,0.06)',
                }}>
                  {selectedTask.status === 'completed' ? 'Completed' : 'Open'}
                </span>
                {selectedTask.dueAt && (
                  <span style={{
                    padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)',
                    fontWeight: '600',
                    color: isOverdue(selectedTask.dueAt) ? 'var(--status-error)' : isDueToday(selectedTask.dueAt) ? 'var(--status-warning)' : 'var(--text-secondary)',
                    backgroundColor: isOverdue(selectedTask.dueAt) ? 'rgba(211,63,63,0.1)' : 'rgba(0,0,0,0.05)',
                  }}>
                    {isOverdue(selectedTask.dueAt) ? 'Overdue — ' : isDueToday(selectedTask.dueAt) ? 'Due Today — ' : 'Due '}
                    {new Date(selectedTask.dueAt).toLocaleDateString('en-US')}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <p style={{
                margin: '0 0 6px 0', fontSize: 'var(--text-caption)',
                fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase',
              }}>
                Description
              </p>
              {isEditing ? (
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  rows={6}
                  style={{
                    width: '100%', fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)',
                    lineHeight: '1.6', border: '1px solid var(--border-color)', borderRadius: '8px',
                    padding: '10px', fontFamily: 'inherit', resize: 'vertical',
                    backgroundColor: 'var(--surface-card)',
                  }}
                />
              ) : (
                <div style={{
                  fontSize: 'var(--text-secondary)', color: 'var(--brand-navy)',
                  lineHeight: '1.6', whiteSpace: 'pre-wrap',
                }}>
                  {selectedTask.description || 'No description'}
                </div>
              )}
            </div>

            {/* Details grid (read-only info) */}
            {!isEditing && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)',
                marginBottom: 'var(--space-3)', fontSize: 'var(--text-caption)',
              }}>
                {selectedTask.ownerAgentName && (
                  <div>
                    <p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Assigned To</p>
                    <p style={{ margin: 0, color: 'var(--brand-navy)' }}>
                      {selectedTask.ownerAgentId === userProfile?.uid ? 'You' : selectedTask.ownerAgentName}
                    </p>
                  </div>
                )}
                {selectedTask.createdByAgentName && (
                  <div>
                    <p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Created By</p>
                    <p style={{ margin: 0, color: 'var(--brand-navy)' }}>{selectedTask.createdByAgentName}</p>
                  </div>
                )}
                {selectedTask.createdAt && (
                  <div>
                    <p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Created</p>
                    <p style={{ margin: 0, color: 'var(--brand-navy)' }}>{new Date(selectedTask.createdAt).toLocaleDateString('en-US')}</p>
                  </div>
                )}
                {selectedTask.completedAt && (
                  <div>
                    <p style={{ margin: '0 0 2px 0', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Completed</p>
                    <p style={{ margin: 0, color: 'var(--brand-navy)' }}>{new Date(selectedTask.completedAt).toLocaleDateString('en-US')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linked items */}
            {!isEditing && (selectedTask.relatedDealId || selectedTask.relatedLeadId) && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                {selectedTask.relatedDealId && (
                  <Link href={`/dashboard/deals/${selectedTask.relatedDealId}`} style={{
                    display: 'inline-block', padding: '6px 16px', borderRadius: '8px',
                    backgroundColor: 'rgba(45, 111, 196, 0.1)', color: 'var(--brand-blue-accent, #2D6FC4)',
                    textDecoration: 'none', fontWeight: '500', fontSize: 'var(--text-caption)', marginRight: 'var(--space-2)',
                  }}>
                    View Linked Deal
                  </Link>
                )}
                {selectedTask.relatedLeadId && !selectedTask.relatedDealId && (
                  <Link href={`/dashboard/leads/${selectedTask.relatedLeadId}`} style={{
                    display: 'inline-block', padding: '6px 16px', borderRadius: '8px',
                    backgroundColor: 'rgba(45, 111, 196, 0.1)', color: 'var(--brand-blue-accent, #2D6FC4)',
                    textDecoration: 'none', fontWeight: '500', fontSize: 'var(--text-caption)',
                  }}>
                    View Linked Lead
                  </Link>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
              {isEditing ? (
                <>
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  {(isAdmin || selectedTask.createdByAgentId === userProfile?.uid) && (
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => {
                    handleToggleStatus(selectedTask);
                    setSelectedTask({ ...selectedTask, status: selectedTask.status === 'open' ? 'completed' : 'open' });
                  }}>
                    {selectedTask.status === 'completed' ? 'Reopen' : 'Mark Complete'}
                  </Button>
                  <Button onClick={() => { setSelectedTask(null); setIsEditing(false); }}>Close</Button>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      <TaskQuickAddModal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); loadTasks(userProfile, viewType); }}
        userProfile={userProfile}
      />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel || 'Confirm'}
        onConfirm={() => { setConfirmState(s => ({ ...s, open: false })); confirmState.onConfirm?.(); }}
        onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
      />
    </div>
  );
}
