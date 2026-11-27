"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { importLeads } from '@/app/actions/leads';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function ImportLeadsPage() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [csvContent, setCsvContent] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  
  const [mapping, setMapping] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: ''
  });

  const [previewRows, setPreviewRows] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');

  // Load saved templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nxt_import_templates');
      if (stored) setSavedTemplates(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvContent(text);
      
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        const h = lines[0].split(',').map(s => s.trim().replace(/"/g, ''));
        setHeaders(h);
        
        const r = [];
        for(let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',').map(s => s.trim().replace(/"/g, ''));
          r.push(cells);
        }
        setRows(r);
        setStep(2); // Move to mapping
      }
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (field, csvHeaderIndex) => {
    setMapping({ ...mapping, [field]: csvHeaderIndex });
  };

  const generatePreview = () => {
    const mapped = rows.map((row, index) => {
      const getVal = (field) => mapping[field] !== '' ? row[mapping[field]] : '';
      
      const obj = {
        firstName: getVal('firstName'),
        lastName: getVal('lastName'),
        email: getVal('email'),
        phone: getVal('phone'),
        street: getVal('street'),
        city: getVal('city'),
        state: getVal('state'),
        zip: getVal('zip'),
        _originalIndex: index + 1
      };
      
      obj._hasErrors = !obj.firstName || !obj.lastName || (!obj.email && !obj.phone);
      return obj;
    });
    
    setPreviewRows(mapped);
    setStep(3);
  };

  const executeImport = async () => {
    setIsImporting(true);
    
    // Only send valid rows
    const validRows = previewRows.filter(r => !r._hasErrors);
    
    const res = await importLeads(validRows);
    
    if (res.success) {
      setImportResults({
        total: previewRows.length,
        imported: res.results.imported,
        skipped: res.results.skipped + previewRows.filter(r => r._hasErrors).length,
        flaggedAsDuplicate: res.results.flaggedAsDuplicate,
        errors: res.results.errors
      });
      setStep(4);
    } else {
      toast.error("Import failed: " + res.error);
    }
    
    setIsImporting(false);
  };

  if (!userProfile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <LoadingSpinner label="Loading..." />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Import Leads"
        subtitle={`Step ${step} of 4`}
        breadcrumbs={[{ label: '\u2190 Back to Leads', href: '/dashboard/leads' }]}
      />

      <Card>
        {step === 1 && (
          <div>
            <h3 style={{ margin: '0 0 16px 0' }}>1. Upload CSV</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Upload a CSV file containing your leads. You can map the columns in the next step.</p>
            <input type="file" accept=".csv" onChange={handleFileUpload} />
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ margin: '0 0 16px 0' }}>2. Map Columns</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Select which column from your CSV corresponds to each CRM field.</p>

            {/* Saved templates */}
            {savedTemplates.length > 0 && (
              <div style={{
                marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
                borderRadius: '10px', backgroundColor: 'rgba(227, 169, 74,0.06)',
                border: '1px solid rgba(227, 169, 74,0.12)',
              }}>
                <p style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', margin: '0 0 8px' }}>
                  Saved Templates
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {savedTemplates.map((tpl, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => {
                          setMapping({ ...mapping, ...tpl.mapping });
                          toast.success(`Applied template "${tpl.name}"`);
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
                          background: '#fff', fontSize: 'var(--text-caption)', fontWeight: 500,
                          cursor: 'pointer', color: 'var(--brand-navy)',
                        }}
                      >
                        {tpl.name}
                      </button>
                      <button
                        onClick={() => {
                          const updated = savedTemplates.filter((_, j) => j !== i);
                          setSavedTemplates(updated);
                          localStorage.setItem('nxt_import_templates', JSON.stringify(updated));
                          toast.info('Template removed');
                        }}
                        style={{
                          padding: '2px 6px', border: 'none', background: 'none',
                          color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '16px',
                        }}
                        aria-label={`Remove template ${tpl.name}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-2)', maxWidth: '600px' }}>
              {Object.keys(mapping).map(field => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center' }}>
                  <label style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                    {field.replace(/([A-Z])/g, ' $1').trim()} {['firstName', 'lastName'].includes(field) && '*'}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={e => handleMappingChange(field, e.target.value)}
                    style={{ padding: 'var(--space-1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  >
                    <option value="">-- Ignore --</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Save template */}
            <div style={{
              marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)',
              alignItems: 'center', paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--border-color)',
            }}>
              <input
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)',
                  fontSize: 'var(--text-caption)', width: '180px',
                }}
              />
              <button className="nxt-btn nxt-btn-sm"
                onClick={() => {
                  if (!templateName.trim()) { toast.error('Enter a template name'); return; }
                  const updated = [...savedTemplates, { name: templateName.trim(), mapping: { ...mapping } }];
                  setSavedTemplates(updated);
                  localStorage.setItem('nxt_import_templates', JSON.stringify(updated));
                  setTemplateName('');
                  toast.success('Template saved');
                }}
              >
                Save Mapping
              </button>
            </div>

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={generatePreview}>Preview Validation</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ margin: '0 0 16px 0' }}>3. Validation Preview</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Review the data before importing. Rows with missing required fields (First Name, Last Name, and at least one of Email/Phone) will be skipped.
            </p>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: 'var(--space-3)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-caption)' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface-page)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th scope="col" style={{ padding: 'var(--space-2)' }}>Status</th>
                    <th scope="col" style={{ padding: 'var(--space-2)' }}>Name</th>
                    <th scope="col" style={{ padding: 'var(--space-2)' }}>Contact</th>
                    <th scope="col" style={{ padding: 'var(--space-2)' }}>State</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: row._hasErrors ? '#fdf2f2' : 'transparent' }}>
                      <td style={{ padding: 'var(--space-2)', color: row._hasErrors ? 'var(--status-error, #D33F3F)' : 'var(--status-success, #2FA84F)', fontWeight: 'bold' }}>
                        {row._hasErrors ? 'Will Skip' : 'Valid'}
                      </td>
                      <td style={{ padding: 'var(--space-2)' }}>{row.firstName} {row.lastName}</td>
                      <td style={{ padding: 'var(--space-2)' }}>{row.email} {row.phone}</td>
                      <td style={{ padding: 'var(--space-2)' }}>{row.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={executeImport} isLoading={isImporting}>
                Confirm & Import {previewRows.filter(r => !r._hasErrors).length} Leads
              </Button>
            </div>
          </div>
        )}

        {step === 4 && importResults && (
          <div>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--status-success, #2FA84F)' }}>Import Complete!</h3>
            
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 'var(--text-body)', lineHeight: '2' }}>
              <li>Total Rows Parsed: <strong>{importResults.total}</strong></li>
              <li>Successfully Imported: <strong style={{ color: 'var(--status-success, #2FA84F)' }}>{importResults.imported}</strong></li>
              <li>Flagged as Duplicates (Merged): <strong style={{ color: 'var(--status-warning, #E08E2B)' }}>{importResults.flaggedAsDuplicate}</strong></li>
              <li>Skipped / Errors: <strong style={{ color: 'var(--status-error, #D33F3F)' }}>{importResults.skipped}</strong></li>
            </ul>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <Button onClick={() => router.push('/dashboard/leads')}>View Leads</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
