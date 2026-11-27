"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import AgentSearchSelect from '@/components/AgentSearchSelect';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useUser } from '@/context/UserContext';
import { fetchAgents } from '@/app/actions/agents';
import { getAllOverridesForAgency } from '@/app/actions/overrides';
import { ANNUITY_PRODUCTS, ANNUITY_TITLE_LEVELS } from '@/app/dashboard/calculator/AnnuityCalculator';
import { LIFE_PRODUCTS, LIFE_TITLE_LEVELS } from '@/app/dashboard/calculator/LifeCalculator';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

import SegTabs from '@/components/ui/SegTabs';
/* ─── CRM agent level (1-5) → commission title key mapping ─── */
const LEVEL_TO_TITLE_KEY = {
  1: null,      // Unlicensed — cannot sell
  2: 'fa',      // Financial Associate
  3: 'sfa',     // Senior Financial Associate
  4: 'fd',      // Financial Director
  5: 'sfd',     // Senior Financial Director
};

const GEN_LABELS = [
  '1st Gen', '2nd Gen', '3rd Gen', '4th Gen',
  '5th Gen', '6th Gen', '7th Gen', '8th Gen',
];

const PIE_COLORS = ['#0C1022', '#E3A94A', '#E3A94A', '#10B981', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16'];

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

const fmt = (v) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const selectStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '8px',
  border: '1px solid rgba(0,0,0,0.12)', fontSize: 'var(--text-caption)',
  backgroundColor: '#fff', color: 'var(--text-primary)',
  height: '46px', boxSizing: 'border-box',
};

const inputStyle = {
  ...selectStyle,
  appearance: 'none', MozAppearance: 'textfield',
};

