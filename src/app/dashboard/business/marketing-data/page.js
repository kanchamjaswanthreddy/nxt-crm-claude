"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { listDriveFolder } from '@/app/actions/drive';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

/* ── Icon helpers ── */

function FolderIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function FileIcon({ mimeType, size = 20 }) {
  if (mimeType?.includes('pdf')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  }
  if (mimeType?.includes('image')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
  }
  if (mimeType?.includes('video')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
  }
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || mimeType?.includes('csv')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="12" y1="9" x2="12" y2="21"/></svg>;
  }
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="8" y="12" width="8" height="6" rx="1"/></svg>;
  }
  if (mimeType?.includes('document') || mimeType?.includes('word') || mimeType?.includes('text')) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  }
  // Default file
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#5F5C56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}

function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}

function ExternalLinkIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
}

function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}

function RefreshIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}

function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}

function ListIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}

/* ── Helpers ── */

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US');
}

function getFileTypeLabel(mimeType) {
  if (!mimeType) return 'File';
  if (mimeType.includes('folder')) return 'Folder';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return 'Image';
  if (mimeType.includes('video')) return 'Video';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'Document';
  if (mimeType.includes('text')) return 'Text';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive';
  return 'File';
}

/* ── Allowed root-level folder names ── */
const ALLOWED_ROOT_FOLDERS = [
  'Annuities',
  'Long-Term Care',
  'Life Insurance',
  'Final Expense',
  'Indexed Universal Life',
];

/* ── Main Page ── */

