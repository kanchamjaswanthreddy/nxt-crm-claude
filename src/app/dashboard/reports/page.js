"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchReportData } from '@/app/actions/reports';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

const CHART_COLORS = ['#E3A94A', '#1B2B4B', '#1B2A4E', '#2FA84F', '#E08E2B'];

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_12', label: 'Last 12 Months' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

function formatCurrency(value) {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function formatDollar(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

function CustomTooltipProduction({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--brand-navy)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
        Revenue: ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

function CustomTooltipAgent({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--brand-navy)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
        Production: ${payload[0].value.toLocaleString()}
      </p>
    </div>
  );
}

function CustomTooltipPie({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={tooltipStyle}>
      <p style={{ margin: 0, fontWeight: 600, color: 'var(--brand-navy)' }}>{payload[0].name}</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
        {payload[0].value}% of policies
      </p>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '200px', color: 'var(--text-secondary)', fontSize: '14px',
      border: '1px dashed var(--border-color)', borderRadius: '8px',
    }}>
      {message}
    </div>
  );
}

function SkeletonBlock({ height = 200 }) {
  return (
    <div style={{
      height: `${height}px`, borderRadius: '10px',
      background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 25%, rgba(0,0,0,0.07) 50%, rgba(0,0,0,0.04) 75%)',
      backgroundSize: '400% 100%',
      animation: 'shimmer 1.5s ease infinite',
    }} />
  );
}

const tooltipStyle = {
  background: 'white',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '10px 14px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  fontSize: '13px',
};

const selectStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-color)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 200ms ease',
};

