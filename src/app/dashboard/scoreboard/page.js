"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchScoreboard, fetchAgentsForScoreboard } from '@/app/actions/scoreboard';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const dn = (a) => [a?.first_name, a?.middle_name, a?.last_name].filter(Boolean).join(' ') || a?.full_name || a?.name || a?.email || '';

function SimpleBarChart({ data, colors }) {
  const maxVal = Math.max(...data.map(d => d.premium), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: 220, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: '#5F5C56', fontWeight: 600 }}>
            ${d.premium >= 1000 ? Math.round(d.premium / 1000) + 'k' : d.premium}
          </span>
          <div style={{
            width: '100%', maxWidth: '48px',
            height: `${Math.max((d.premium / maxVal) * 180, 4)}px`,
            backgroundColor: colors[i % colors.length],
            borderRadius: '6px 6px 0 0',
            transition: 'height 0.3s ease',
          }} />
          <span style={{ fontSize: '11px', color: '#5F5C56', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
            {d.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function SimplePieChart({ data, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: colors[i % colors.length], flexShrink: 0,
          }} />
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{d.name}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-navy)' }}>{d.value} deals</span>
          <span style={{ fontSize: '12px', color: '#5F5C56', minWidth: '40px', textAlign: 'right' }}>
            {Math.round((d.value / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all_time', label: 'All Time' },
];

const RANK_BY_OPTIONS = [
  { value: 'dealsWonPremiumTotal', label: 'Premium Production' },
  { value: 'dealsWonCount', label: 'Deals Won' },
  { value: 'commissionPaid', label: 'Commissions Earned' },
  { value: 'leadsConvertedCount', label: 'Leads Converted' },
];

const PODIUM_COLORS = ['#E3A94A', '#A9ACB1', '#CD7F32'];
const PODIUM_LABELS = ['1st', '2nd', '3rd'];
const CHART_COLORS = ['#E3A94A', '#1B2B4B', '#1B2A4E', '#2FA84F', '#E08E2B'];

export default function ScoreboardPage() {
  const { userProfile } = useUser();
  const [scoreboard, setScoreboard] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [period, setPeriod] = useState('this_month');
  const [rankBy, setRankBy] = useState('dealsWonPremiumTotal');
  const [viewMode, setViewMode] = useState('individual'); // 'individual' | 'team'
  const [agentsList, setAgentsList] = useState([]);


  useEffect(() => {
    if (!userProfile) return;
    fetchAgentsForScoreboard().then(res => {
      if (res.success) setAgentsList(res.agents);
    }).catch(() => {});
  }, [userProfile]);

  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;
    setDataLoaded(false); // eslint-disable-line react-hooks/set-state-in-effect

    fetchScoreboard(period).then(res => {
      if (cancelled) return;
      if (res.success) setScoreboard(res.scoreboard);
      setDataLoaded(true);
    }).catch(() => {
      if (!cancelled) setDataLoaded(true);
    });

    return () => { cancelled = true; };
  }, [userProfile, period]);

  const sorted = [...scoreboard].sort((a, b) => (b[rankBy] || 0) - (a[rankBy] || 0));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const myRank = sorted.findIndex(s => s.agentId === userProfile?.uid) + 1;

  const totalPremium = sorted.reduce((sum, a) => sum + (a.dealsWonPremiumTotal || 0), 0);
  const totalDeals = sorted.reduce((sum, a) => sum + (a.dealsWonCount || 0), 0);
  const avgPremium = totalDeals > 0 ? Math.round(totalPremium / totalDeals) : 0;
  const topAgentName = sorted[0]?.agentName || '--';

  const formatValue = (val, metric) => {
    if (metric === 'dealsWonPremiumTotal' || metric === 'commissionPaid') {
      return '$' + (val || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return (val || 0).toLocaleString();
  };

  const metricLabel = RANK_BY_OPTIONS.find(o => o.value === rankBy)?.label || '';

  const barData = sorted.map(a => ({
    name: a.agentName?.split(' ')[0] || 'Agent',
    premium: a.dealsWonPremiumTotal || 0,
  }));

  const pieData = sorted.map(a => ({
    name: a.agentName || 'Agent',
    value: a.dealsWonCount || 0,
  }));

  if (!userProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Production', value: '$' + totalPremium.toLocaleString(), accent: 'var(--brand-gold)' },
    { label: 'Total Deals', value: totalDeals.toLocaleString(), accent: 'var(--brand-blue-accent)' },
    { label: 'Avg Premium', value: '$' + avgPremium.toLocaleString(), accent: 'var(--status-success)' },
    { label: 'Top Agent', value: topAgentName, accent: 'var(--brand-navy)' },
  ];

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Scoreboard"
        subtitle="Track performance across your team"
        actions={
          <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', alignItems: 'center' }}>
            {(userProfile?.role === 'admin' || userProfile?.role === 'it_engineer') && (
              <div style={{
                display: 'flex', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden',
              }}>
                {['individual', 'team'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '8px 14px', border: 'none',
                      backgroundColor: viewMode === mode ? 'var(--brand-navy)' : '#fff',
                      color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                      fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
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
            <select
              value={rankBy}
              onChange={(e) => setRankBy(e.target.value)}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                fontSize: '14px', backgroundColor: '#fff', fontWeight: 500, cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              {RANK_BY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        }
      />

      {/* Loading Banner */}
      {!dataLoaded && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading data..." />
        </div>
      )}

      {/* Empty State */}
      {dataLoaded && scoreboard.length === 0 && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <EmptyState variant="minimal" title="No scoreboard data yet. Metrics will appear as deals are created and commissions are tracked." />
        </div>
      )}

      {/* Your Rank Banner */}
      {myRank > 0 && (
        <div style={{
          backgroundColor: 'rgba(227, 169, 74,0.08)', border: '1px solid rgba(227, 169, 74,0.25)',
          borderRadius: '12px', padding: '14px var(--space-3)',
          marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <span style={{
            fontSize: '26px', fontWeight: 800, color: 'var(--brand-gold)',
            lineHeight: 1,
          }}>#{myRank}</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '15px' }}>Your current rank</span>
          <span style={{
            marginLeft: 'auto', color: 'var(--brand-navy)', fontWeight: 700, fontSize: '17px',
          }}>{formatValue(sorted[myRank - 1]?.[rankBy], rankBy)}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-2)', marginBottom: 'var(--space-4)',
      }}>
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <div style={{ padding: '20px' }}>
              <div style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px',
              }}>{card.label}</div>
              <div style={{
                fontSize: card.label === 'Top Agent' ? '18px' : '26px',
                fontWeight: 800, color: card.accent, lineHeight: 1.2,
              }}>{card.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      {sorted.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-3)', marginBottom: 'var(--space-4)',
        }}>
          <Card>
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)' }}>Premium by Agent</h3>
              <SimpleBarChart data={barData} colors={CHART_COLORS} />
            </div>
          </Card>
          <Card>
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)' }}>Deals Distribution</h3>
              <SimplePieChart data={pieData} colors={CHART_COLORS} />
            </div>
          </Card>
        </div>
      )}

      {/* Podium */}
      {top3.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)', flexWrap: 'wrap',
        }}>
          {top3.map((agent, i) => {
            const isMe = agent.agentId === userProfile?.uid;
            const podiumHeights = [160, 130, 110];
            return (
              <div key={agent.agentId} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '10px', minWidth: '180px', flex: '1', maxWidth: '240px',
              }}>
                <Card>
                  <div style={{
                    padding: 'var(--space-3)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '8px', minHeight: podiumHeights[i],
                    justifyContent: 'center', position: 'relative',
                    borderTop: `3px solid ${PODIUM_COLORS[i]}`,
                    background: isMe
                      ? 'linear-gradient(180deg, rgba(227, 169, 74,0.06) 0%, transparent 100%)'
                      : 'transparent',
                  }}>
                    {isMe && (
                      <span style={{
                        position: 'absolute', top: '8px', right: '8px',
                        fontSize: '10px', fontWeight: 600, color: 'var(--brand-gold)',
                        backgroundColor: 'rgba(227, 169, 74,0.1)', padding: '2px 8px',
                        borderRadius: '4px',
                      }}>YOU</span>
                    )}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '50%',
                      backgroundColor: PODIUM_COLORS[i], color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '15px',
                      boxShadow: i === 0 ? '0 4px 14px rgba(227, 169, 74,0.35)' : 'none',
                    }}>
                      {PODIUM_LABELS[i]}
                    </div>
                    <div style={{
                      fontWeight: 700, color: 'var(--brand-navy)',
                      textAlign: 'center', fontSize: '15px', lineHeight: 1.3,
                    }}>
                      {agent.agentName}
                    </div>
                    <div style={{
                      fontSize: '24px', fontWeight: 800, color: PODIUM_COLORS[i], lineHeight: 1,
                    }}>
                      {formatValue(agent[rankBy], rankBy)}
                    </div>
                    <div style={{
                      fontSize: '11px', color: 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600,
                    }}>{metricLabel}</div>
                    <div style={{
                      fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px',
                    }}>
                      {agent.dealsWonCount || 0} deals | ${((agent.commissionPaid || 0) / 1000).toFixed(1)}k comm.
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Team View */}
      {viewMode === 'team' && agentsList.length > 0 && (() => {
        const managers = agentsList.filter(a => a.role === 'admin' || a.role === 'it_engineer');
        const teamGroups = managers.map(mgr => {
          const members = agentsList.filter(a => a.upline_id === mgr.id);
          const memberMetrics = members.map(m => {
            const s = scoreboard.find(sb => sb.agentId === m.id) || {};
            return { ...m, metrics: s };
          });
          const totals = memberMetrics.reduce((acc, m) => ({
            premium: acc.premium + (m.metrics.dealsWonPremiumTotal || 0),
            deals: acc.deals + (m.metrics.dealsWonCount || 0),
            commission: acc.commission + (m.metrics.commissionPaid || 0),
          }), { premium: 0, deals: 0, commission: 0 });
          return { manager: mgr, members: memberMetrics, totals };
        }).filter(g => g.members.length > 0).sort((a, b) => b.totals.premium - a.totals.premium);

        return (
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--brand-navy)' }}>Team Performance</h3>
            {teamGroups.map(({ manager: mgr, members, totals }) => (
              <Card key={mgr.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--brand-navy)', fontSize: '15px' }}>
                      {dn(mgr)}
                      <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        ({mgr.is_owner ? 'Owner' : mgr.role}) · {members.length} member{members.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: '13px' }}>
                    <span>Premium: <strong style={{ color: 'var(--brand-gold)' }}>${totals.premium.toLocaleString()}</strong></span>
                    <span>Deals: <strong style={{ color: 'var(--brand-navy)' }}>{totals.deals}</strong></span>
                    <span>Commission: <strong style={{ color: 'var(--status-success)' }}>${totals.commission.toLocaleString()}</strong></span>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th scope="col" style={{ ...thStyle, textAlign: 'left' }}>Agent</th>
                      <th scope="col" style={thStyle}>Deals</th>
                      <th scope="col" style={thStyle}>Premium</th>
                      <th scope="col" style={thStyle}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.sort((a, b) => (b.metrics.dealsWonPremiumTotal || 0) - (a.metrics.dealsWonPremiumTotal || 0)).map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500 }}>{dn(m)}</td>
                        <td style={tdStyle}>{m.metrics.dealsWonCount || 0}</td>
                        <td style={tdStyle}>${(m.metrics.dealsWonPremiumTotal || 0).toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--brand-navy)' }}>${(m.metrics.commissionPaid || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
            {teamGroups.length === 0 && (
              <Card style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No team assignments found. Assign agents to managers to see team performance.
              </Card>
            )}
          </div>
        );
      })()}

      {/* Full Ranking Table */}
      {rest.length > 0 && (
        <Card>
          <div style={{ padding: '20px 0 0' }}>
            <h3 style={{
              margin: '0 0 16px', padding: '0 20px', fontSize: '15px',
              fontWeight: 700, color: 'var(--brand-navy)',
            }}>Full Rankings</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th scope="col" style={thStyle}>RANK</th>
                    <th scope="col" style={{ ...thStyle, textAlign: 'left' }}>AGENT</th>
                    <th scope="col" style={thStyle}>DEALS</th>
                    <th scope="col" style={thStyle}>PREMIUM</th>
                    <th scope="col" style={thStyle}>COMMISSION</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((agent, i) => {
                    const rank = i + 4;
                    const isMe = agent.agentId === userProfile?.uid;
                    return (
                      <tr key={agent.agentId} style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isMe ? 'rgba(227, 169, 74,0.05)' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}>
                        <td style={{
                          ...tdStyle, fontWeight: 700, color: 'var(--text-secondary)',
                          textAlign: 'center', width: '60px',
                        }}>#{rank}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                          <span style={{ fontWeight: isMe ? 700 : 500, color: 'var(--text-primary)' }}>
                            {agent.agentName}
                          </span>
                          {isMe && (
                            <span style={{
                              color: 'var(--brand-gold)', fontSize: '11px', fontWeight: 600,
                              marginLeft: '6px',
                            }}>(You)</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>{agent.dealsWonCount || 0}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>
                          {formatValue(agent.dealsWonPremiumTotal, 'dealsWonPremiumTotal')}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--brand-navy)' }}>
                          {formatValue(agent.commissionPaid, 'commissionPaid')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

const thStyle = {
  padding: '10px 16px',
  textAlign: 'right',
  fontSize: '11px',
  color: '#5F5C56',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tdStyle = {
  padding: '12px 16px',
  textAlign: 'right',
  fontSize: '14px',
};