export default function MarketingDataPage() {
  const { userProfile } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [isRootLevel, setIsRootLevel] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [previewFile, setPreviewFile] = useState(null);

  const loadFolder = useCallback(async (folderId) => {
    setIsLoading(true);
    setError('');
    setSearchQuery('');
    const isRoot = !folderId;
    setIsRootLevel(isRoot);
    const res = await listDriveFolder(folderId || null);
    if (res.success) {
      const loadedFolders = isRoot
        ? res.folders.filter(f => ALLOWED_ROOT_FOLDERS.some(name => f.name.toLowerCase().startsWith(name.toLowerCase())))
        : res.folders;
      setFolders(loadedFolders);
      setFiles(res.files);
      setBreadcrumbs(res.breadcrumbs);
      setCurrentFolderId(res.currentFolderId);
    } else {
      setError(res.error || 'Failed to load files');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    (async () => { await loadFolder(null); })();
  }, [userProfile, loadFolder]);

  const navigateToFolder = (folderId) => {
    loadFolder(folderId);
  };

  const filteredFolders = searchQuery
    ? folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;

  const filteredFiles = searchQuery
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  if (!userProfile) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <PageHeader
        title="Marketing Data"
        subtitle="Access flyers, presentations, and marketing materials. Synced live from Google Drive."
      />

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '420px' }}>
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-secondary)', opacity: 0.5, display: 'flex',
          }}><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)',
              fontSize: '0.875rem', outline: 'none', background: '#fff',
            }}
          />
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => setViewMode('grid')}
            style={{
              padding: '8px 12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              background: viewMode === 'grid' ? 'var(--brand-navy, #0C1022)' : '#fff',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
            }}
          ><GridIcon /></button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 12px', border: 'none', borderLeft: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              background: viewMode === 'list' ? 'var(--brand-navy, #0C1022)' : '#fff',
              color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
            }}
          ><ListIcon /></button>
        </div>

        {/* Refresh */}
        <button
          onClick={() => loadFolder(currentFolderId)}
          disabled={isLoading}
          style={{
            padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <RefreshIcon /> Refresh
        </button>

        {/* Open in Drive */}
        <a
          href={`https://drive.google.com/drive/folders/${currentFolderId || '18j7lnOyihC4CwIvmIq6JhwsbFpMnSl-J'}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none',
          }}
        >
          <ExternalLinkIcon /> Open in Drive
        </a>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px',
          fontSize: '0.85rem', flexWrap: 'wrap',
        }}>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i > 0 && <span style={{ color: 'var(--text-secondary)', opacity: 0.4, display: 'flex' }}><ChevronRight /></span>}
              <button
                onClick={() => navigateToFolder(crumb.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: '6px', fontSize: '0.85rem', fontWeight: i === breadcrumbs.length - 1 ? 700 : 500,
                  color: i === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => { if (i < breadcrumbs.length - 1) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '16px 20px', borderRadius: '12px', marginBottom: '20px',
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)',
          color: '#DC2626', fontSize: '0.875rem',
        }}>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#8A857B' }}>
            Make sure the Google Drive folder is shared with the Firebase service account email.
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading files..." />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredFolders.length === 0 && filteredFiles.length === 0 && (
        <EmptyState
          variant="minimal"
          title={searchQuery ? 'No results found' : 'This folder is empty'}
        />
      )}

      {/* Content */}
      {!isLoading && !error && (filteredFolders.length > 0 || filteredFiles.length > 0) && (
        <>
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', paddingLeft: '4px' }}>
                Folders ({filteredFolders.length})
              </h3>
              {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {filteredFolders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                        background: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <FolderIcon size={24} />
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{folder.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredFolders.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => navigateToFolder(folder.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 16px', borderRadius: '8px', border: 'none',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <FolderIcon size={20} />
                      <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{folder.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{timeAgo(folder.modifiedTime)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Files */}
          {filteredFiles.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', paddingLeft: '4px' }}>
                Files ({filteredFiles.length})
              </h3>
              {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {filteredFiles.map(file => (
                    <div
                      key={file.id}
                      style={{
                        padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                        background: '#fff', cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                      onClick={() => setPreviewFile(file)}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.15)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Thumbnail or icon */}
                      <div style={{
                        height: '100px', borderRadius: '8px', marginBottom: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: '#F7F5F0', overflow: 'hidden',
                      }}>
                        {file.thumbnailLink ? (
                          <img
                            src={file.thumbnailLink}
                            alt=""
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div style={{ display: file.thumbnailLink ? 'none' : 'flex' }}>
                          <FileIcon mimeType={file.mimeType} size={32} />
                        </div>
                      </div>
                      <div style={{
                        fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: '4px',
                      }}>{file.name}</div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>{getFileTypeLabel(file.mimeType)}</span>
                        {file.size && <span>{formatFileSize(file.size)}</span>}
                        <span>{timeAgo(file.modifiedTime)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List view */
                <div style={{
                  background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)',
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px',
                    padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)',
                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.3px',
                  }}>
                    <span>Name</span>
                    <span>Type</span>
                    <span>Size</span>
                    <span>Modified</span>
                  </div>
                  {filteredFiles.map(file => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewFile(file)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px',
                        padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.03)',
                        cursor: 'pointer', alignItems: 'center', transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <FileIcon mimeType={file.mimeType} size={18} />
                        <span style={{
                          fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{file.name}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{getFileTypeLabel(file.mimeType)}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatFileSize(file.size)}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{timeAgo(file.modifiedTime)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* File Preview / Action Panel */}
      {previewFile && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <div onClick={() => setPreviewFile(null)} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'relative', background: '#fff', borderRadius: '16px', width: '90vw',
            maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.2)', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <FileIcon mimeType={previewFile.mimeType} size={22} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {previewFile.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                    <span>{getFileTypeLabel(previewFile.mimeType)}</span>
                    {previewFile.size && <span>{formatFileSize(previewFile.size)}</span>}
                    <span>{timeAgo(previewFile.modifiedTime)}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setPreviewFile(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', padding: '4px',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Preview area */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {previewFile.mimeType?.includes('image') && previewFile.thumbnailLink ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', height: '400px', background: '#F7F5F0' }}>
                  <img
                    src={previewFile.thumbnailLink.replace('=s220', '=s800')}
                    alt={previewFile.name}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#F7F5F0' }}>
                  <FileIcon mimeType={previewFile.mimeType} size={64} />
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '16px', textAlign: 'center' }}>
                    Open this file in Google Drive to view its full contents.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', gap: '10px', padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.06)',
              justifyContent: 'flex-end', flexShrink: 0,
            }}>
              {previewFile.webContentLink && (
                <a
                  href={previewFile.webContentLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
                    background: '#fff', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <DownloadIcon /> Download
                </a>
              )}
              {previewFile.webViewLink && (
                <a
                  href={previewFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: 'var(--brand-gold, #E3A94A)', fontSize: '0.85rem', fontWeight: 600,
                    color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <ExternalLinkIcon /> Open in Drive
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
