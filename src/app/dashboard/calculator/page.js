"use client";

import React, { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import AnnuityCalculator from './AnnuityCalculator';
import LifeCalculator from './LifeCalculator';

const CALC_TABS = [
  { key: 'general', label: 'General Calculator' },
  { key: 'annuity', label: 'Annuity Commission Calculator' },
  { key: 'life', label: 'Life Commission Calculator' },
];

const NXT_LEVELS = [
  { key: 'fa', title: 'Financial Associate (FA)', level: 0.75, net: 0.675, successBonus: true },
  { key: 'sfa', title: 'Senior Financial Associate (SFA)', level: 0.90, net: 0.81, successBonus: true },
  { key: 'fd', title: 'Financial Director (FD)', level: 1.05, net: 0.945, successBonus: true },
  { key: 'fd2', title: 'Financial Director II (FD II)', level: 1.12, net: 1.008, successBonus: false },
  { key: 'fd3', title: 'Financial Director III (FD III)', level: 1.15, net: 1.035, successBonus: false },
  { key: 'sfd', title: 'Senior Financial Director (SFD)', level: 1.20, net: 1.08, successBonus: false },
  { key: 'sfdPlus', title: 'Senior Financial Director+ (SFD+)', level: 1.30, net: 1.17, successBonus: false },
];

const GENERATIONS = [
  { gen: '1st', bonus: 0.15, net: 0.135 },
  { gen: '2nd', bonus: 0.07, net: 0.063 },
  { gen: '3rd', bonus: 0.035, net: 0.0315 },
  { gen: '4th', bonus: 0.0225, net: 0.02025 },
  { gen: '5th', bonus: 0.0125, net: 0.01125 },
  { gen: '6th', bonus: 0.005, net: 0.0045 },
  { gen: '7th', bonus: 0.0025, net: 0.00225 },
  { gen: '8th', bonus: 0.0025, net: 0.00225 },
];

const OVERRIDE_PER_LEVEL = 810;
const SUCCESS_BONUS_PCT = 0.05;

const COLORS = ['#0C1022', '#E3A94A', '#1a3a6e', '#d4af5a', '#2c5b94', '#e8c97a', '#3d7cbf', '#f0d89a'];

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n) {
  const val = Math.round(n * 10000) / 100;
  return (Math.abs(val - Math.round(val)) < 0.001 ? Math.round(val) : val) + '%';
}

