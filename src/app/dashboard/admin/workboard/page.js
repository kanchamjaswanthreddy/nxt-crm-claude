"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { storage } from '@/lib/firebase/clientApp';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  fetchWorkTasks,
  createWorkTask,
  updateWorkTask,
  addTaskComment,
  deleteWorkTask,
  fetchAdminUsers,
} from '@/app/actions/workboard';

import SegTabs from '@/components/ui/SegTabs';
const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: '#B42318', bg: 'rgba(211,63,63,0.08)' },
  { value: 'high', label: 'High', color: '#E08E2B', bg: 'rgba(224,142,43,0.08)' },
  { value: 'normal', label: 'Normal', color: '#1B2A4E', bg: 'rgba(227, 169, 74,0.08)' },
  { value: 'low', label: 'Low', color: '#5F5C56', bg: 'rgba(107,114,128,0.08)' },
];

const STATUSES = [
  { value: 'open', label: 'Open', color: '#1B2A4E', bg: 'rgba(227, 169, 74,0.08)' },
  { value: 'in_progress', label: 'In Progress', color: '#E08E2B', bg: 'rgba(224,142,43,0.08)' },
  { value: 'done', label: 'Done', color: 'var(--status-success)', bg: 'rgba(47,168,79,0.08)' },
];

const CATEGORIES = [
  { value: 'crm', label: 'CRM' },
  { value: 'website', label: 'Website' },
  { value: 'client_request', label: 'Client Request' },
  { value: 'general', label: 'General' },
];

const CATEGORY_COLORS = {
  crm: { color: '#0C1022', bg: 'rgba(12, 16, 34,0.08)' },
  website: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  client_request: { color: '#E08E2B', bg: 'rgba(224,142,43,0.08)' },
  general: { color: '#5F5C56', bg: 'rgba(107,114,128,0.08)' },
};

