"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { db } from '@/lib/firebase/clientApp';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { fetchCarriers, processStatement, undoLastImport } from '@/app/actions/commissions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Papa from 'papaparse';

export default function CommissionImport() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [carriers, setCarriers] = useState([]);
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Parsing & Matching State
  const [parsedData, setParsedData] = useState([]);
  const [matchedLines, setMatchedLines] = useState([]);
  const [unmatchedLines, setUnmatchedLines] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Review, 3: Success
  const [importBatchId, setImportBatchId] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const undoTimerRef = useRef(null);

  const loadCarriers = useCallback(async () => {
    const res = await fetchCarriers();
    if (res.success) {
      setCarriers(res.carriers);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
        router.push('/dashboard');
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCarriers();
    }
  }, [userProfile, router, loadCarriers]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleFileParse = () => {
    if (!file || !selectedCarrier) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data;
        setParsedData(data);
        await performMatching(data, selectedCarrier);
      },
      error: (error) => {
        toast.error("Error parsing CSV: " + error.message);
      }
    });
  };

  const performMatching = async (csvData, carrierId) => {
    setIsProcessing(true);
    
    // Fetch all pending commissions for this carrier
    const q = query(
      collection(db, 'commissions'),
      where('agencyId', '==', userProfile.agency_id),
      where('carrierId', '==', carrierId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    
    // Create a map by dealId so we can fetch policy numbers from deals easily
    let comms = [];
    snap.forEach(d => comms.push({ id: d.id, ...d.data() }));

    // Fetch associated deals in parallel to get Policy Numbers
    const commsWithDeals = comms.filter(c => c.dealId);
    const dealSnaps = await Promise.all(
      commsWithDeals.map(c => getDoc(doc(db, 'deals', c.dealId)))
    );

    let policyToCommIdMap = {};
    dealSnaps.forEach((dealSnap, i) => {
      if (dealSnap.exists()) {
        const pn = dealSnap.data().policyNumber;
        if (pn) {
          policyToCommIdMap[pn.toString().toLowerCase().trim()] = commsWithDeals[i].id;
        }
      }
    });

    let matched = [];
    let unmatched = [];

    // The CSV is expected to have columns like: "PolicyNumber" and "CommissionAmount"
    csvData.forEach((row, index) => {
      // Very basic normalization for column names
      const pn = (row.PolicyNumber || row.policyNumber || row.policy_number || row.Policy || '')?.toString().toLowerCase().trim();
      const amt = parseFloat((row.CommissionAmount || row.commissionAmount || row.commission_amount || row.Amount || row.Commission || '0').replace(/[^0-9.-]+/g,""));
      
      const cleanRow = { PolicyNumber: pn, CommissionAmount: amt, originalIndex: index, ...row };

      if (pn && policyToCommIdMap[pn]) {
        matched.push({
          csvData: cleanRow,
          matchedCommId: policyToCommIdMap[pn]
        });
      } else {
        unmatched.push({
          csvData: cleanRow,
          matchedCommId: null
        });
      }
    });

    setMatchedLines(matched);
    setUnmatchedLines(unmatched);
    setStep(2);
    setIsProcessing(false);
  };

  const confirmImport = async () => {
    setIsProcessing(true);
    // Combine matched and unmatched so we log all statement lines, even those without a commission
    const allLinesToProcess = [...matchedLines, ...unmatchedLines];
    
    const res = await processStatement(userProfile.agency_id, selectedCarrier, parsedData, allLinesToProcess);
    
    setIsProcessing(false);
    
    if (res.success) {
      setImportBatchId(res.importBatchId);
      setShowUndo(true);
      setStep(3);

      // Hide undo button after 5 minutes
      undoTimerRef.current = setTimeout(() => {
        setShowUndo(false);
      }, 5 * 60 * 1000);
    } else {
      toast.error("Failed to process statement: " + res.error);
    }
  };

  const handleUndo = async () => {
    if (!importBatchId) return;
    setIsUndoing(true);
    const res = await undoLastImport(importBatchId);
    setIsUndoing(false);

    if (res.success) {
      setShowUndo(false);
      setImportBatchId(null);
      setStep(1);
      setParsedData([]);
      setMatchedLines([]);
      setUnmatchedLines([]);
      setFile(null);
      setSelectedCarrier('');
      toast.success(`Import undone. ${res.totalDeleted} documents reverted.`);
    } else {
      toast.error("Failed to undo import: " + res.error);
    }
  };

  if (isLoading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;

  return (
    <div>
      <PageHeader title="Import Carrier Statement" subtitle="Upload CSV to automatically reconcile and mark commissions as paid." />

      {step === 1 && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: '500' }}>Select Carrier</label>
              <select 
                value={selectedCarrier}
                onChange={e => setSelectedCarrier(e.target.value)}
                style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-2)', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              >
                <option value="">-- Choose Carrier --</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: 'var(--text-secondary)', fontWeight: '500' }}>Upload CSV File</label>
              <input 
                type="file" 
                accept=".csv"
                onChange={e => setFile(e.target.files[0])}
                style={{ display: 'block' }}
              />
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                CSV must contain &quot;PolicyNumber&quot; and &quot;CommissionAmount&quot; columns.
              </p>
            </div>

            <div>
              <Button 
                onClick={handleFileParse} 
                disabled={!file || !selectedCarrier || isProcessing}
                isLoading={isProcessing}
              >
                Upload & Match
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <Card style={{ borderLeft: '4px solid var(--status-success, #2FA84F)' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Matched Lines</h3>
              <p style={{ fontSize: 'var(--text-display)', fontWeight: 'bold', color: 'var(--status-success, #2FA84F)', margin: 0 }}>{matchedLines.length}</p>
            </Card>
            <Card style={{ borderLeft: '4px solid var(--brand-gold)' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>Unmatched Lines</h3>
              <p style={{ fontSize: 'var(--text-display)', fontWeight: 'bold', color: 'var(--ink-gold)', margin: 0 }}>{unmatchedLines.length}</p>
            </Card>
          </div>

          <Card style={{ marginBottom: 'var(--space-3)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--brand-navy)' }}>Ready to Import</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              Confirming will mark <strong>{matchedLines.length}</strong> base commissions and their associated overrides as &quot;Paid&quot; and log <strong>{unmatchedLines.length}</strong> unmatched statement lines for future review.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => setStep(1)}>Cancel</Button>
              <Button onClick={confirmImport} isLoading={isProcessing}>Confirm & Process</Button>
            </div>
          </Card>
          
          {unmatchedLines.length > 0 && (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <h3 style={{ padding: 'var(--space-2)', margin: 0, borderBottom: '1px solid var(--border-color)', color: 'var(--brand-navy)' }}>Unmatched Preview</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th scope="col" style={{ padding: 'var(--space-2) 16px' }}>Policy Number</th>
                    <th scope="col" style={{ padding: 'var(--space-2) 16px' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedLines.slice(0, 10).map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 'var(--space-2) 16px' }}>{u.csvData.PolicyNumber || 'N/A'}</td>
                      <td style={{ padding: 'var(--space-2) 16px' }}>${u.csvData.CommissionAmount}</td>
                    </tr>
                  ))}
                  {unmatchedLines.length > 10 && (
                    <tr>
                      <td colSpan="2" style={{ padding: 'var(--space-2) 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>+ {unmatchedLines.length - 10} more</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {step === 3 && (
        <Card style={{ textAlign: 'center', padding: 'var(--space-5) 24px' }}>
          <h2 style={{ color: 'var(--brand-navy)', margin: '0 0 8px 0' }}>Import Successful</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            Commissions and overrides have been marked as paid.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
            <Button onClick={() => router.push('/dashboard/commissions')}>Go to Commissions</Button>
            {showUndo && (
              <Button variant="danger"
               
                onClick={handleUndo}
                isLoading={isUndoing}
                disabled={isUndoing}
              >
                Undo Import
              </Button>
            )}
          </div>
          {showUndo && (
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
              Undo is available for 5 minutes after import.
            </p>
          )}
        </Card>
      )}

    </div>
  );
}
