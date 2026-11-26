"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { fetchCarrierUpdates, createCarrierUpdate, deleteCarrierUpdate } from '@/app/actions/carrierUpdates';
import { fetchCarriers } from '@/app/actions/commissions';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const CATEGORY_STYLES = {
  product_update: { bg: 'rgba(227, 169, 74,0.1)', text: '#1B2A4E', label: 'Product Update' },
  rate_change: { bg: 'rgba(224,142,43,0.1)', text: '#E08E2B', label: 'Rate Change' },
  compliance: { bg: 'rgba(211,63,63,0.1)', text: '#D33F3F', label: 'Compliance' },
  announcement: { bg: 'rgba(107,114,128,0.1)', text: '#5F5C56', label: 'Announcement' },
};

const PRIORITY_STYLES = {
  urgent: { color: '#D33F3F', icon: '' },
  important: { color: '#E08E2B', icon: '' },
  normal: { color: 'var(--text-secondary)', icon: '' },
};

export default function CarrierUpdatesPage() {
  const { userProfile } = useUser();
  const [updates, setUpdates] = useState([]);
  const [carriers, setCarriers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCarrierId, setFormCarrierId] = useState('');
  const [formCategory, setFormCategory] = useState('announcement');
  const [formPriority, setFormPriority] = useState('normal');

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const loadData = useCallback(async () => {
    if (!userProfile?.agency_id) return;
    setIsLoading(true);
    const [updatesRes, carriersRes] = await Promise.all([
      fetchCarrierUpdates(userProfile.agency_id),
      fetchCarriers(),
    ]);
    if (updatesRes.success) setUpdates(updatesRes.updates);
    if (carriersRes.success) {
      const map = {};
      carriersRes.carriers.forEach(c => { map[c.id] = c.name; });
      setCarriers(map);
    }
    setIsLoading(false);
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    (async () => { await loadData(); })();
  }, [userProfile, loadData]);

  const handleCreate = async () => {
    if (!formTitle) return;
    setIsSaving(true);
    const res = await createCarrierUpdate({
      agencyId: userProfile.agency_id,
      carrierId: formCarrierId || null,
      title: formTitle,
      body: formBody,
      category: formCategory,
      priority: formPriority,
      createdBy: userProfile.uid,
    });
    if (res.success) {
      setShowModal(false);
      setFormTitle('');
      setFormBody('');
      setFormCarrierId('');
      setFormCategory('announcement');
      setFormPriority('normal');
      await loadData();
    }
    setIsSaving(false);
  };

  const handleDelete = (id) => {
    setConfirmState({
      open: true,
      title: 'Delete Update',
      message: 'Delete this update?',
      variant: 'danger',
      onConfirm: async () => {
        await deleteCarrierUpdate(id);
        await loadData();
      },
    });
  };

  if (isLoading) return <div style={{ padding: '24px' }}>Loading Carrier Updates...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>Carrier Updates</h1>
        {isAdmin && <Button onClick={() => setShowModal(true)}>+ Post Update</Button>}
      </div>

      {updates.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '16px', marginBottom: 'var(--space-2)', fontWeight: '600', color: 'var(--brand-navy)' }}>No Updates</div>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>No carrier updates yet</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{isAdmin ? 'Post your first carrier update above.' : 'Check back later for carrier announcements.'}</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {updates.map(u => {
            const cat = CATEGORY_STYLES[u.category] || CATEGORY_STYLES.announcement;
            const pri = PRIORITY_STYLES[u.priority] || PRIORITY_STYLES.normal;
            return (
              <Card key={u.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {pri.icon && <span>{pri.icon}</span>}
                      <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', backgroundColor: cat.bg, color: cat.text }}>{cat.label}</span>
                      {u.carrierId && carriers[u.carrierId] && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{carriers[u.carrierId]}</span>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                        {u.publishedAt ? new Date(u.publishedAt).toLocaleDateString('en-US') : ''}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 8px', color: 'var(--brand-navy)', fontSize: '16px' }}>{u.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{u.body}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: '#D33F3F', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>Delete</button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Post Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <Card>
            <div style={{ width: '480px' }}>
              <h2 style={{ color: 'var(--brand-navy)', marginTop: 0, marginBottom: 'var(--space-3)' }}>Post Carrier Update</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={labelStyle}>
                  Title
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} placeholder="Update title" />
                </label>
                <label style={labelStyle}>
                  Body
                  <textarea value={formBody} onChange={e => setFormBody(e.target.value)} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} placeholder="Details..." />
                </label>
                <label style={labelStyle}>
                  Carrier (optional)
                  <select value={formCarrierId} onChange={e => setFormCarrierId(e.target.value)} style={inputStyle}>
                    <option value="">Agency-wide</option>
                    {Object.entries(carriers).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Category
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                      <option value="announcement">Announcement</option>
                      <option value="product_update">Product Update</option>
                      <option value="rate_change">Rate Change</option>
                      <option value="compliance">Compliance</option>
                    </select>
                  </label>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Priority
                    <select value={formPriority} onChange={e => setFormPriority(e.target.value)} style={inputStyle}>
                      <option value="normal">Normal</option>
                      <option value="important">Important</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleCreate} isLoading={isSaving} disabled={!formTitle}>Post</Button>
              </div>
            </div>
          </Card>
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

const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)' };