export default function CommissionDistributionPage() {
  const { userProfile } = useUser();
  const [agents, setAgents] = useState([]);
  const [allOverrides, setAllOverrides] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ─── Product selection ─── */
  const [productType, setProductType] = useState('annuity');
  const [carrier, setCarrier] = useState('');
  const [productName, setProductName] = useState('');
  const [ageBand, setAgeBand] = useState('');

  /* ─── Agent & premium ─── */
  const [sellingAgentId, setSellingAgentId] = useState('');
  const [titleOverride, setTitleOverride] = useState('');
  const [premiumStr, setPremiumStr] = useState('10000');

  /* ─── Access gate ─── */
  const isAdmin = userProfile?.is_owner || ['admin', 'it_engineer'].includes(userProfile?.role);

  useEffect(() => {
    if (!userProfile) return;
    Promise.all([
      fetchAgents(),
      getAllOverridesForAgency(),
    ]).then(([agentRes, overrideRes]) => {
      if (agentRes.success) {
        setAgents(agentRes.agents.filter(a => a.status === 'active' || a.is_owner));
      }
      if (overrideRes.success) {
        setAllOverrides(overrideRes.overrides);
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.agency_id]);

  /* ─── Product catalog logic ─── */
  const catalog = productType === 'annuity' ? ANNUITY_PRODUCTS : LIFE_PRODUCTS;
  const titleLevels = productType === 'annuity' ? ANNUITY_TITLE_LEVELS : LIFE_TITLE_LEVELS;

  const carriers = useMemo(() => [...new Set(catalog.map(p => p.carrier))].sort(), [catalog]);
  const products = useMemo(() =>
    carrier ? [...new Set(catalog.filter(p => p.carrier === carrier).map(p => p.product))].sort() : [],
    [catalog, carrier]
  );
  const ageBands = useMemo(() =>
    productName ? [...new Set(catalog.filter(p => p.carrier === carrier && p.product === productName).map(p => p.ageBand))].sort() : [],
    [catalog, carrier, productName]
  );

  /* Auto-select when single option */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (carriers.length === 1) setCarrier(carriers[0]); }, [carriers]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (products.length === 1) setProductName(products[0]); }, [products]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (ageBands.length === 1) setAgeBand(ageBands[0]); }, [ageBands]);

  const selectedProduct = useMemo(() =>
    catalog.find(p => p.carrier === carrier && p.product === productName && p.ageBand === ageBand) || null,
    [catalog, carrier, productName, ageBand]
  );

  /* ─── Agent hierarchy walk ─── */
  const agentMap = useMemo(() => {
    const m = {};
    agents.forEach(a => { m[a.id] = a; });
    return m;
  }, [agents]);

  const sellingAgent = agentMap[sellingAgentId] || null;

  const effectiveTitleKey = titleOverride || (sellingAgent ? LEVEL_TO_TITLE_KEY[sellingAgent.agentLevel] : null);

  const premium = parseFloat(premiumStr) || 0;

  /* Walk uplines for generation overrides */
  const hierarchyChain = useMemo(() => {
    if (!sellingAgent) return [];
    const chain = [];
    let currentId = sellingAgent.upline_id;
    const visited = new Set();
    while (currentId && !visited.has(currentId) && chain.length < 8) {
      visited.add(currentId);
      const agent = agentMap[currentId];
      if (!agent) break;
      chain.push(agent);
      currentId = agent.upline_id;
    }
    return chain;
  }, [sellingAgent, agentMap]);

  /* ─── Commission splits for selling agent ─── */
  const agentSplits = useMemo(() => {
    if (!sellingAgentId) return [];
    return allOverrides.filter(o => o.agentId === sellingAgentId);
  }, [allOverrides, sellingAgentId]);

  /* ─── Distribution calculation ─── */
  const distribution = useMemo(() => {
    if (!selectedProduct || !sellingAgent || !effectiveTitleKey) return null;

    const sellingCommPct = selectedProduct[effectiveTitleKey] || 0;
    const sellingCommDollar = premium * sellingCommPct / 100;

    /* Commission splits — how the selling agent's commission is divided */
    const totalSplitPct = agentSplits.reduce((s, o) => s + o.percent, 0);
    const agentKeepPct = Math.max(0, 100 - totalSplitPct);

    const splitRows = agentSplits.map(o => {
      const beneficiary = agentMap[o.beneficiaryId];
      return {
        id: o.beneficiaryId,
        name: dn(beneficiary) || o.beneficiaryName || 'Unknown',
        nxtId: beneficiary?.nxt_id || '—',
        role: `Split (${o.percent}%)`,
        titleLabel: '—',
        splitPct: o.percent,
        dollar: sellingCommDollar * o.percent / 100,
        isSplit: true,
      };
    });

    /* Gen override rows */
    const genRows = hierarchyChain.map((agent, i) => {
      const genPct = selectedProduct.gen[i] || 0;
      const genDollar = premium * genPct / 100;
      const titleKey = LEVEL_TO_TITLE_KEY[agent.agentLevel];
      const titleLabel = titleKey
        ? (titleLevels.find(t => t.key === titleKey)?.title || titleKey.toUpperCase())
        : 'Unlicensed';
      return {
        id: agent.id,
        name: dn(agent) || 'Unknown',
        nxtId: agent.nxt_id || '—',
        role: GEN_LABELS[i],
        titleLabel,
        pct: genPct,
        dollar: genDollar,
      };
    });

    const sellingTitleLabel = titleLevels.find(t => t.key === effectiveTitleKey)?.title || effectiveTitleKey.toUpperCase();

    const totalGenOverrides = genRows.reduce((s, r) => s + r.dollar, 0);
    const totalDistributed = sellingCommDollar + totalGenOverrides;

    return {
      selling: {
        id: sellingAgent.id,
        name: dn(sellingAgent) || 'Unknown',
        nxtId: sellingAgent.nxt_id || '—',
        role: 'Selling Agent',
        titleLabel: sellingTitleLabel,
        pct: sellingCommPct,
        dollar: sellingCommDollar,
        keepPct: agentKeepPct,
        keepDollar: sellingCommDollar * agentKeepPct / 100,
      },
      hasSplits: splitRows.length > 0,
      splitRows,
      genRows,
      totalDistributed,
      totalPct: sellingCommPct + genRows.reduce((s, r) => s + r.pct, 0),
    };
  }, [selectedProduct, sellingAgent, effectiveTitleKey, premium, hierarchyChain, titleLevels, agentSplits, agentMap]);

  /* ─── Chart data ─── */
  const pieData = distribution ? [
    ...(distribution.hasSplits
      ? [
          { name: `${distribution.selling.name} (keeps)`, value: Math.round(distribution.selling.keepDollar) },
          ...distribution.splitRows.map(r => ({ name: r.name, value: Math.round(r.dollar) })),
        ]
      : [{ name: distribution.selling.name, value: Math.round(distribution.selling.dollar) }]
    ),
    ...distribution.genRows.filter(r => r.dollar > 0).map(r => ({ name: r.name, value: Math.round(r.dollar) })),
  ] : [];

  const barData = distribution ? [
    { name: 'Selling Agent', amount: Math.round(distribution.selling.dollar), pct: distribution.selling.pct },
    ...distribution.genRows.map(r => ({ name: r.role, amount: Math.round(r.dollar), pct: r.pct })),
  ] : [];

  if (!isAdmin) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <Card style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 'var(--space-3)' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
          <h2 style={{ color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>Admin Access Only</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Commission distribution is restricted to administrators.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'40vh'}}><LoadingSpinner label="Loading..." /></div>;
  }

  return (
    <div style={{ padding: 'var(--space-5) var(--space-4)' }}>
      <PageHeader title="Commission Distribution" subtitle="Calculate how commission splits across your agent hierarchy for any product." />

      {/* Product Type Toggle */}
      <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid rgba(227, 169, 74, 0.2)' }}>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <SegTabs label="Product type" value={productType} onChange={(k) => { setProductType(k); setCarrier(''); setProductName(''); setAgeBand(''); }} tabs={[{ key: 'annuity', label: 'Annuity' }, { key: 'life', label: 'Life' }]} />
        </div>

        {/* Product Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Carrier
            </label>
            <select value={carrier} onChange={(e) => { setCarrier(e.target.value); setProductName(''); setAgeBand(''); }} style={selectStyle}>
              <option value="">Select Carrier</option>
              {carriers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Product
            </label>
            <select value={productName} onChange={(e) => { setProductName(e.target.value); setAgeBand(''); }} style={selectStyle} disabled={!carrier}>
              <option value="">Select Product</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Age Band
            </label>
            <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} style={selectStyle} disabled={!productName}>
              <option value="">Select Age Band</option>
              {ageBands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Agent Selection & Premium */}
      <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid rgba(227, 169, 74, 0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Selling Agent
            </label>
            <AgentSearchSelect
              items={agents.filter(a => dn(a)).sort((a, b) => dn(a).localeCompare(dn(b)))}
              value={sellingAgentId}
              onChange={(id) => { setSellingAgentId(id); setTitleOverride(''); }}
              placeholder="Search agent by name or NXT ID..."
              renderItem={(a) => (
                <>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0C1022', backgroundColor: 'rgba(12, 16, 34,0.08)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', flexShrink: 0 }}>
                    {a.nxt_id || '---'}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{dn(a)}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    {a.contractLevel || 'Unlicensed'}
                  </span>
                </>
              )}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Title Level {sellingAgent ? '(override)' : ''}
            </label>
            <select
              value={titleOverride || (sellingAgent ? (LEVEL_TO_TITLE_KEY[sellingAgent.agentLevel] || '') : '')}
              onChange={(e) => setTitleOverride(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select Title</option>
              {titleLevels.map(t => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Premium Amount ($)
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={premiumStr}
              onChange={(e) => setPremiumStr(e.target.value)}
              style={inputStyle}
              placeholder="Enter premium"
            />
          </div>
        </div>
        {sellingAgent && (
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'rgba(0, 32, 91, 0.03)', borderRadius: '8px', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--brand-navy)' }}>Hierarchy chain:</strong>{' '}
            {dn(sellingAgent)}
            {hierarchyChain.length > 0 && ' → '}
            {hierarchyChain.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ' → '}
                {dn(a)}
                <span style={{ opacity: 0.5 }}> ({GEN_LABELS[i]})</span>
              </span>
            ))}
            {hierarchyChain.length === 0 && <span style={{ opacity: 0.6 }}> (no upline found)</span>}
            {agentSplits.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <strong style={{ color: 'var(--brand-gold)' }}>Commission splits:</strong>{' '}
                {agentSplits.map((s, i) => (
                  <span key={s.beneficiaryId}>
                    {i > 0 && ', '}
                    {s.beneficiaryName} ({s.percent}%)
                  </span>
                ))}
                <span style={{ opacity: 0.6 }}> — agent keeps {Math.max(0, 100 - agentSplits.reduce((s, o) => s + o.percent, 0))}%</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Results */}
      {distribution && premium > 0 && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #0C1022 0%, #1a3a6e 100%)', color: '#fff' }}>
              <p style={{ fontSize: 'var(--text-caption)', opacity: 0.8, margin: '0 0 4px 0' }}>Premium</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{fmt(premium)}</p>
            </Card>
            <Card style={{ textAlign: 'center', background: 'linear-gradient(135deg, #E3A94A 0%, #d4af5a 100%)', color: '#fff' }}>
              <p style={{ fontSize: 'var(--text-caption)', opacity: 0.9, margin: '0 0 4px 0' }}>Selling Agent</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{fmt(distribution.selling.dollar)}</p>
            </Card>
            <Card style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>Gen Overrides</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                {fmt(distribution.genRows.reduce((s, r) => s + r.dollar, 0))}
              </p>
            </Card>
            <Card style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>Total Distributed</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--brand-navy)', margin: 0 }}>
                {fmt(distribution.totalDistributed)}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                {distribution.totalPct.toFixed(4)}% of premium
              </p>
            </Card>
          </div>

          {/* Distribution Table */}
          <Card style={{ marginBottom: 'var(--space-4)', overflow: 'hidden' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
              Distribution Breakdown
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-caption)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--brand-navy)', color: '#fff' }}>
                    <th scope="col" style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Agent</th>
                    <th scope="col" style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>NXT ID</th>
                    <th scope="col" style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Role</th>
                    <th scope="col" style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Title Level</th>
                    <th scope="col" style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Rate</th>
                    <th scope="col" style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Selling agent row */}
                  <tr style={{ backgroundColor: 'rgba(227, 169, 74, 0.08)', borderBottom: distribution.hasSplits ? '1px solid rgba(227, 169, 74,0.3)' : '2px solid var(--brand-gold)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--brand-navy)' }}>
                      {distribution.selling.name}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{distribution.selling.nxtId}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', backgroundColor: 'var(--brand-gold)', color: '#fff', fontSize: '13px', fontWeight: 700 }}>
                        Selling Agent
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{distribution.selling.titleLabel}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: 'var(--brand-navy)' }}>{distribution.selling.pct}%</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>{fmt(distribution.selling.dollar)}</td>
                  </tr>
                  {/* Commission split rows (if any) */}
                  {distribution.hasSplits && (
                    <>
                      <tr style={{ backgroundColor: 'rgba(227, 169, 74, 0.04)' }}>
                        <td colSpan={6} style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Commission Split Breakdown — {distribution.selling.name}&apos;s {fmt(distribution.selling.dollar)} splits as:
                        </td>
                      </tr>
                      {/* Agent's own keep */}
                      <tr style={{ backgroundColor: 'rgba(227, 169, 74, 0.04)', borderBottom: '1px solid rgba(227, 169, 74,0.15)' }}>
                        <td style={{ padding: '10px 12px 10px 28px', fontWeight: 600, color: 'var(--brand-navy)' }}>
                          ↳ {distribution.selling.name}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{distribution.selling.nxtId}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(227, 169, 74, 0.15)', color: 'var(--brand-gold)', fontSize: '13px', fontWeight: 600 }}>
                            Keeps {distribution.selling.keepPct}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>—</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--brand-navy)' }}>{distribution.selling.keepPct}%</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--brand-navy)' }}>{fmt(distribution.selling.keepDollar)}</td>
                      </tr>
                      {/* Split beneficiaries */}
                      {distribution.splitRows.map((row, i) => (
                        <tr key={row.id} style={{ backgroundColor: 'rgba(227, 169, 74, 0.04)', borderBottom: i === distribution.splitRows.length - 1 ? '2px solid var(--brand-gold)' : '1px solid rgba(227, 169, 74,0.15)' }}>
                          <td style={{ padding: '10px 12px 10px 28px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            ↳ {row.name}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.nxtId}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(227, 169, 74, 0.15)', color: 'var(--brand-gold)', fontSize: '13px', fontWeight: 600 }}>
                              {row.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.titleLabel}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.splitPct}%</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(row.dollar)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Gen override rows */}
                  {distribution.genRows.map((row, i) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', backgroundColor: i % 2 === 0 ? '#fff' : 'rgba(0,0,0,0.015)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.nxtId}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', backgroundColor: 'rgba(0, 32, 91, 0.08)', color: 'var(--brand-navy)', fontSize: '13px', fontWeight: 600 }}>
                          {row.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{row.titleLabel}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{row.pct}%</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(row.dollar)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'rgba(0, 32, 91, 0.04)', borderTop: '2px solid var(--brand-navy)' }}>
                    <td colSpan={4} style={{ padding: '12px', fontWeight: 800, color: 'var(--brand-navy)' }}>Total Distributed</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)' }}>{distribution.totalPct.toFixed(4)}%</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>{fmt(distribution.totalDistributed)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {/* Distribution Bar Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Distribution by Role
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 13, fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip formatter={(value, name) => name === 'amount' ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Bar dataKey="amount" name="Amount" fill="#0C1022" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Distribution Pie Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Share of Distribution
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={95}
                    dataKey="value"
                    label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Product Info */}
          {selectedProduct && (
            <Card style={{ backgroundColor: 'rgba(0, 32, 91, 0.02)', border: '1px solid rgba(0, 32, 91, 0.08)' }}>
              <h4 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
                Product Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                <div><strong style={{ color: 'var(--brand-navy)' }}>Carrier:</strong> {selectedProduct.carrier}</div>
                <div><strong style={{ color: 'var(--brand-navy)' }}>Product:</strong> {selectedProduct.product}</div>
                <div><strong style={{ color: 'var(--brand-navy)' }}>State:</strong> {selectedProduct.state}</div>
                <div><strong style={{ color: 'var(--brand-navy)' }}>Age Band:</strong> {selectedProduct.ageBand}</div>
              </div>
              <p style={{ color: 'var(--brand-gold)', fontSize: 'var(--text-caption)', lineHeight: 1.6, margin: 'var(--space-3) 0 0 0', fontWeight: 600 }}>
                &#9888; This calculation is based on standard commission schedules. Actual payouts may vary based on carrier contracts and individual agent agreements. For Reference Only.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Empty state guidance */}
      {(!distribution || premium <= 0) && (
        <Card style={{ textAlign: 'center', padding: 'var(--space-6)', border: '2px dashed rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: 'var(--space-3)', opacity: 0.3 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <h3 style={{ color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>Select a Product &amp; Agent</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Choose a carrier product, select the selling agent, and enter the premium amount to see how commission distributes across the hierarchy.
          </p>
        </Card>
      )}
    </div>
  );
}