export default function CommissionCalculatorPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [premiumStr, setPremiumStr] = useState('500');
  const [factorStr, setFactorStr] = useState('90');
  const [selectedLevel, setSelectedLevel] = useState('fa');

  const monthlyPremium = Number(premiumStr) || 0;
  const factorPct = Number(factorStr) || 0;
  const points = useMemo(() => monthlyPremium * (factorPct / 100) * 12, [monthlyPremium, factorPct]);

  const results = useMemo(() => {
    const factor = factorPct / 100;
    return NXT_LEVELS.map((lvl) => {
      const totalIncome = points * lvl.level;
      return {
        ...lvl,
        net: factor * lvl.level,
        points,
        totalIncome,
        override: OVERRIDE_PER_LEVEL,
        successBonus: lvl.successBonus ? Math.round(points * SUCCESS_BONUS_PCT) : 0,
      };
    });
  }, [points, factorPct]);

  const selectedData = results.find(r => r.key === selectedLevel);

  const generationData = useMemo(() => {
    const factor = factorPct / 100;
    return GENERATIONS.map(g => {
      return {
        ...g,
        net: factor * g.bonus,
        totalIncome: points * g.bonus,
      };
    });
  }, [points, factorPct]);

  const totalGenerationIncome = generationData.reduce((sum, g) => sum + g.totalIncome, 0);

  const barData = results.map(r => ({
    name: r.key.toUpperCase(),
    'Total Income': Math.round(r.totalIncome),
    'Override': r.override,
    'Success Bonus': r.successBonus,
  }));

  const pieData = selectedData ? [
    { name: 'Commission', value: Math.round(selectedData.totalIncome) },
    { name: 'Override', value: selectedData.override },
    { name: 'Bonus', value: selectedData.successBonus },
  ].filter(d => d.value > 0) : [];

  const genBarData = generationData.map(g => ({
    name: g.gen,
    'Income': Math.round(g.totalIncome),
    'Bonus %': g.bonus * 100,
  }));

  const growthData = results.map(r => ({
    name: r.key.toUpperCase(),
    'Commission %': r.level * 100,
    'Net %': r.net * 100,
  }));

  return (
    <div style={{ paddingBottom: 'var(--space-6)' }}>
      <PageHeader title="Commission Calculator" subtitle="Estimate your earnings based on premium, factor, and agent level." />

      {/* Tab Switcher */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: 'var(--space-4)',
        borderRadius: '12px', overflow: 'hidden',
        border: '1px solid rgba(0, 32, 91, 0.15)',
        backgroundColor: 'rgba(0, 32, 91, 0.03)'
      }}>
        {CALC_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '14px 20px', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-secondary)', fontWeight: 700,
              color: activeTab === tab.key ? '#fff' : 'var(--brand-navy)',
              backgroundColor: activeTab === tab.key ? 'var(--brand-navy)' : 'transparent',
              transition: 'all 0.2s ease',
              borderRight: tab.key !== 'life' ? '1px solid rgba(0, 32, 91, 0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'annuity' && <AnnuityCalculator />}
      {activeTab === 'life' && <LifeCalculator />}

      {/* General Calculator */}
      {activeTab === 'general' && <>
      {/* Input Controls */}
      <Card style={{ marginBottom: 'var(--space-4)', border: '1px solid rgba(227, 169, 74, 0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Monthly Premium ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={premiumStr}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setPremiumStr(v); }}
              onBlur={() => { if (premiumStr === '') setPremiumStr('0'); }}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid var(--border-color)', fontSize: 'var(--text-body)',
                color: 'var(--text-primary)', backgroundColor: 'var(--surface-card)', outline: 'none',
                fontWeight: 600
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Factor %
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={factorStr}
              onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setFactorStr(v); }}
              onBlur={() => { if (factorStr === '') setFactorStr('0'); }}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid var(--border-color)', fontSize: 'var(--text-body)',
                color: 'var(--text-primary)', backgroundColor: 'var(--surface-card)', outline: 'none',
                fontWeight: 600
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--brand-navy)', marginBottom: '6px' }}>
              Your Level
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '10px',
                border: '1px solid var(--border-color)', fontSize: 'var(--text-body)',
                color: 'var(--text-primary)', backgroundColor: 'var(--surface-card)', outline: 'none',
                fontWeight: 600, appearance: 'none', WebkitAppearance: 'none',
                lineHeight: '1.5',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center',
                paddingRight: '40px',
              }}
            >
              {NXT_LEVELS.map(l => (
                <option key={l.key} value={l.key}>{l.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Points display */}
        <div style={{
          marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'rgba(0, 32, 91, 0.04)', borderRadius: '10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
            Annualized Points: <strong style={{ color: 'var(--brand-navy)' }}>{points.toLocaleString()}</strong>
          </span>
          <span style={{ fontSize: 'var(--text-secondary)', color: 'var(--text-secondary)' }}>
            Formula: ${monthlyPremium.toLocaleString()} x {factorPct}% x 12 = <strong style={{ color: 'var(--brand-navy)' }}>{points.toLocaleString()}</strong> points
          </span>
        </div>
      </Card>

      {/* Summary Cards */}
      {selectedData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Direct Commission</div>
            <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(selectedData.totalIncome)}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>Net {fmtPct(selectedData.net)}</div>
          </Card>
          <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Override per Level</div>
            <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(selectedData.override)}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>Per downline level</div>
          </Card>
          <Card style={{ textAlign: 'center', border: '1px solid rgba(227, 169, 74, 0.15)' }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Success Bonus</div>
            <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: selectedData.successBonus ? 'var(--brand-navy)' : 'var(--text-secondary)' }}>
              {selectedData.successBonus ? fmt(selectedData.successBonus) : 'N/A'}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>
              {selectedData.successBonus ? 'Per qualifying sale' : 'RVP+ level'}
            </div>
          </Card>
          <Card style={{ textAlign: 'center', border: '1px solid rgba(0, 32, 91, 0.1)', backgroundColor: 'rgba(0, 32, 91, 0.03)' }}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: '4px' }}>Generation Income</div>
            <div style={{ fontSize: 'var(--text-h1)', fontWeight: 800, color: 'var(--brand-navy)' }}>{fmt(totalGenerationIncome)}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--brand-gold)', fontWeight: 600 }}>8 generations deep</div>
          </Card>
        </div>
      )}

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        {/* Income by Level Bar Chart */}
        <Card>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
            Income by Agent Level
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
              <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => fmt(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
              <Legend />
              <Bar dataKey="Total Income" fill="#0C1022" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Override" fill="#E3A94A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Success Bonus" fill="#2c5b94" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Earnings Breakdown Pie */}
        <Card>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
            Your Earnings Breakdown — {NXT_LEVELS.find(l => l.key === selectedLevel)?.title}
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
        {/* Generation Overrides Bar */}
        <Card>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
            Generation Override Income
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={genBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
              <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value, name) => name === 'Income' ? fmt(value) : value + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
              <Bar dataKey="Income" fill="#E3A94A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Commission Growth Line */}
        <Card>
          <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
            Commission % Growth by Level
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#666' }} />
              <YAxis tick={{ fontSize: 14, fill: '#666' }} tickFormatter={(v) => v + '%'} />
              <Tooltip formatter={(value) => value.toFixed(1) + '%'} contentStyle={{ borderRadius: '8px', border: '1px solid #eee' }} />
              <Legend />
              <Line type="monotone" dataKey="Commission %" stroke="#0C1022" strokeWidth={3} dot={{ r: 5, fill: '#0C1022' }} />
              <Line type="monotone" dataKey="Net %" stroke="#E3A94A" strokeWidth={3} dot={{ r: 5, fill: '#E3A94A' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Full Commission Table */}
      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
          Full Commission Schedule
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-secondary)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--brand-gold)' }}>
                <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Level</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Points</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Commission %</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Net %</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Total Income</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Override</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Success Bonus</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.key}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    backgroundColor: r.key === selectedLevel ? 'rgba(227, 169, 74, 0.08)' : 'transparent',
                    fontWeight: r.key === selectedLevel ? 600 : 400
                  }}
                >
                  <td style={{ padding: '10px 12px', color: r.key === selectedLevel ? 'var(--brand-navy)' : 'var(--text-primary)' }}>
                    {r.key === selectedLevel && <span style={{ color: 'var(--brand-gold)', marginRight: '6px' }}>&#9654;</span>}
                    {r.title}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.points.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtPct(r.level)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtPct(r.net)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>{fmt(r.totalIncome)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmt(r.override)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.successBonus ? fmt(r.successBonus) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Generation Table */}
      <Card>
        <h3 style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 var(--space-3) 0' }}>
          Generation Overrides
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-secondary)' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--brand-gold)' }}>
                <th scope="col" style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Generation</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Points</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Override %</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Net Override %</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>Total Income</th>
              </tr>
            </thead>
            <tbody>
              {generationData.map((g) => (
                <tr key={g.gen} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{g.gen}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{points.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtPct(g.bonus)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--text-secondary)' }}>{fmtPct(g.net)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--brand-navy)', fontWeight: 700 }}>{fmt(g.totalIncome)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--brand-navy)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>Total</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}></td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>{fmtPct(generationData.reduce((s, g) => s + g.bonus, 0))}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 700, color: 'var(--brand-navy)' }}>{fmtPct(generationData.reduce((s, g) => s + g.net, 0))}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                  {fmt(totalGenerationIncome)}
                </td>
              </tr>
              {(() => {
                const maxLevel = NXT_LEVELS[NXT_LEVELS.length - 1];
                const maxData = results.find(r => r.key === maxLevel.key);
                return maxData ? (
                <tr style={{ borderTop: '2px solid var(--brand-gold)', background: 'rgba(0,32,91,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>Total to Field</td>
                  <td style={{ textAlign: 'right', padding: '10px 12px' }}></td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                    {fmtPct(maxData.level + generationData.reduce((s, g) => s + g.bonus, 0))}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                    {fmtPct(maxData.net + generationData.reduce((s, g) => s + g.net, 0))}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--brand-navy)', fontSize: 'var(--text-body)' }}>
                    {fmt(maxData.totalIncome + totalGenerationIncome)}
                  </td>
                </tr>
                ) : null;
              })()}
            </tfoot>
          </table>
        </div>
      </Card>


      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-caption)', marginTop: 'var(--space-4)' }}>
        This is an example only and will be different based on the product and company. Factor percentages may vary. Internal use only.
      </p>
      </>}
    </div>
  );
}