export default function ReportsHub() {
  const { userProfile } = useUser();
  const [period, setPeriod] = useState('all_time');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Export + custom range state
  const [reportType, setReportType] = useState('production');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const loadData = useCallback(async () => {
    if (!userProfile?.uid) return;
    if (period === 'custom' && (!customStart || !customEnd)) return;
    setLoading(true);
    try {
      const customRange = period === 'custom' ? { start: customStart, end: customEnd } : undefined;
      const res = await fetchReportData(period, customRange);
      if (res.success) setData(res);
    } catch (err) {
      // silenced
    } finally {
      setLoading(false);
    }
  }, [userProfile, period, customStart, customEnd]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    if (!userProfile) return;

    const params = new URLSearchParams({ period });
    if (startDate) params.append('start', new Date(startDate).toISOString());
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      params.append('end', e.toISOString());
    }

    // Session cookie is sent automatically — no token in URL needed
    window.open(`/api/reports/export?${params.toString()}`, '_blank');
  };

  if (!userProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <LoadingSpinner label="Loading reports..." />
      </div>
    );
  }

  const monthlyProduction = data?.monthlyProduction || [];
  const policyDistribution = data?.policyDistribution || [];
  const agentPerformance = data?.agentPerformance || [];
  const leadFunnel = data?.leadFunnel || [];

  const kpiCards = [
    { label: 'Total Revenue', value: formatDollar(data?.kpis?.totalRevenue || 0), sub: `${data?.kpis?.totalDeals || 0} deals won` },
    { label: 'Deals Closed', value: String(data?.kpis?.totalDeals || 0), sub: `From ${data?.kpis?.totalLeads || 0} leads` },
    { label: 'Conversion Rate', value: `${data?.kpis?.conversionRate || 0}%`, sub: 'Lead to close' },
    { label: 'Avg Deal Size', value: formatDollar(data?.kpis?.avgDealSize || 0), sub: `$${(data?.kpis?.totalCommissions || 0).toLocaleString()} in commissions` },
  ];

  const hasMonthly = monthlyProduction.length > 0;
  const hasPolicyMix = policyDistribution.length > 0;
  const hasAgentPerf = agentPerformance.length > 0;
  const hasFunnel = leadFunnel.some(s => s.count > 0);

  return (
    <div style={{ padding: '0 20px' }}>

      {/* Header + Period Selector */}
      <PageHeader
        title="Reports & Analytics"
        subtitle="Performance overview, policy distribution, and team production at a glance."
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                fontSize: '14px', backgroundColor: '#fff', fontWeight: 500, cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {period === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                    fontSize: '13px', backgroundColor: '#fff', color: 'var(--text-primary)',
                  }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                    fontSize: '13px', backgroundColor: '#fff', color: 'var(--text-primary)',
                  }}
                />
              </>
            )}
            <button
              onClick={loadData}
              disabled={loading || (period === 'custom' && (!customStart || !customEnd))}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                backgroundColor: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                color: 'var(--text-primary)', opacity: loading ? 0.5 : 1,
              }}
            >
              {period === 'custom' ? 'Apply' : 'Refresh'}
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><div style={{ padding: '4px 0' }}><SkeletonBlock height={80} /></div></Card>
        )) : kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <div style={{ padding: '4px 0' }}>
              <p style={{
                margin: 0,
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
              }}>
                {kpi.label}
              </p>
              <p style={{
                margin: '8px 0 4px',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--brand-navy)',
                lineHeight: 1,
              }}>
                {kpi.value}
              </p>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                {kpi.sub}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 1: Area chart + Pie chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: '16px',
        marginBottom: '28px',
      }}>
        {/* Monthly Production Trend */}
        <Card>
          <div style={{ padding: '4px 0' }}>
            <h2 style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--brand-navy)',
            }}>
              Monthly Production
            </h2>
            <p style={{
              margin: '0 0 20px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              Revenue trend for the selected period
            </p>
            {loading ? <SkeletonBlock height={260} /> : !hasMonthly ? (
              <EmptyChart message="No won deals in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyProduction} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradientRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E3A94A" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E3A94A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCurrency}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip content={<CustomTooltipProduction />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#E3A94A"
                    strokeWidth={2.5}
                    fill="url(#gradientRevenue)"
                    dot={{ r: 4, fill: '#E3A94A', strokeWidth: 2, stroke: 'white' }}
                    activeDot={{ r: 6, fill: '#E3A94A', strokeWidth: 2, stroke: 'white' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Policy Type Distribution */}
        <Card>
          <div style={{ padding: '4px 0' }}>
            <h2 style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--brand-navy)',
            }}>
              Policy Mix
            </h2>
            <p style={{
              margin: '0 0 12px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>
              Distribution by policy type
            </p>
            {loading ? <SkeletonBlock height={200} /> : !hasPolicyMix ? (
              <EmptyChart message="No deals in this period" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={policyDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {policyDistribution.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipPie />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  marginTop: '4px',
                }}>
                  {policyDistribution.map((entry, index) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '3px',
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                        display: 'inline-block',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {entry.name} {entry.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Agent Performance bar chart full width */}
      <Card style={{ marginBottom: '28px' }}>
        <div style={{ padding: '4px 0' }}>
          <h2 style={{
            margin: '0 0 4px',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--brand-navy)',
          }}>
            Agent Performance
          </h2>
          <p style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            Total production by agent for the selected period
          </p>
          {loading ? <SkeletonBlock height={280} /> : !hasAgentPerf ? (
            <EmptyChart message="No agent production data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agentPerformance} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 13 }}
                  axisLine={{ stroke: 'var(--border-color)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCurrency}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<CustomTooltipAgent />} />
                <Bar dataKey="production" radius={[6, 6, 0, 0]}>
                  {agentPerformance.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Lead Conversion Funnel */}
      <Card style={{ marginBottom: '28px' }}>
        <div style={{ padding: '4px 0' }}>
          <h2 style={{
            margin: '0 0 4px',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--brand-navy)',
          }}>
            Lead Conversion Funnel
          </h2>
          <p style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            Pipeline progression from lead to close
          </p>
          {loading ? <SkeletonBlock height={200} /> : !hasFunnel ? (
            <EmptyChart message="No leads in this period" />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              justifyContent: 'center',
              padding: '0 20px',
            }}>
              {leadFunnel.map((step, index) => {
                const maxCount = leadFunnel[0]?.count || 1;
                const heightPct = (step.count / maxCount) * 100;
                return (
                  <div key={step.stage} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                  }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: 'var(--brand-navy)',
                      marginBottom: '8px',
                    }}>
                      {step.count}
                    </span>
                    <div style={{
                      width: '100%',
                      maxWidth: '80px',
                      height: `${Math.max(heightPct * 1.6, 24)}px`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      borderRadius: '6px 6px 0 0',
                      transition: 'height 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }} />
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginTop: '8px',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}>
                      {step.stage}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* CSV Export Section */}
      <Card style={{ marginBottom: '40px' }}>
        <div style={{ padding: '4px 0' }}>
          <h2 style={{
            margin: '0 0 4px',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--brand-navy)',
          }}>
            Export Report
          </h2>
          <p style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
          }}>
            Generate and download a CSV of your production data.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--brand-navy)',
                }}>
                  Start Date (Optional)
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--brand-navy)',
                }}>
                  End Date (Optional)
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <Button onClick={handleExport} style={{ width: '100%' }}>
                Export Deals to CSV
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
