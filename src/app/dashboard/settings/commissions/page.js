"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCarriers, fetchCommissionRates, createOrUpdateCarrier, createOrUpdateRate } from '@/app/actions/commissions';
import { useUser } from '@/context/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { AGENT_LEVELS } from '@/lib/constants';
import { useToast } from '@/components/ui/Toast';

export default function CommissionsSettings() {
  const router = useRouter();
  const { userProfile } = useUser();
  const toast = useToast();

  const [carriers, setCarriers] = useState([]);
  const [rates, setRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('carriers'); // 'carriers' or 'rates'

  // Carrier Modal
  const [carrierModalOpen, setCarrierModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [carrierName, setCarrierName] = useState('');
  const [carrierActive, setCarrierActive] = useState(true);
  const [carrierSearchQuery, setCarrierSearchQuery] = useState('');

  // Rate Modal
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [rateCarrierId, setRateCarrierId] = useState('');
  const [ratePolicyType, setRatePolicyType] = useState('life');
  const [rateAgentLevel, setRateAgentLevel] = useState('');
  const [ratePercent, setRatePercent] = useState('');
  const [rateEffectiveDate, setRateEffectiveDate] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const loadData = async (agencyId) => {
    setIsLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        fetchCarriers(),
        fetchCommissionRates(agencyId)
      ]);
      if (cRes.success) setCarriers((cRes.carriers || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      if (rRes.success) setRates(rRes.rates);
    } catch (e) {
      // silenced
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!userProfile) return;
    if (!userProfile.is_owner && userProfile.role !== 'admin' && userProfile.role !== 'it_engineer') {
      router.push('/dashboard');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData(userProfile.agency_id);
  }, [userProfile, router]);

  const handleSaveCarrier = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await createOrUpdateCarrier({
      id: editingCarrier?.id,
      agencyId: userProfile.agency_id,
      name: carrierName,
      active: carrierActive
    });
    if (res.success) {
      setCarrierModalOpen(false);
      loadData(userProfile.agency_id);
    } else {
      toast.error(res.error);
    }
    setIsSaving(false);
  };

  const handleSaveRate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await createOrUpdateRate({
      id: editingRate?.id,
      agencyId: userProfile.agency_id,
      carrierId: rateCarrierId,
      policyType: ratePolicyType,
      agentLevel: rateAgentLevel,
      commissionPercent: ratePercent,
      effectiveDate: rateEffectiveDate
    });
    if (res.success) {
      setRateModalOpen(false);
      loadData(userProfile.agency_id);
    } else {
      toast.error(res.error);
    }
    setIsSaving(false);
  };

  const openCarrierModal = (carrier = null) => {
    setEditingCarrier(carrier);
    setCarrierName(carrier?.name || '');
    setCarrierActive(carrier ? carrier.active : true);
    setCarrierSearchQuery('');
    setCarrierModalOpen(true);
  };

  const openRateModal = async (rate = null) => {
    // Re-fetch carriers if empty (in case initial load failed or no carriers were added yet)
    if (carriers.length === 0 && userProfile?.agency_id) {
      try {
        const res = await fetchCarriers();
        if (res.success) setCarriers(res.carriers);
      } catch (e) { /* ignore */ }
    }
    setEditingRate(rate);
    const existingCarrier = rate ? carriers.find(c => c.id === rate.carrierId) : null;
    setCarrierSearch(existingCarrier?.name || '');
    setRateCarrierId(rate?.carrierId || '');
    setRatePolicyType(rate?.policyType || 'life');
    setRateAgentLevel(rate?.agentLevel || '');
    setRatePercent(rate?.commissionPercent || '');
    setRateEffectiveDate(rate?.effectiveDate || new Date().toISOString().split('T')[0]);
    setRateModalOpen(true);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h1 style={{ color: 'var(--brand-navy)', fontSize: 'var(--text-h1)', margin: '0 0 8px 0' }}>Commissions Settings</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Manage Carriers and Commission Rate Schedules</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button onClick={() => openCarrierModal()}>+ Add Carrier</Button>
          <Button onClick={() => openRateModal()}>+ Add Rate</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-color)' }}>
        <div 
          onClick={() => setActiveTab('carriers')}
          style={{ padding: 'var(--space-2) 16px', cursor: 'pointer', borderBottom: activeTab === 'carriers' ? '2px solid var(--brand-navy)' : '2px solid transparent', fontWeight: activeTab === 'carriers' ? '600' : '500', color: activeTab === 'carriers' ? 'var(--brand-navy)' : 'var(--text-secondary)' }}
        >
          Carriers
        </div>
        <div 
          onClick={() => setActiveTab('rates')}
          style={{ padding: 'var(--space-2) 16px', cursor: 'pointer', borderBottom: activeTab === 'rates' ? '2px solid var(--brand-navy)' : '2px solid transparent', fontWeight: activeTab === 'rates' ? '600' : '500', color: activeTab === 'rates' ? 'var(--brand-navy)' : 'var(--text-secondary)' }}
        >
          Rate Schedules
        </div>
      </div>

      {activeTab === 'carriers' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Carrier Name</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Status</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {carriers.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)' }}>No carriers found.</td>
                </tr>
              ) : carriers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{c.name}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <span style={{ backgroundColor: c.active ? 'rgba(47, 168, 79, 0.1)' : 'rgba(0,0,0,0.1)', color: c.active ? 'var(--status-success, #2FA84F)' : 'var(--text-secondary)', padding: '4px 12px', borderRadius: '999px', fontSize: 'var(--text-caption)', fontWeight: '600' }}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={() => openCarrierModal(c)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'rates' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Carrier</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Policy Type</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Agent Level</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Commission %</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Effective Date</th>
                <th scope="col" style={{ padding: 'var(--space-2)', fontWeight: '600', color: 'var(--text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: 'var(--space-3)', textAlign: 'center', color: 'var(--text-secondary)' }}>No rates found.</td>
                </tr>
              ) : rates.map(r => {
                const carrier = carriers.find(c => c.id === r.carrierId);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 'var(--space-2)', fontWeight: '500' }}>{carrier ? carrier.name : 'Unknown'}</td>
                    <td style={{ padding: 'var(--space-2)' }}>{r.policyType}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <span style={{ backgroundColor: 'rgba(201, 154, 61, 0.1)', color: 'var(--brand-gold)', padding: '4px 12px', borderRadius: '999px', fontWeight: '600', fontSize: 'var(--text-caption)' }}>
                        {r.agentLevel}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-2)', fontWeight: '600' }}>{r.commissionPercent}%</td>
                    <td style={{ padding: 'var(--space-2)', color: 'var(--text-secondary)' }}>{r.effectiveDate}</td>
                    <td style={{ padding: 'var(--space-2)' }}>
                      <Button variant="secondary" onClick={() => openRateModal(r)}>Edit</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Carrier Modal */}
      {carrierModalOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setCarrierModalOpen(false); }}
        >
          <Card style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-h2)' }}>
                {editingCarrier ? 'Edit Carrier' : 'Add Carrier'}
              </h3>
              <button
                onClick={() => setCarrierModalOpen(false)}
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '18px' }}
                aria-label="Close"
              >×</button>
            </div>

            {/* Search existing carriers to edit */}
            {carriers.length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--text-caption)', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Existing Carriers — click to edit
                </label>
                <input
                  type="text"
                  placeholder="Search carriers..."
                  value={carrierSearchQuery}
                  onChange={e => setCarrierSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px', marginBottom: '6px', outline: 'none' }}
                />
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--surface-card)' }}>
                  {carriers
                    .filter(c => c.name.toLowerCase().includes(carrierSearchQuery.toLowerCase()))
                    .map(c => (
                      <div
                        key={c.id}
                        onClick={() => { setEditingCarrier(c); setCarrierName(c.name); setCarrierActive(c.active); }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                          borderBottom: '1px solid rgba(0,0,0,0.04)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          backgroundColor: editingCarrier?.id === c.id ? 'rgba(201, 154, 61, 0.12)' : 'transparent',
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>{c.name}</span>
                        <span style={{
                          fontSize: '11px', fontWeight: '600', padding: '2px 10px', borderRadius: '999px',
                          backgroundColor: c.active ? 'rgba(47, 168, 79, 0.1)' : 'rgba(0,0,0,0.06)',
                          color: c.active ? 'var(--status-success, #2FA84F)' : 'var(--text-secondary)',
                        }}>
                          {c.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  {carriers.filter(c => c.name.toLowerCase().includes(carrierSearchQuery.toLowerCase())).length === 0 && (
                    <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '13px' }}>No matching carriers</div>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            {carriers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-2)' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{editingCarrier ? 'editing' : 'or create new'}</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
              </div>
            )}

            <form onSubmit={handleSaveCarrier} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Input
                label={editingCarrier ? 'Carrier Name' : 'New Carrier Name'}
                value={carrierName}
                onChange={e => setCarrierName(e.target.value)}
                placeholder="e.g. Mutual of Omaha"
                required
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={carrierActive} onChange={e => setCarrierActive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-gold)' }} />
                <span style={{ fontSize: '14px', fontWeight: '500' }}>Active</span>
              </label>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                {editingCarrier && (
                  <Button variant="secondary" type="button" onClick={() => { setEditingCarrier(null); setCarrierName(''); setCarrierActive(true); }}>
                    New Instead
                  </Button>
                )}
                <div style={{ flex: 1 }} />
                <Button variant="secondary" type="button" onClick={() => setCarrierModalOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving} disabled={!carrierName.trim()}>
                  {editingCarrier ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Rate Modal */}
      {rateModalOpen && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setRateModalOpen(false); }}
        >
          <Card style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0, color: 'var(--brand-navy)', fontSize: 'var(--text-h2)' }}>
                {editingRate ? 'Edit Rate Schedule' : 'Add Rate Schedule'}
              </h3>
              <button
                onClick={() => setRateModalOpen(false)}
                style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '18px' }}
                aria-label="Close"
              >×</button>
            </div>

            <form onSubmit={handleSaveRate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {/* Carrier searchable dropdown */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--text-caption)', fontWeight: '500', color: 'var(--text-primary)' }}>Carrier *</label>

                {/* Selected carrier chip */}
                {rateCarrierId ? (() => {
                  const selected = carriers.find(c => c.id === rateCarrierId);
                  if (!selected) return null;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 14px', borderRadius: '10px',
                      backgroundColor: 'rgba(47, 168, 79, 0.08)',
                      border: '1px solid rgba(47, 168, 79, 0.2)',
                      fontSize: '14px', color: 'var(--brand-navy)',
                    }}>
                      <span style={{ fontWeight: '600' }}>{selected.name}</span>
                      <button
                        type="button"
                        onClick={() => { setRateCarrierId(''); setCarrierSearch(''); }}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px', padding: '0 4px' }}
                      >×</button>
                    </div>
                  );
                })() : (
                  <>
                    <input
                      type="text"
                      placeholder="Search carriers..."
                      value={carrierSearch}
                      onChange={e => setCarrierSearch(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '14px', marginBottom: '6px', outline: 'none' }}
                    />
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: 'var(--surface-card)' }}>
                      {carriers
                        .filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase()))
                        .map(c => (
                          <div
                            key={c.id}
                            onClick={() => { setRateCarrierId(c.id); setCarrierSearch(c.name); }}
                            style={{
                              padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                              borderBottom: '1px solid rgba(0,0,0,0.04)',
                              fontWeight: '500',
                            }}
                          >
                            {c.name}
                          </div>
                        ))}
                      {carriers.filter(c => c.name.toLowerCase().includes(carrierSearch.toLowerCase())).length === 0 && (
                        <div style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '13px' }}>No carriers found — add one in the Carriers tab first</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Policy Type dropdown */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--text-caption)', fontWeight: '500', color: 'var(--text-primary)' }}>Policy Type *</label>
                <select
                  value={ratePolicyType}
                  onChange={e => setRatePolicyType(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                >
                  <option value="life">Life</option>
                  <option value="health">Health</option>
                  <option value="annuity">Annuity</option>
                  <option value="medicare">Medicare</option>
                  <option value="property_casualty">Property & Casualty</option>
                  <option value="disability">Disability</option>
                  <option value="ltc">Long Term Care</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: 'var(--text-caption)', fontWeight: '500', color: 'var(--text-primary)' }}>Agent Contract Level *</label>
                <select
                  value={rateAgentLevel}
                  onChange={e => setRateAgentLevel(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', fontFamily: 'inherit', fontSize: '14px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                >
                  <option value="">Select Level</option>
                  {AGENT_LEVELS.map(lvl => (
                    <option key={lvl.level} value={lvl.title}>
                      Level {lvl.level} — {lvl.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Commission %"
                    type="number"
                    step="0.01"
                    value={ratePercent}
                    onChange={e => setRatePercent(e.target.value)}
                    placeholder="e.g. 85"
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Effective Date"
                    type="date"
                    value={rateEffectiveDate}
                    onChange={e => setRateEffectiveDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <Button variant="secondary" type="button" onClick={() => setRateModalOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" isLoading={isSaving} disabled={!rateCarrierId}>
                  {editingRate ? 'Update Rate' : 'Save Rate'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
