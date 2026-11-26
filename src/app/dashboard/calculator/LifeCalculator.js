"use client";

import React, { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const PIE_COLORS = ['#0C1022', '#E3A94A', '#E3A94A', '#10B981'];

export const LIFE_PRODUCTS = [
  { carrier: 'Allianz', type: 'IUL', product: 'Accumulator IUL', state: 'Non-NY', ageBand: '0-80', factor: 80, fa: 60, sfa: 72, fd: 84, fd2: 89.6, fd3: 92, sfd: 96, sfdPlus: 104, gen: [12, 5.6, 2.8, 1.8, 1, 0.4, 0.2, 0.2], total: 128 },
  { carrier: 'Ameritas', type: 'IUL', product: 'Growth Index UL', state: 'Non-NY', ageBand: 'N/A', factor: 73, fa: 54.75, sfa: 65.7, fd: 76.65, fd2: 81.76, fd3: 83.95, sfd: 87.6, sfdPlus: 94.9, gen: [10.95, 5.11, 2.555, 1.6425, 0.9125, 0.365, 0.1825, 0.1825], total: 116.8 },
  { carrier: 'Corebridge Financial', type: 'IUL', product: 'Max Accumulator+ III', state: 'Non-NY', ageBand: 'N/A', factor: 76, fa: 57, sfa: 68.4, fd: 79.8, fd2: 85.12, fd3: 87.4, sfd: 91.2, sfdPlus: 98.8, gen: [11.4, 5.32, 2.66, 1.71, 0.95, 0.38, 0.19, 0.19], total: 121.6 },
  { carrier: 'Corebridge Financial', type: 'Term', product: 'Select-A-Term 20-30 & 35 yr', state: 'Non-NY', ageBand: 'N/A', factor: 76, fa: 57, sfa: 68.4, fd: 79.8, fd2: 85.12, fd3: 87.4, sfd: 91.2, sfdPlus: 98.8, gen: [11.4, 5.32, 2.66, 1.71, 0.95, 0.38, 0.19, 0.19], total: 121.6 },
  { carrier: 'Corebridge Financial', type: 'IUL', product: 'Value+ Protector III', state: 'Non-NY', ageBand: 'N/A', factor: 70, fa: 52.5, sfa: 63, fd: 73.5, fd2: 78.4, fd3: 80.5, sfd: 84, sfdPlus: 91, gen: [10.5, 4.9, 2.45, 1.575, 0.875, 0.35, 0.175, 0.175], total: 112 },
  { carrier: 'Fidelity & Guaranty', type: 'IUL', product: 'Pathsetter', state: 'Non-NY', ageBand: '18-80', factor: 83, fa: 62.25, sfa: 74.7, fd: 87.15, fd2: 92.96, fd3: 95.45, sfd: 99.6, sfdPlus: 107.9, gen: [12.45, 5.81, 2.905, 1.8675, 1.0375, 0.415, 0.2075, 0.2075], total: 132.8 },
  { carrier: 'Fidelity & Guaranty', type: 'IUL', product: 'Everlast', state: 'Non-NY', ageBand: '18-80', factor: 82, fa: 61.5, sfa: 73.8, fd: 86.1, fd2: 91.84, fd3: 94.3, sfd: 98.4, sfdPlus: 106.6, gen: [12.3, 5.74, 2.87, 1.845, 1.025, 0.41, 0.205, 0.205], total: 131.2 },
  { carrier: 'Foresters', type: 'Term', product: 'Strong Foundation 15/20/25/30 Year Non-Medical Term', state: 'Non-NY', ageBand: 'N/A', factor: 90, fa: 67.5, sfa: 81, fd: 94.5, fd2: 100.8, fd3: 103.5, sfd: 108, sfdPlus: 117, gen: [13.5, 6.3, 3.15, 2.025, 1.125, 0.45, 0.225, 0.225], total: 144 },
  { carrier: 'Foresters', type: 'Whole', product: 'PlanRight Level/Graded', state: 'Non-NY', ageBand: '50-80', factor: 80, fa: 60, sfa: 72, fd: 84, fd2: 89.6, fd3: 92, sfd: 96, sfdPlus: 104, gen: [12, 5.6, 2.8, 1.8, 1, 0.4, 0.2, 0.2], total: 128 },
  { carrier: 'John Hancock', type: 'Term', product: 'Vitality Term 20/30', state: 'Non-NY', ageBand: 'N/A', factor: 77, fa: 57.75, sfa: 69.3, fd: 80.85, fd2: 86.24, fd3: 88.55, sfd: 92.4, sfdPlus: 100.1, gen: [11.55, 5.39, 2.695, 1.7325, 0.9625, 0.385, 0.1925, 0.1925], total: 123.2 },
  { carrier: 'John Hancock', type: 'IUL', product: 'Accumulation IUL', state: 'Non-NY', ageBand: 'N/A', factor: 60, fa: 45, sfa: 54, fd: 63, fd2: 67.2, fd3: 69, sfd: 72, sfdPlus: 78, gen: [9, 4.2, 2.1, 1.35, 0.75, 0.3, 0.15, 0.15], total: 96 },
  { carrier: 'Mutual of Omaha', type: 'IUL', product: 'Income Advantage / Life Protection Advantage', state: 'Non-NY', ageBand: 'N/A', factor: 76, fa: 57, sfa: 68.4, fd: 79.8, fd2: 85.12, fd3: 87.4, sfd: 91.2, sfdPlus: 98.8, gen: [11.4, 5.32, 2.66, 1.71, 0.95, 0.38, 0.19, 0.19], total: 121.6 },
  { carrier: 'Mutual of Omaha', type: 'IUL', product: 'Indexed Universal Life Express', state: 'Non-NY', ageBand: 'N/A', factor: 80, fa: 60, sfa: 72, fd: 84, fd2: 89.6, fd3: 92, sfd: 96, sfdPlus: 104, gen: [12, 5.6, 2.8, 1.8, 1, 0.4, 0.2, 0.2], total: 128 },
  { carrier: 'Mutual of Omaha', type: 'Term', product: 'Term Life Express 15, 20 & 30', state: 'Non-NY', ageBand: 'N/A', factor: 90, fa: 67.5, sfa: 81, fd: 94.5, fd2: 100.8, fd3: 103.5, sfd: 108, sfdPlus: 117, gen: [13.5, 6.3, 3.15, 2.025, 1.125, 0.45, 0.225, 0.225], total: 144 },
  { carrier: 'National Life Group (LSW)', type: 'IUL', product: 'FlexLife', state: 'Non-NY', ageBand: 'N/A', factor: 70, fa: 52.5, sfa: 63, fd: 73.5, fd2: 78.4, fd3: 80.5, sfd: 84, sfdPlus: 91, gen: [10.5, 4.9, 2.45, 1.575, 0.875, 0.35, 0.175, 0.175], total: 112 },
  { carrier: 'National Life Group (LSW)', type: 'Term', product: 'Term 20 & 30', state: 'Non-NY', ageBand: 'N/A', factor: 65, fa: 48.75, sfa: 58.5, fd: 68.25, fd2: 72.8, fd3: 74.75, sfd: 78, sfdPlus: 84.5, gen: [9.75, 4.55, 2.275, 1.4625, 0.8125, 0.325, 0.1625, 0.1625], total: 104 },
  { carrier: 'Nationwide', type: 'Term', product: 'Guaranteed Level Term 20/30 Yr', state: 'Non-NY', ageBand: 'N/A', factor: 68, fa: 51, sfa: 61.2, fd: 71.4, fd2: 76.16, fd3: 78.2, sfd: 81.6, sfdPlus: 88.4, gen: [10.2, 4.76, 2.38, 1.53, 0.85, 0.34, 0.17, 0.17], total: 108.8 },
  { carrier: 'Nationwide', type: 'IUL', product: 'IUL Protector II', state: 'Non-NY', ageBand: 'N/A', factor: 68, fa: 51, sfa: 61.2, fd: 71.4, fd2: 76.16, fd3: 78.2, sfd: 81.6, sfdPlus: 88.4, gen: [10.2, 4.76, 2.38, 1.53, 0.85, 0.34, 0.17, 0.17], total: 108.8 },
  { carrier: 'Nationwide', type: 'IUL', product: 'IUL Accumulator II', state: 'Non-NY', ageBand: 'N/A', factor: 67, fa: 50.25, sfa: 60.3, fd: 70.35, fd2: 75.04, fd3: 77.05, sfd: 80.4, sfdPlus: 87.1, gen: [10.05, 4.69, 2.345, 1.5075, 0.8375, 0.335, 0.1675, 0.1675], total: 107.2 },
  { carrier: 'North American', type: 'Term', product: 'ADDvantage 20/30', state: 'Non-NY', ageBand: 'N/A', factor: 70, fa: 52.5, sfa: 63, fd: 73.5, fd2: 78.4, fd3: 80.5, sfd: 84, sfdPlus: 91, gen: [10.5, 4.9, 2.45, 1.575, 0.875, 0.35, 0.175, 0.175], total: 112 },
  { carrier: 'North American', type: 'IUL', product: 'Builder Plus 4 IUL', state: 'Non-NY', ageBand: 'N/A', factor: 75, fa: 56.25, sfa: 67.5, fd: 78.75, fd2: 84, fd3: 86.25, sfd: 90, sfdPlus: 97.5, gen: [11.25, 5.25, 2.625, 1.6875, 0.9375, 0.375, 0.1875, 0.1875], total: 120 },
  { carrier: 'North American', type: 'IUL', product: 'Smart Builder 3 IUL', state: 'Non-NY', ageBand: 'N/A', factor: 65, fa: 48.75, sfa: 58.5, fd: 68.25, fd2: 72.8, fd3: 74.75, sfd: 78, sfdPlus: 84.5, gen: [9.75, 4.55, 2.275, 1.4625, 0.8125, 0.325, 0.1625, 0.1625], total: 104 },
  { carrier: 'Protective', type: 'Term', product: 'Classic Choice 20, 30, 35, & 40 Yr', state: 'Non-NY', ageBand: 'N/A', factor: 73, fa: 54.75, sfa: 65.7, fd: 76.65, fd2: 81.76, fd3: 83.95, sfd: 87.6, sfdPlus: 94.9, gen: [10.95, 5.11, 2.555, 1.6425, 0.9125, 0.365, 0.1825, 0.1825], total: 116.8 },
  { carrier: 'Transamerica', type: 'IUL', product: 'Financial Foundation IUL', state: 'Non-NY', ageBand: 'N/A', factor: 73, fa: 54.75, sfa: 65.7, fd: 76.65, fd2: 81.76, fd3: 83.95, sfd: 87.6, sfdPlus: 94.9, gen: [10.95, 5.11, 2.555, 1.6425, 0.9125, 0.365, 0.1825, 0.1825], total: 116.8 },
  { carrier: 'Transamerica', type: 'Term', product: 'Trendsetter LB 20/30', state: 'Non-CT, NY', ageBand: 'N/A', factor: 65, fa: 48.75, sfa: 58.5, fd: 68.25, fd2: 72.8, fd3: 74.75, sfd: 78, sfdPlus: 84.5, gen: [9.75, 4.55, 2.275, 1.4625, 0.8125, 0.325, 0.1625, 0.1625], total: 104 },
];

export const LIFE_TITLE_LEVELS = [
  { key: 'fa', title: 'Financial Associate (FA)', pct: '75%' },
  { key: 'sfa', title: 'Senior Financial Associate (SFA)', pct: '90%' },
  { key: 'fd', title: 'Financial Director (FD)', pct: '105%' },
  { key: 'fd2', title: 'Financial Director II (FD II)', pct: '112%' },
  { key: 'fd3', title: 'Financial Director III (FD III)', pct: '115%' },
  { key: 'sfd', title: 'Senior Financial Director (SFD)', pct: '120%' },
  { key: 'sfdPlus', title: 'Senior Financial Director+ (SFD+)', pct: '130%' },
];

const GEN_LABELS = ['1st (15%)', '2nd (7%)', '3rd (3.5%)', '4th (2.25%)', '5th (1.25%)', '6th (0.5%)', '7th (0.25%)', '8th (0.25%)'];
const GEN_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const RAW_GEN_OVERRIDES = [15, 7, 3.5, 2.25, 1.25, 0.5, 0.25, 0.25];

const selectStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: '1px solid var(--border-color)', fontSize: 'var(--text-body)',
  color: 'var(--text-primary)', backgroundColor: 'var(--surface-card)', outline: 'none',
  fontWeight: 600, appearance: 'none', WebkitAppearance: 'none',
  lineHeight: '1.5',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center',
  paddingRight: '40px',
};

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: '1px solid var(--border-color)', fontSize: 'var(--text-body)',
  color: 'var(--text-primary)', backgroundColor: 'var(--surface-card)', outline: 'none',
  fontWeight: 600,
};