export default function WorkBoardPage() {
  const router = useRouter();
  const { userProfile } = useUser();

  const [tasks, setTasks] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('assigned_to_me');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPriority, setFormPriority] = useState('normal');
  const [formCategory, setFormCategory] = useState('general');
  const [formDueDate, setFormDueDate] = useState('');
  const [formFiles, setFormFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Detail panel
  const [selectedTask, setSelectedTask] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [detailFiles, setDetailFiles] = useState([]);
  const [detailUploading, setDetailUploading] = useState(false);
  const detailFileRef = useRef(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const loadData = useCallback(async () => {
    const [tasksRes, adminsRes] = await Promise.all([
      fetchWorkTasks(),
      fetchAdminUsers(),
    ]);
    if (tasksRes.success) {
      setTasks(tasksRes.tasks);
      setCurrentUserId(tasksRes.currentUserId);
    }
    if (adminsRes.success) {
      setAdmins(adminsRes.admins);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    if (!isAdmin) { router.push('/dashboard'); return; }
    loadData();
  }, [userProfile, isAdmin, router, loadData]);

  const handleFileUpload = async (files) => {
    if (!files?.length) return [];
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const path = `workboard/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      uploaded.push({ name: file.name, url, size: file.size, type: file.type });
    }
    setUploading(false);
    return uploaded;
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formAssignee) return;
    setCreating(true);

    let attachments = [];
    if (formFiles.length > 0) {
      attachments = await handleFileUpload(formFiles);
    }

    const res = await createWorkTask({
      title: formTitle,
      description: formDesc,
      assignedTo: formAssignee,
      priority: formPriority,
      category: formCategory,
      dueDate: formDueDate || null,
      attachments,
    });

    if (res.success) {
      setTasks(prev => [res.task, ...prev]);
      resetForm();
    }
    setCreating(false);
  };

  const resetForm = () => {
    setShowCreate(false);
    setFormTitle('');
    setFormDesc('');
    setFormAssignee('');
    setFormPriority('normal');
    setFormCategory('general');
    setFormDueDate('');
    setFormFiles([]);
  };

  const handleStatusChange = async (taskId, status) => {
    const res = await updateWorkTask(taskId, { status });
    if (res.success) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      if (selectedTask?.id === taskId) setSelectedTask(prev => ({ ...prev, status }));
    }
  };

  const handleDelete = async (taskId) => {
    const res = await deleteWorkTask(taskId);
    if (res.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTask) return;
    setSendingComment(true);
    const res = await addTaskComment(selectedTask.id, commentText);
    if (res.success) {
      const updated = {
        ...selectedTask,
        comments: [...(selectedTask.comments || []), res.comment],
      };
      setSelectedTask(updated);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
      setCommentText('');
    }
    setSendingComment(false);
  };

  const handleDetailFileUpload = async (files) => {
    if (!files?.length || !selectedTask) return;
    setDetailUploading(true);
    const uploaded = await handleFileUpload(files);
    const newAttachments = [...(selectedTask.attachments || []), ...uploaded];
    const res = await updateWorkTask(selectedTask.id, { attachments: newAttachments });
    if (res.success) {
      const updated = { ...selectedTask, attachments: newAttachments };
      setSelectedTask(updated);
      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
    }
    setDetailUploading(false);
    setDetailFiles([]);
  };

  // Filter tasks
  const filtered = tasks.filter(t => {
    if (tab === 'assigned_to_me' && t.assignedTo !== currentUserId) return false;
    if (tab === 'assigned_by_me' && t.assignedBy !== currentUserId) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  // Counts
  const myCount = tasks.filter(t => t.assignedTo === currentUserId && t.status !== 'done').length;
  const byMeCount = tasks.filter(t => t.assignedBy === currentUserId && t.status !== 'done').length;

  if (!userProfile || isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 var(--space-3)' }}>Work Board</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid var(--brand-blue-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <LoadingSpinner label="Loading" />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 4px' }}>Work Board</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '15px' }}>
            Assign and track work between admins.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ New Task</Button>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 'var(--space-3)' }}>
        <SegTabs label="Task lists" value={tab} onChange={setTab} tabs={[
          { key: 'assigned_to_me', label: 'Assigned to Me', count: myCount },
          { key: 'assigned_by_me', label: 'Assigned by Me', count: byMeCount },
          { key: 'all', label: 'All Tasks', count: tasks.filter(t => t.status !== 'done').length },
        ]} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={selectStyle}>
          <option value="all">All Priority</option>
          {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* Task list + detail split */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        {/* Task list */}
        <div style={{ flex: selectedTask ? '0 0 420px' : 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <Card style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '16px', textAlign: 'center' }}>No tasks found</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(task => {
                const pri = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[2];
                const stat = STATUSES.find(s => s.value === task.status) || STATUSES[0];
                const cat = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.general;
                const catLabel = CATEGORIES.find(c => c.value === task.category)?.label || 'General';
                const isSelected = selectedTask?.id === task.id;
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      padding: '16px 18px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--brand-navy)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(10,37,64,0.02)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Top row: priority + category + status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', backgroundColor: pri.bg, color: pri.color }}>
                        {pri.label}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, backgroundColor: cat.bg, color: cat.color }}>
                        {catLabel}
                      </span>
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', backgroundColor: stat.bg, color: stat.color }}>
                        {stat.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--brand-navy)', lineHeight: 1.3 }}>
                      {task.title}
                    </h3>

                    {/* Description preview */}
                    {task.description && (
                      <p style={{
                        margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {task.description}
                      </p>
                    )}

                    {/* Bottom row: assignee, due date, comments, attachments */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 500 }}>
                        {tab === 'assigned_to_me' ? `From: ${task.assignedByName?.split(' ')[0]}` : `To: ${task.assignedToName?.split(' ')[0]}`}
                      </span>
                      {task.dueDate && (
                        <span style={{ fontWeight: 500, color: isOverdue ? '#B42318' : 'var(--text-secondary)' }}>
                          Due: {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {(task.comments?.length > 0) && (
                        <span>{task.comments.length} comment{task.comments.length !== 1 ? 's' : ''}</span>
                      )}
                      {(task.attachments?.length > 0) && (
                        <span>{task.attachments.length} file{task.attachments.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedTask && (
          <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: '80px' }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {/* Detail header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--brand-navy)', lineHeight: 1.3, flex: 1, paddingRight: '12px' }}>
                    {selectedTask.title}
                  </h2>
                  <button onClick={() => setSelectedTask(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '20px', padding: '0 4px', lineHeight: 1 }}>
                    x
                  </button>
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {(() => { const p = PRIORITIES.find(x => x.value === selectedTask.priority); return p ? <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, backgroundColor: p.bg, color: p.color }}>{p.label}</span> : null; })()}
                  {(() => { const c = CATEGORY_COLORS[selectedTask.category]; const cl = CATEGORIES.find(x => x.value === selectedTask.category); return <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, backgroundColor: c?.bg, color: c?.color }}>{cl?.label}</span>; })()}
                </div>

                {/* Status change */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {STATUSES.map(s => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(selectedTask.id, s.value)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        border: selectedTask.status === s.value ? `2px solid ${s.color}` : '1px solid var(--border-color)',
                        backgroundColor: selectedTask.status === s.value ? s.bg : '#fff',
                        color: selectedTask.status === s.value ? s.color : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail body */}
              <div style={{ padding: '20px 24px' }}>
                {/* Meta info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px', fontSize: '15px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Assigned by</span>
                    <div style={{ fontWeight: 600, color: 'var(--brand-navy)', marginTop: '2px' }}>{selectedTask.assignedByName}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Assigned to</span>
                    <div style={{ fontWeight: 600, color: 'var(--brand-navy)', marginTop: '2px' }}>{selectedTask.assignedToName}</div>
                  </div>
                  {selectedTask.dueDate && (
                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Due date</span>
                      <div style={{ fontWeight: 600, color: new Date(selectedTask.dueDate) < new Date() && selectedTask.status !== 'done' ? '#B42318' : 'var(--brand-navy)', marginTop: '2px' }}>
                        {new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Created</span>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {new Date(selectedTask.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedTask.description && (
                  <div style={{ marginBottom: '18px' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Description</h4>
                    <p style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selectedTask.description}
                    </p>
                  </div>
                )}

                {/* Attachments */}
                <div style={{ marginBottom: '18px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Attachments ({selectedTask.attachments?.length || 0})
                  </h4>
                  {selectedTask.attachments?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {selectedTask.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', borderRadius: '8px',
                            backgroundColor: 'rgba(10,37,64,0.03)', border: '1px solid var(--border-color)',
                            textDecoration: 'none', color: 'var(--brand-navy)', fontSize: '15px',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                          {att.size > 0 && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{(att.size / 1024).toFixed(0)} KB</span>}
                        </a>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="file"
                      multiple
                      ref={detailFileRef}
                      style={{ display: 'none' }}
                      onChange={e => handleDetailFileUpload(Array.from(e.target.files))}
                    />
                    <button className="nxt-btn nxt-btn-sm"
                      onClick={() => detailFileRef.current?.click()}
                      disabled={detailUploading}
                    >
                      {detailUploading ? 'Uploading...' : '+ Add File'}
                    </button>
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Comments ({selectedTask.comments?.length || 0})
                  </h4>

                  {selectedTask.comments?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                      {selectedTask.comments.map(c => (
                        <div key={c.id} style={{
                          padding: '10px 14px', borderRadius: '10px',
                          backgroundColor: c.authorId === currentUserId ? 'rgba(10,37,64,0.04)' : 'rgba(0,0,0,0.02)',
                          borderLeft: c.authorId === currentUserId ? '3px solid var(--brand-navy)' : '3px solid var(--border-color)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand-navy)' }}>{c.authorName}</span>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px',
                        border: '1px solid var(--border-color)', fontSize: '15px',
                        resize: 'none', minHeight: '40px', maxHeight: '100px',
                        fontFamily: 'inherit',
                      }}
                    />
                    <Button size="small"
                     
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || sendingComment}
                      isLoading={sendingComment}
                    >
                      Send
                    </Button>
                  </div>
                </div>

                {/* Delete */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="nxt-btn nxt-btn-danger"
                    onClick={() => { setConfirmState({ open: true, title: 'Delete Task', message: 'Delete this task?', variant: 'danger', onConfirm: () => handleDelete(selectedTask.id) }); }}
                  >
                    Delete Task
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) resetForm(); }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h2 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: '18px', fontWeight: 700 }}>New Task</h2>
              <button onClick={resetForm} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '20px' }}>x</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={labelStyle}>
                Title *
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  style={inputStyle}
                  autoFocus
                />
              </label>

              <label style={labelStyle}>
                Description
                <textarea
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Add details, instructions, notes..."
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>

              <label style={labelStyle}>
                Assign to *
                <select value={formAssignee} onChange={e => setFormAssignee(e.target.value)} style={inputStyle}>
                  <option value="">Select admin</option>
                  {admins.map(a => (
                    <option key={a.id} value={a.id}>{a.name}{a.id === currentUserId ? ' (You)' : ''}</option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={labelStyle}>
                  Priority
                  <select value={formPriority} onChange={e => setFormPriority(e.target.value)} style={inputStyle}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label style={labelStyle}>
                  Category
                  <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
              </div>

              <label style={labelStyle}>
                Due Date
                <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} style={inputStyle} />
              </label>

              <div>
                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Attachments</span>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={e => setFormFiles(prev => [...prev, ...Array.from(e.target.files)])}
                />
                {formFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {formFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.03)', fontSize: '14px' }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{(f.size / 1024).toFixed(0)} KB</span>
                        <button onClick={() => setFormFiles(prev => prev.filter((_, j) => j !== i))} aria-label="Remove file" style={{ background: 'none', border: 'none', color: '#B42318', cursor: 'pointer', fontSize: '16px' }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="nxt-btn nxt-btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Choose Files
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
              <Button variant="secondary" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleCreate} isLoading={creating || uploading} disabled={!formTitle.trim() || !formAssignee}>
                Create Task
              </Button>
            </div>
          </div>
        </div>
      )}

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

const selectStyle = { padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '15px', backgroundColor: '#fff', color: 'var(--text-primary)' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)' };
const inputStyle = { padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '16px', color: 'var(--text-primary)' };
