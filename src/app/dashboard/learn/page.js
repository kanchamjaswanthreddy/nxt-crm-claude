"use client";

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchLearningResources, createLearningResource, deleteLearningResource, updateLearningResource } from '@/app/actions/learn';
import { storage } from '@/lib/firebase/clientApp';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

import SegTabs from '@/components/ui/SegTabs';
const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'training', label: 'Training' },
  { value: 'product', label: 'Product Knowledge' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'sales', label: 'Sales' },
  { value: 'licensing', label: 'Licensing Materials' },
];

const CONTENT_TYPE_ICONS = {
  video: 'Video',
  pdf: 'PDF',
  link: 'Link',
  article: 'Article',
};

const CATEGORY_ACCENT_COLORS = {
  onboarding: '#2FA84F',
  training: '#1B2A4E',
  product: '#E3A94A',
  compliance: '#D33F3F',
  sales: '#E08E2B',
  licensing: '#7C3AED',
};

const LICENSING_MATERIALS = [
  { id: 'lic-1', title: 'ExamFX Claire AI — One-Sheet Overview', description: 'Overview of ExamFX Claire AI study assistant for insurance licensing exam preparation.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/ExamFX Claire AI One-Sheet.pdf', requiredForOnboarding: false },
  { id: 'lic-2', title: 'ExamFX Live Online Training Guide', description: 'Guide for live online training sessions through ExamFX for insurance licensing.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/ExamFX_Live Online Training.pdf', requiredForOnboarding: false },
  { id: 'lic-3', title: 'ExamFX Manager Tracking (CW)', description: 'Manager tracking tools and reports for monitoring agent licensing progress.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/ExamFX_Manager Tracking_CW.pdf', requiredForOnboarding: false },
  { id: 'lic-4', title: 'ExamFX Readiness Exam (CW)', description: 'Practice readiness exam to assess preparation level before the licensing exam.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/ExamFX_Readiness Exam_CW.pdf', requiredForOnboarding: false },
  { id: 'lic-5', title: 'Life & Health 10-Day Pro-PSI (2-Course States)', description: 'Life & Health insurance 10-day study plan for Pro-PSI in 2-course states.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/L&H_10-Day_Pro-PSI_NonReq - 2-course states.pdf', requiredForOnboarding: false },
  { id: 'lic-6', title: 'Life Insurance 5-Day Pro-PSI (Non-Required)', description: 'Accelerated 5-day Life insurance study plan for Pro-PSI non-required states.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/Life_5-Day_Pro-PSI_NonReq.pdf', requiredForOnboarding: false },
  { id: 'lic-7', title: 'Recommended Study Steps for Insurance Licensing', description: 'Step-by-step recommended study guide for passing insurance licensing exams.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/Recommended Study Steps_Insurance.pdf', requiredForOnboarding: false },
  { id: 'lic-8', title: 'Life & Annuities Agent Licensing Program', description: 'Comprehensive overview of the Life & Annuities agent licensing program requirements and process.', category: 'licensing', contentType: 'pdf', url: '/licensing-materials/Life & Annuities Agent Licensing Program.pptx.pdf', requiredForOnboarding: false },
];