const thStyle = { textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 };
const thStyleLeft = { ...thStyle, textAlign: 'left' };

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function LifeCalculator() {
  const [typeFilter, setTypeFilter] = useState('');
  const [carrier, setCarrier] = useState('');
  const [product, setProduct] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [premiumStr, setPremiumStr] = useState('5000');
  const [selectedLevel, setSelectedLevel] = useState('fa');

  const productTypes = useMemo(() => [...new Set(LIFE_PRODUCTS.map(p => p.type))], []);

  const carriers = useMemo(() => {
    const filtered = typeFilter ? LIFE_PRODUCTS.filter(p => p.type === typeFilter) : LIFE_PRODUCTS;
    return [...new Set(filtered.map(p => p.carrier))];
  }, [typeFilter]);

  const products = useMemo(() => {
    if (!carrier) return [];
    let filtered = LIFE_PRODUCTS.filter(p => p.carrier === carrier);
    if (typeFilter) filtered = filtered.filter(p => p.type === typeFilter);
    return [...new Set(filtered.map(p => p.product))];
  }, [carrier, typeFilter]);

  const ageBands = useMemo(() => {
    if (!carrier || !product) return [];
    return [...new Set(LIFE_PRODUCTS.filter(p => p.carrier === carrier && p.product === product).map(p => p.ageBand))];
  }, [carrier, product]);

  // Auto-select age band when only one option (derived value)
  const effectiveAgeBand = (ageBands.length === 1) ? ageBands[0] : ageBand;

  const selectedProduct = useMemo(() => {
    if (!carrier || !product || !effectiveAgeBand) return null;
    return LIFE_PRODUCTS.find(p => p.carrier === carrier && p.product === product && p.ageBand === effectiveAgeBand) || null;
  }, [carrier, product, effectiveAgeBand]);

  const premium = Number(premiumStr) || 0;

  const commissionPct = selectedProduct ? selectedProduct[selectedLevel] : 0;
  const commissionDollar = premium * commissionPct / 100;
  const genOverrideTotal = selectedProduct ? selectedProduct.gen.reduce((s, v) => s + v, 0) : 0;
  const genOverrideDollar = premium * genOverrideTotal / 100;
  const totalToField = selectedProduct ? selectedProduct.total : 0;

  const barData = selectedProduct ? LIFE_TITLE_LEVELS.map(lvl => ({
    name: lvl.key.toUpperCase(),
    'Commission %': selectedProduct[lvl.key],
    'Commission $': Math.round(premium * selectedProduct[lvl.key] / 100),
  })) : [];

  const pieData = selectedProduct ? [
    { name: 'Direct Commission', value: Math.round(commissionDollar) },
    { name: 'Gen Overrides', value: Math.round(genOverrideDollar) },
  ].filter(d => d.value > 0) : [];

  const genBarData = selectedProduct ? selectedProduct.gen.map((g, i) => ({
    name: GEN_LABELS[i].split(' ')[0],
    'Override %': g,
    'Override $': Math.round(premium * g / 100),
  })) : [];

  const lineData = selectedProduct ? LIFE_TITLE_LEVELS.map(lvl => ({
    name: lvl.key.toUpperCase(),
    'Commission %': selectedProduct[lvl.key],
  })) : [];

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid rgba(227, 169, 74, 0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Product Type
            </label>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCarrier(''); setProduct(''); setAgeBand(''); }} style={selectStyle}>
              <option value="">All Types</option>
              {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Carrier
            </label>
            <select value={carrier} onChange={(e) => { setCarrier(e.target.value); setProduct(''); setAgeBand(''); }} style={selectStyle}>
              <option value="">Select Carrier</option>
              {carriers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Product
            </label>
            <select value={product} onChange={(e) => { setProduct(e.target.value); setAgeBand(''); }} style={selectStyle} disabled={!carrier}>
              <option value="">Select Product</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Age Band
            </label>
            <select value={effectiveAgeBand} onChange={(e) => setAgeBand(e.target.value)} style={selectStyle} disabled={!product || ageBands.length <= 1}>
              {ageBands.length <= 1 ? null : <option value="">Select Age Band</option>}
              {ageBands.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Annual Premium ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={premiumStr}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setPremiumStr(v); }}
              onBlur={() => { if (premiumStr === '') setPremiumStr('0'); }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Your NXT Title Level
            </label>
            <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} style={selectStyle}>
              {LIFE_TITLE_LEVELS.map(l => <option key={l.key} value={l.key}>{l.title} — {l.pct}</option>)}
            </select>
          </div>
        </div>

        {selectedProduct && (
          <div style={{
            marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'rgba(0, 32, 91, 0.04)', borderRadius: '10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
          }}>
            <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
              Product: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.product}</strong> | Type: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.type}</strong> | State: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.state}</strong> | Factor: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.factor}%</strong>
            </span>
          </div>
        )}
      </Card>

      {/* Summary Cards */}
      {selectedProduct && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Your Commission %</div>
              <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{commissionPct}%</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>{LIFE_TITLE_LEVELS.find(l => l.key === selectedLevel)?.title}</div>
            </Card>
            <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Commission $ Amount</div>
              <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(commissionDollar)}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>On {fmt(premium)} annual premium</div>
            </Card>
            <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gen Override Total</div>
              <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(genOverrideDollar)}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>{genOverrideTotal.toFixed(4)}% across 8 gens</div>
            </Card>
          </div>

          {/* Commission Grid Table */}
          <Card style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
              Commission by Title Level
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-secondary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--brand-gold)' }}>
                    <th scope="col" style={thStyleLeft}>Title Level</th>
                    <th scope="col" style={thStyle}>Level %</th>
                    <th scope="col" style={thStyle}>Commission %</th>
                    <th scope="col" style={thStyle}>Commission $</th>
                  </tr>
                </thead>
                <tbody>
                  {LIFE_TITLE_LEVELS.map(lvl => {
                    const pct = selectedProduct[lvl.key];
                    const isSelected = lvl.key === selectedLevel;
                    return (
                      <tr
                        key={lvl.key}
                        style={{
                          borderBottom: '1px solid rgba(0,0,0,0.06)',
                          backgroundColor: isSelected ? 'rgba(227, 169, 74, 0.08)' : 'transparent',
                          fontWeight: isSelected ? 600 : 400
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: isSelected ? 'var(--brand-navy)' : 'var(--text-primary)' }}>
                          {isSelected && <span style={{ color: 'var(--brand-gold)', marginRight: '6px' }}>&#9654;</span>}
                          {lvl.title}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{lvl.pct}</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{pct}%</td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>{fmt(premium * pct / 100)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Generation Overrides Table */}
          <Card style={{ marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
              Generation Overrides
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-secondary)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--brand-gold)' }}>
                    <th scope="col" style={thStyleLeft}>Generation</th>
                    <th scope="col" style={thStyle}>Points</th>
                    <th scope="col" style={thStyle}>Override %</th>
                    <th scope="col" style={thStyle}>Net Override %</th>
                    <th scope="col" style={thStyle}>Total Income</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProduct.gen.map((g, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{GEN_ORDINALS[i]}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmt(premium)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{RAW_GEN_OVERRIDES[i]}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{g}%</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>{fmt(premium * g / 100)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--brand-navy)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>Total</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}></td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>{RAW_GEN_OVERRIDES.reduce((s, v) => s + v, 0)}%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>{genOverrideTotal.toFixed(2)}%</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>{fmt(genOverrideDollar)}</td>
                  </tr>
                  <tr style={{ borderTop: '2px solid var(--brand-gold)', background: 'rgba(0,32,91,0.04)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Total to Field</td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}></td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                      {(Number((LIFE_TITLE_LEVELS[LIFE_TITLE_LEVELS.length - 1]?.pct || '0').replace('%', '')) + RAW_GEN_OVERRIDES.reduce((s, v) => s + v, 0))}%
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                      {(selectedProduct.sfdPlus + genOverrideTotal).toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                      {fmt(premium * (selectedProduct.sfdPlus + genOverrideTotal) / 100)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5, margin: 'var(--space-2) 0 0 0', fontStyle: 'italic' }}>
              This is an example only and will be different based on product and company. Factor percentages may vary. Internal use only.
            </p>
          </Card>

          {/* Charts 2x2 Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {/* Commission Bar Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Commission by Title Level
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value, name) => name.includes('$') ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Bar dataKey="Commission $" fill="#0C1022" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Earnings Breakdown Pie */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Earnings Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Generation Overrides Bar */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Generation Overrides
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={genBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value, name) => name.includes('$') ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Bar dataKey="Override $" fill="#E3A94A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Commission % Growth Line */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Commission % Growth by Title
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value) => value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Line type="monotone" dataKey="Commission %" stroke="#0C1022" strokeWidth={2} dot={{ r: 4, fill: '#0C1022' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* Disclaimer */}
      <Card style={{ backgroundColor: 'rgba(0, 32, 91, 0.02)', border: '1px solid rgba(0, 32, 91, 0.08)' }}>
        <h4 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
          Carrier Level &mdash; Life Comp
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', lineHeight: 1.6, margin: '0 0 var(--space-2) 0' }}>
          Note: All compensation figures are applicable to Non-New York (Non-NY) business only and are for professional use. Compensation may vary for New York business and is subject to the applicable carrier contract, product, state regulations, and underwriting requirements.
        </p>
        <p style={{ color: 'var(--brand-gold)', fontSize: 'var(--text-caption)', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
          &#9888; Information subject to change based on carrier updates. This grid does not serve as a binding contract &mdash; for Reference Only. Contact your NXT Financial Group Sales Consultant with questions.
        </p>
      </Card>
    </div>
  );
}
