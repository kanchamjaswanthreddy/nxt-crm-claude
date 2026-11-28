"use client";

import React, { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

export const ANNUITY_PRODUCTS = [
  { carrier: 'Athene', type: 'FIA', product: 'Athene Agility 10', state: 'Non-NY', ageBand: '0-70', adjStreet: 5.0, fa: 3.75, sfa: 4.5, fd: 5.25, sfd: 6, sfdPlus: 6.5, gen: [0.75, 0.35, 0.175, 0.1125, 0.0625, 0.025, 0.0125, 0.0125], total: 8 },
  { carrier: 'Athene', type: 'FIA', product: 'Athene Agility 10', state: 'Non-NY', ageBand: '71-75', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'Athene', type: 'FIA', product: 'Athene Agility 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'Accelerator Plus 10', state: 'Non-CT, NY, VT', ageBand: '0-75', adjStreet: 5.5, fa: 4.125, sfa: 4.95, fd: 5.775, sfd: 6.6, sfdPlus: 7.15, gen: [0.825, 0.385, 0.1925, 0.12375, 0.06875, 0.0275, 0.01375, 0.01375], total: 8.8 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'Accelerator Plus 10', state: 'Non-CT, NY, VT', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'Accelerator Plus 10', state: 'Non-CT, NY, VT', ageBand: '81-85', adjStreet: 2.5, fa: 1.875, sfa: 2.25, fd: 2.625, sfd: 3, sfdPlus: 3.25, gen: [0.375, 0.175, 0.0875, 0.05625, 0.03125, 0.0125, 0.00625, 0.00625], total: 4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G 1-2-3', state: 'Non-CA, MT, NY', ageBand: '0-75', adjStreet: 5.5, fa: 4.125, sfa: 4.95, fd: 5.775, sfd: 6.6, sfdPlus: 7.15, gen: [0.825, 0.385, 0.1925, 0.12375, 0.06875, 0.0275, 0.01375, 0.01375], total: 8.8 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G 1-2-3', state: 'Non-CA, MT, NY', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 10', state: 'Non-NY', ageBand: '0-75', adjStreet: 5.6, fa: 4.2, sfa: 5.04, fd: 5.88, sfd: 6.72, sfdPlus: 7.28, gen: [0.84, 0.392, 0.196, 0.126, 0.07, 0.028, 0.014, 0.014], total: 8.96 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 10', state: 'Non-NY', ageBand: '81-85', adjStreet: 2.5, fa: 1.875, sfa: 2.25, fd: 2.625, sfd: 3, sfdPlus: 3.25, gen: [0.375, 0.175, 0.0875, 0.05625, 0.03125, 0.0125, 0.00625, 0.00625], total: 4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 7', state: 'Non-NY', ageBand: '0-75', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 7', state: 'Non-NY', ageBand: '76-80', adjStreet: 3.0, fa: 2.25, sfa: 2.7, fd: 3.15, sfd: 3.6, sfdPlus: 3.9, gen: [0.45, 0.21, 0.105, 0.0675, 0.0375, 0.015, 0.0075, 0.0075], total: 4.8 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Power Accumulator 7', state: 'Non-NY', ageBand: '81-85', adjStreet: 2.0, fa: 1.5, sfa: 1.8, fd: 2.1, sfd: 2.4, sfdPlus: 2.6, gen: [0.3, 0.14, 0.07, 0.045, 0.025, 0.01, 0.005, 0.005], total: 3.2 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Safe Income Advantage', state: 'Non-NY', ageBand: '0-75', adjStreet: 5.6, fa: 4.2, sfa: 5.04, fd: 5.88, sfd: 6.72, sfdPlus: 7.28, gen: [0.84, 0.392, 0.196, 0.126, 0.07, 0.028, 0.014, 0.014], total: 8.96 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'F&G Safe Income Advantage', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 10', state: 'Non-NY', ageBand: '0-75', adjStreet: 5.6, fa: 4.2, sfa: 5.04, fd: 5.88, sfd: 6.72, sfdPlus: 7.28, gen: [0.84, 0.392, 0.196, 0.126, 0.07, 0.028, 0.014, 0.014], total: 8.96 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.0, fa: 3, sfa: 3.6, fd: 4.2, sfd: 4.8, sfdPlus: 5.2, gen: [0.6, 0.28, 0.14, 0.09, 0.05, 0.02, 0.01, 0.01], total: 6.4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 10', state: 'Non-NY', ageBand: '81-85', adjStreet: 2.5, fa: 1.875, sfa: 2.25, fd: 2.625, sfd: 3, sfdPlus: 3.25, gen: [0.375, 0.175, 0.0875, 0.05625, 0.03125, 0.0125, 0.00625, 0.00625], total: 4 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 7', state: 'Non-NY', ageBand: '0-75', adjStreet: 4.1, fa: 3.075, sfa: 3.69, fd: 4.305, sfd: 4.92, sfdPlus: 5.33, gen: [0.615, 0.287, 0.1435, 0.09225, 0.05125, 0.0205, 0.01025, 0.01025], total: 6.56 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 7', state: 'Non-NY', ageBand: '76-80', adjStreet: 3.25, fa: 2.4375, sfa: 2.925, fd: 3.4125, sfd: 3.9, sfdPlus: 4.225, gen: [0.4875, 0.2275, 0.11375, 0.073125, 0.040625, 0.01625, 0.008125, 0.008125], total: 5.2 },
  { carrier: 'Fidelity & Guaranty', type: 'FIA', product: 'FG AccumulatorPlus 7', state: 'Non-NY', ageBand: '81-85', adjStreet: 2.5, fa: 1.875, sfa: 2.25, fd: 2.625, sfd: 3, sfdPlus: 3.25, gen: [0.375, 0.175, 0.0875, 0.05625, 0.03125, 0.0125, 0.00625, 0.00625], total: 4 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 15', state: 'Non-NY', ageBand: '0-70', adjStreet: 5.6, fa: 4.2, sfa: 5.04, fd: 5.88, sfd: 6.72, sfdPlus: 7.28, gen: [0.84, 0.392, 0.196, 0.126, 0.07, 0.028, 0.014, 0.014], total: 8.96 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 15', state: 'Non-NY', ageBand: '71-73', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 10', state: 'Non-NY', ageBand: '0-70', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 10', state: 'Non-NY', ageBand: '71-75', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.1, fa: 3.075, sfa: 3.69, fd: 4.305, sfd: 4.92, sfdPlus: 5.33, gen: [0.615, 0.287, 0.1435, 0.09225, 0.05125, 0.0205, 0.01025, 0.01025], total: 6.56 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 7', state: 'Non-NY', ageBand: '0-70', adjStreet: 3.25, fa: 2.4375, sfa: 2.925, fd: 3.4125, sfd: 3.9, sfdPlus: 4.225, gen: [0.4875, 0.2275, 0.11375, 0.073125, 0.040625, 0.01625, 0.008125, 0.008125], total: 5.2 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 7', state: 'Non-NY', ageBand: '71-75', adjStreet: 3.0, fa: 2.25, sfa: 2.7, fd: 3.15, sfd: 3.6, sfdPlus: 3.9, gen: [0.45, 0.21, 0.105, 0.0675, 0.0375, 0.015, 0.0075, 0.0075], total: 4.8 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 7', state: 'Non-NY', ageBand: '76-80', adjStreet: 2.0, fa: 1.5, sfa: 1.8, fd: 2.1, sfd: 2.4, sfdPlus: 2.6, gen: [0.3, 0.14, 0.07, 0.045, 0.025, 0.01, 0.005, 0.005], total: 3.2 },
  { carrier: 'North American', type: 'FIA', product: 'Performance Elite 7', state: 'Non-NY', ageBand: '81+', adjStreet: 2.0, fa: 1.5, sfa: 1.8, fd: 2.1, sfd: 2.4, sfdPlus: 2.6, gen: [0.3, 0.14, 0.07, 0.045, 0.025, 0.01, 0.005, 0.005], total: 3.2 },
  { carrier: 'North American', type: 'FIA', product: 'Aviator 10', state: 'Non-NY', ageBand: '0-70', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Aviator 10', state: 'Non-NY', ageBand: '71-75', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Aviator 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.1, fa: 3.075, sfa: 3.69, fd: 4.305, sfd: 4.92, sfdPlus: 5.33, gen: [0.615, 0.287, 0.1435, 0.09225, 0.05125, 0.0205, 0.01025, 0.01025], total: 6.56 },
  { carrier: 'North American', type: 'FIA', product: 'Agility 10', state: 'Non-NY', ageBand: '0-70', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Agility 10', state: 'Non-NY', ageBand: '71-75', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Agility 10', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.1, fa: 3.075, sfa: 3.69, fd: 4.305, sfd: 4.92, sfdPlus: 5.33, gen: [0.615, 0.287, 0.1435, 0.09225, 0.05125, 0.0205, 0.01025, 0.01025], total: 6.56 },
  { carrier: 'North American', type: 'FIA', product: 'Ascent Pro 10 Bonus', state: 'Non-NY', ageBand: '0-70', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Ascent Pro 10 Bonus', state: 'Non-NY', ageBand: '71-75', adjStreet: 4.5, fa: 3.375, sfa: 4.05, fd: 4.725, sfd: 5.4, sfdPlus: 5.85, gen: [0.675, 0.315, 0.1575, 0.10125, 0.05625, 0.0225, 0.01125, 0.01125], total: 7.2 },
  { carrier: 'North American', type: 'FIA', product: 'Ascent Pro 10 Bonus', state: 'Non-NY', ageBand: '76-80', adjStreet: 4.1, fa: 3.075, sfa: 3.69, fd: 4.305, sfd: 4.92, sfdPlus: 5.33, gen: [0.615, 0.287, 0.1435, 0.09225, 0.05125, 0.0205, 0.01025, 0.01025], total: 6.56 },
];

export const ANNUITY_TITLE_LEVELS = [
  { key: 'fa', title: 'Financial Associate (FA)', pct: '75%' },
  { key: 'sfa', title: 'Senior Financial Associate (SFA)', pct: '90%' },
  { key: 'fd', title: 'Financial Director (FD)', pct: '105%' },
  { key: 'sfd', title: 'Senior Financial Director (SFD)', pct: '120%' },
  { key: 'sfdPlus', title: 'Senior Financial Director+ (SFD+)', pct: '120–130%' },
];

const GEN_LABELS = ['1st (15%)', '2nd (7%)', '3rd (3.5%)', '4th (2.25%)', '5th (1.25%)', '6th (0.5%)', '7th (0.25%)', '8th (0.25%)'];
const GEN_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const RAW_GEN_OVERRIDES = [15, 7, 3.5, 2.25, 1.25, 0.5, 0.25, 0.25];

const COLORS = ['#0C1022', '#E3A94A', '#1a3a6e', '#d4af5a'];

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

export default function AnnuityCalculator() {
  const [carrier, setCarrier] = useState('');
  const [product, setProduct] = useState('');
  const [ageBand, setAgeBand] = useState('');
  const [premiumStr, setPremiumStr] = useState('100000');
  const [selectedLevel, setSelectedLevel] = useState('fa');

  const carriers = useMemo(() => [...new Set(ANNUITY_PRODUCTS.map(p => p.carrier))], []);

  const products = useMemo(() => {
    if (!carrier) return [];
    return [...new Set(ANNUITY_PRODUCTS.filter(p => p.carrier === carrier).map(p => p.product))];
  }, [carrier]);

  const ageBands = useMemo(() => {
    if (!carrier || !product) return [];
    return [...new Set(ANNUITY_PRODUCTS.filter(p => p.carrier === carrier && p.product === product).map(p => p.ageBand))];
  }, [carrier, product]);

  // Auto-select age band when only one option (derived value)
  const effectiveAgeBand = (ageBands.length === 1) ? ageBands[0] : ageBand;

  const selectedProduct = useMemo(() => {
    if (!carrier || !product || !effectiveAgeBand) return null;
    return ANNUITY_PRODUCTS.find(p => p.carrier === carrier && p.product === product && p.ageBand === effectiveAgeBand) || null;
  }, [carrier, product, effectiveAgeBand]);

  const premium = Number(premiumStr) || 0;

  const commissionPct = selectedProduct ? selectedProduct[selectedLevel] : 0;
  const commissionDollar = premium * commissionPct / 100;
  const genOverrideTotal = selectedProduct ? selectedProduct.gen.reduce((s, v) => s + v, 0) : 0;
  const genOverrideDollar = premium * genOverrideTotal / 100;
  const totalToField = selectedProduct ? selectedProduct.total : 0;

  const barData = selectedProduct ? ANNUITY_TITLE_LEVELS.map(lvl => ({
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

  const lineData = selectedProduct ? ANNUITY_TITLE_LEVELS.map(lvl => ({
    name: lvl.key.toUpperCase(),
    'Commission %': selectedProduct[lvl.key],
  })) : [];

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid rgba(227, 169, 74, 0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
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
              Premium Amount ($)
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
              {ANNUITY_TITLE_LEVELS.map(l => <option key={l.key} value={l.key}>{l.title} — {l.pct}</option>)}
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
              Product: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.product}</strong> | State: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.state}</strong> | Adj. Street: <strong style={{ color: 'var(--brand-navy)' }}>{selectedProduct.adjStreet}%</strong>
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
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-gold)', fontWeight: 600 }}>{ANNUITY_TITLE_LEVELS.find(l => l.key === selectedLevel)?.title}</div>
            </Card>
            <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Commission $ Amount</div>
              <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(commissionDollar)}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-gold)', fontWeight: 600 }}>On {fmt(premium)} premium</div>
            </Card>
            <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gen Override Total</div>
              <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(genOverrideDollar)}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--ink-gold)', fontWeight: 600 }}>{genOverrideTotal.toFixed(4)}% across 8 gens</div>
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
                  {ANNUITY_TITLE_LEVELS.map(lvl => {
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
                          {isSelected && <span style={{ color: 'var(--ink-gold)', marginRight: '6px' }}>&#9654;</span>}
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
                      {(130 + RAW_GEN_OVERRIDES.reduce((s, v) => s + v, 0))}%
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 'var(--space-2) 0 0 0', fontStyle: 'italic' }}>
              This is an example only and will be different based on product and company. Factor percentages may vary. Internal use only.
            </p>
          </Card>

          {/* Charts Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {/* Commission by Level Bar Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Commission by Title Level
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value, name) => name.includes('$') ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Bar dataKey="Commission $" fill="#0C1022" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Earnings Breakdown Pie Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Earnings Breakdown — {ANNUITY_TITLE_LEVELS.find(l => l.key === selectedLevel)?.title}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value, x, y, textAnchor }) => (
                      <text x={x} y={y} textAnchor={textAnchor} fill="#333" fontSize={12} fontWeight={600}>
                        {`${name}: ${fmt(value)}`}
                      </text>
                    )}
                    labelLine={{ stroke: '#999', strokeWidth: 1 }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '15px', paddingTop: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {/* Generation Overrides Bar Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Generation Override Income
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={genBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value, name) => name.includes('$') ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Bar dataKey="Override $" fill="#E3A94A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Commission % Growth Line Chart */}
            <Card>
              <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
                Commission % Growth by Level
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => v + '%'} />
                  <Tooltip formatter={(value) => value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
                  <Legend />
                  <Line type="monotone" dataKey="Commission %" stroke="#0C1022" strokeWidth={3} dot={{ r: 5, fill: '#0C1022' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* Disclaimer */}
      <Card style={{ backgroundColor: 'rgba(0, 32, 91, 0.02)', border: '1px solid rgba(0, 32, 91, 0.08)' }}>
        <h4 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-2) 0' }}>
          Carrier Level &mdash; Annuity Comp
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', lineHeight: 1.6, margin: '0 0 var(--space-2) 0' }}>
          Note: All compensation figures are applicable to Non-New York (Non-NY) business only and are for professional use. Compensation may vary for New York business and is subject to the applicable carrier contract, product, state regulations, and underwriting requirements.
        </p>
        <p style={{ color: 'var(--ink-gold)', fontSize: 'var(--text-caption)', lineHeight: 1.6, margin: 0, fontWeight: 600 }}>
          &#9888; Information subject to change based on carrier updates. This grid does not serve as a binding contract &mdash; for Reference Only. Contact your NXT Financial Group Sales Consultant with questions.
        </p>
      </Card>
    </div>
  );
}