export default function LearnPage() {
  const { userProfile } = useUser();
  const toast = useToast();
  const [resources, setResources] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('training');
  const [formContentType, setFormContentType] = useState('link');
  const [formUrl, setFormUrl] = useState('');
  const [formRequired, setFormRequired] = useState(false);

  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const [uploadingId, setUploadingId] = useState(null);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';

  const agencyId = userProfile?.agency_id;
  const loadData = useCallback(async () => {
    try {
      const res = await fetchLearningResources(agencyId);
      if (res.success) setResources(res.resources);
    } catch (e) {
      // silenced
    }
    setDataLoaded(true);
  }, [agencyId]);

  useEffect(() => {
    if (!userProfile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [userProfile, loadData]);

  const handleCreate = async () => {
    if (!formTitle || !formUrl) return;
    setIsSaving(true);
    const res = await createLearningResource({
      agencyId: userProfile.agency_id,
      title: formTitle,
      description: formDescription,
      category: formCategory,
      contentType: formContentType,
      url: formUrl,
      requiredForOnboarding: formRequired,
      createdBy: userProfile.uid,
    });
    if (res.success) {
      setShowModal(false);
      setFormTitle('');
      setFormDescription('');
      setFormCategory('training');
      setFormContentType('link');
      setFormUrl('');
      setFormRequired(false);
      await loadData();
    }
    setIsSaving(false);
  };

  const handleDelete = (id) => {
    setConfirmState({
      open: true,
      title: 'Delete Resource',
      message: 'Delete this resource?',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await deleteLearningResource(id);
          if (!res.success) {
            toast.error('Failed to delete resource: ' + (res.error || 'Unknown error'));
            return;
          }
          await loadData();
        } catch (err) {
          toast.error('Failed to delete resource. Please try again.');
        }
      },
    });
  };

  const handleUploadClick = (resourceId) => {
    uploadTargetRef.current = resourceId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const resourceId = uploadTargetRef.current;
    if (!file || !resourceId) return;

    setUploadingId(resourceId);
    try {
      const storagePath = `licensing-materials/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateLearningResource(resourceId, { url: downloadURL });
      await loadData();
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    }
    setUploadingId(null);
    uploadTargetRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Combine Firestore resources with static licensing materials
  const displayResources = [...resources.filter(r => r.category !== 'licensing'), ...LICENSING_MATERIALS];
  const filtered = activeCategory === 'all' ? displayResources : displayResources.filter(r => r.category === activeCategory);

  if (!userProfile) {
    return (
      <div style={{ padding: '24px' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 var(--space-3)' }}>NXT University</h1>
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
      <input type="file" ref={fileInputRef} accept=".pdf" style={{ display: 'none' }} onChange={handleFileChange} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: 0 }}>NXT University</h1>
        {isAdmin && <Button onClick={() => setShowModal(true)}>+ Add Resource</Button>}
      </div>

      {/* Category tabs */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <SegTabs label="Categories" value={activeCategory} onChange={setActiveCategory} tabs={CATEGORIES.map(c => ({ key: c.value, label: c.label }))} />
      </div>


      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 'var(--space-5)', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '16px', fontWeight: '500' }}>No resources found</div>
            <div style={{ fontSize: '16px', marginTop: '4px' }}>{isAdmin ? 'Add training materials for your team.' : 'Check back later for new resources.'}</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {filtered.map(r => {
            const accentColor = CATEGORY_ACCENT_COLORS[r.category] || '#1B2A4E';
            return (
              <Card key={r.id}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `3px solid ${accentColor}`, marginLeft: '-16px', paddingLeft: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>{CONTENT_TYPE_ICONS[r.contentType] || 'Link'}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', backgroundColor: `${accentColor}14`, color: accentColor, textTransform: 'capitalize' }}>{r.category}</span>
                    {r.requiredForOnboarding && (
                      <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '13px', fontWeight: '600', backgroundColor: 'rgba(211,63,63,0.1)', color: '#B42318' }}>Required</span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 6px', color: 'var(--brand-navy)', fontSize: '17px', fontWeight: '600' }}>{r.title}</h3>
                  {r.description && <p style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.4', flex: 1 }}>{r.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    {r.url === '#pending-upload' && isAdmin ? (
                      <button className="nxt-btn nxt-btn-sm" onClick={() => handleUploadClick(r.id)} disabled={uploadingId === r.id}>
                        {uploadingId === r.id ? 'Uploading...' : 'Upload PDF'}
                      </button>
                    ) : r.url === '#pending-upload' ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '15px', fontStyle: 'italic' }}>Pending upload</span>
                    ) : (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-blue-accent)', fontSize: '15px', fontWeight: '500', textDecoration: 'none' }}>
                        Open {r.contentType === 'video' ? 'Video' : r.contentType === 'pdf' ? 'PDF' : 'Link'} →
                      </a>
                    )}
                    {isAdmin && !r.id.startsWith('lic-') && (
                      <button className="nxt-btn nxt-btn-sm nxt-btn-danger" onClick={() => handleDelete(r.id)}>Remove</button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
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

      {/* Add Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <Card>
            <div style={{ width: '420px' }}>
              <h2 style={{ color: 'var(--brand-navy)', marginTop: 0, marginBottom: 'var(--space-3)' }}>Add Learning Resource</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={labelStyle}>
                  Title
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} style={inputStyle} placeholder="Resource title" />
                </label>
                <label style={labelStyle}>
                  Description
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} placeholder="Brief description" />
                </label>
                <label style={labelStyle}>
                  URL
                  <input value={formUrl} onChange={e => setFormUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Category
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={inputStyle}>
                      <option value="onboarding">Onboarding</option>
                      <option value="training">Training</option>
                      <option value="product">Product Knowledge</option>
                      <option value="compliance">Compliance</option>
                      <option value="sales">Sales</option>
                      <option value="licensing">Licensing Materials</option>
                    </select>
                  </label>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Type
                    <select value={formContentType} onChange={e => setFormContentType(e.target.value)} style={inputStyle}>
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                      <option value="link">Link</option>
                      <option value="article">Article</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={formRequired} onChange={e => setFormRequired(e.target.checked)} />
                  Required for onboarding
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleCreate} isLoading={isSaving} disabled={!formTitle || !formUrl}>Add</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '15px', fontWeight: '500', color: 'var(--text-secondary)' };
const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', color: 'var(--text-primary)' };
