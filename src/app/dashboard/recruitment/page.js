"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchRecruitmentLeaderboard } from '@/app/actions/leaderboard';
import { getOrCreateReferralCode } from '@/app/actions/agents';
import Avatar from '@/components/Avatar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

import SegTabs from '@/components/ui/SegTabs';
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_DOT = { active: '#2FA84F', invited: '#E3A94A', pending_approval: '#E3A94A', pending_licensing: '#E3A94A' };

// ── Podium Card ─────────────────────────────────────────────────────────────

function PodiumCard({ recruiter, rank, total }) {
  const isChamp = rank === 1;
  const isSecond = rank === 2;

  const avatarSize = isChamp ? 96 : 64;
  const ringSize = avatarSize + 12;

  const accentColor = isChamp ? '#E3A94A' : isSecond ? '#8C939A' : '#A0612B';
  const accentLight = isChamp ? 'rgba(227, 169, 74,0.12)' : isSecond ? 'rgba(140,147,154,0.1)' : 'rgba(160,97,43,0.1)';

  const pct = total > 0 ? Math.round((recruiter.recruitCount / total) * 100) : 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      flex: isChamp ? '0 0 260px' : '0 0 200px',
      maxWidth: isChamp ? '260px' : '200px',
      zIndex: isChamp ? 2 : 1,
    }}>
      {/* Floating card */}
      <div style={{
        width: '100%',
        background: isChamp
          ? 'linear-gradient(165deg, #0B1D3A 0%, #132D54 50%, #0C1022 100%)'
          : '#FFFFFF',
        borderRadius: isChamp ? '28px' : '20px',
        padding: isChamp ? '0 24px 28px' : '0 16px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'visible',
        boxShadow: isChamp
          ? '0 24px 80px rgba(11,29,58,0.35), 0 0 0 1px rgba(227, 169, 74,0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 8px 32px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        transform: isChamp ? 'translateY(-16px)' : 'none',
      }}>
        {/* Decorative glow */}
        {isChamp && (
          <>
            <div style={{
              position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
              width: '200px', height: '120px',
              background: 'radial-gradient(ellipse, rgba(227, 169, 74,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)',
              width: '160px', height: '80px',
              background: 'radial-gradient(ellipse, rgba(227, 169, 74,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
          </>
        )}

        {/* Rank medallion — sits on top edge */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          marginTop: isChamp ? '-22px' : '-18px',
          marginBottom: isChamp ? '16px' : '12px',
          position: 'relative', zIndex: 3,
        }}>
          <div style={{
            width: isChamp ? '44px' : '36px',
            height: isChamp ? '44px' : '36px',
            borderRadius: '50%',
            background: isChamp
              ? 'conic-gradient(from 0deg, #FFD700, #F0C040, #DAA520, #F0C040, #FFD700)'
              : isSecond
                ? 'conic-gradient(from 0deg, #D1D5DB, #5F5C56, #B0B5BC, #5F5C56, #D1D5DB)'
                : 'conic-gradient(from 0deg, #CD7F32, #D4943C, #A0612B, #D4943C, #CD7F32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isChamp
              ? '0 4px 16px rgba(227, 169, 74,0.5), 0 0 0 3px rgba(227, 169, 74,0.15)'
              : '0 2px 8px rgba(0,0,0,0.12)',
          }}>
            <span style={{
              fontSize: isChamp ? '18px' : '15px',
              fontWeight: '900',
              color: isChamp ? '#5C4200' : '#fff',
              textShadow: isChamp ? '0 1px 0 rgba(255,255,255,0.3)' : 'none',
            }}>
              {rank}
            </span>
          </div>
        </div>

        {/* Avatar with animated-feel ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px', position: 'relative' }}>
          {/* Outer glow ring */}
          {isChamp && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${ringSize + 16}px`, height: `${ringSize + 16}px`,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, transparent, rgba(227, 169, 74,0.15), transparent, rgba(227, 169, 74,0.1), transparent)',
              animation: 'spin 6s linear infinite',
            }} />
          )}
          <div style={{
            width: `${ringSize}px`, height: `${ringSize}px`,
            borderRadius: '50%',
            padding: '3px',
            background: isChamp
              ? 'conic-gradient(from 0deg, #FFD700, #DAA520, #E3A94A, #DAA520, #FFD700)'
              : `linear-gradient(135deg, ${accentColor}, ${accentColor}77)`,
            boxShadow: isChamp
              ? '0 0 24px rgba(227, 169, 74,0.3)'
              : `0 0 12px ${accentColor}22`,
            position: 'relative', zIndex: 1,
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: isChamp ? '#0F2240' : '#fff',
              padding: '3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Avatar name={recruiter.name} photoUrl={recruiter.photoUrl} size={avatarSize} />
            </div>
          </div>
        </div>

        {/* Name + ID */}
        <p style={{
          fontSize: isChamp ? '20px' : '14px', fontWeight: '700',
          color: isChamp ? '#fff' : '#0C1022',
          margin: '0 0 2px 0',
          lineHeight: 1.3,
          letterSpacing: isChamp ? '-0.3px' : '0',
          wordBreak: 'break-word',
        }}>
          {recruiter.name}
        </p>
        {recruiter.nxtId && (
          <p style={{
            fontSize: '13px', margin: '0 0 16px 0', fontWeight: '500',
            color: isChamp ? 'rgba(255,255,255,0.4)' : '#5F5C56',
            letterSpacing: '0.5px',
          }}>
            {recruiter.nxtId}
          </p>
        )}

        {/* Recruit count — big number */}
        <div style={{ marginBottom: '8px' }}>
          <span style={{
            fontSize: isChamp ? '44px' : '30px',
            fontWeight: '900',
            color: isChamp ? '#E3A94A' : '#0C1022',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}>
            {recruiter.recruitCount}
          </span>
        </div>
        <p style={{
          fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0',
          color: isChamp ? 'rgba(255,255,255,0.4)' : '#5F5C56',
          textTransform: 'uppercase', letterSpacing: '1.5px',
        }}>
          Recruits
        </p>

        {/* Progress bar — share of total */}
        <div style={{
          width: '80%', margin: '0 auto 10px',
          height: '4px', borderRadius: '2px',
          background: isChamp ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            width: `${Math.max(pct, 5)}%`,
            background: isChamp
              ? 'linear-gradient(90deg, #E3A94A, #FFD700)'
              : `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
            transition: 'width 600ms ease',
          }} />
        </div>

        {/* Active count */}
        {recruiter.activeRecruits !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#2FA84F',
              boxShadow: '0 0 6px rgba(47,168,79,0.4)',
            }} />
            <span style={{
              fontSize: '14px', fontWeight: '600',
              color: isChamp ? '#4ADE80' : 'var(--status-success)',
            }}>
              {recruiter.activeRecruits} active
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RecruitmentLeaderboardPage() {
  const { userProfile } = useUser();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('allTime');
  const [expandedId, setExpandedId] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!userProfile?.uid) return;
    setIsLoading(true);
    const [res, refRes] = await Promise.all([
      fetchRecruitmentLeaderboard(userProfile.uid),
      getOrCreateReferralCode(userProfile.uid),
    ]);
    if (res.success) setData(res);
    if (refRes.success) setReferralCode(refRes.referralCode);
    setIsLoading(false);
  }, [userProfile]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteLink = referralCode ? `${BASE_URL}/join?ref=${referralCode}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent('Join NXT Financial Group');
    const body = encodeURIComponent(`Hey! I'd like to invite you to join NXT Financial Group. Use my personal link to get started:\n\n${inviteLink}\n\nLooking forward to having you on the team!`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const list = tab === 'allTime' ? (data?.leaderboard || []) : (data?.monthlyLeaderboard || []);
  const top3 = list.slice(0, 3);
  const rest = list.slice(3);
  const totalRecruits = list.reduce((s, r) => s + r.recruitCount, 0);

  return (
    <div>
      {/* ── Hero Section ── */}
      <div style={{
        background: 'linear-gradient(160deg, #0B1D3A 0%, #132D54 40%, #1B2A4E 70%, #0C1022 100%)',
        borderRadius: '24px',
        padding: '40px 32px 48px',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(227, 169, 74,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20px', left: '60px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(227, 169, 74,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '20px', left: '-20px', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(47,168,79,0.05)', pointerEvents: 'none' }} />

        {/* Trophy icon */}
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'rgba(227, 169, 74,0.1)', border: '1px solid rgba(227, 169, 74,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M6 2h12v6a6 6 0 01-12 0V2z" stroke="#E3A94A" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M6 4H4a2 2 0 00-2 2v1a4 4 0 004 4" stroke="#E3A94A" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M18 4h2a2 2 0 012 2v1a4 4 0 01-4 4" stroke="#E3A94A" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9 14v2a3 3 0 003 3v0a3 3 0 003-3v-2" stroke="#E3A94A" strokeWidth="1.5"/>
            <rect x="7" y="19" width="10" height="2" rx="1" stroke="#E3A94A" strokeWidth="1.5"/>
          </svg>
        </div>

        <h1 data-plain style={{
          fontSize: '32px', fontWeight: '800', color: '#fff',
          margin: '0 0 8px 0', letterSpacing: '-0.5px', lineHeight: 1.2,
        }}>
          Recruitment Leaderboard
        </h1>
        <p style={{
          fontSize: '17px', color: 'rgba(255,255,255,0.5)', margin: 0,
          lineHeight: 1.6, maxWidth: '480px',
        }}>
          See who&apos;s building the strongest teams. Every recruit counts — keep climbing the ranks.
        </p>

        {/* Quick stats row */}
        {data && (
          <div style={{
            display: 'flex', gap: '32px', marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[
              { value: data.totalAgents || 0, label: 'Total Team', color: '#E3A94A' },
              { value: list.length, label: 'Recruiters', color: '#fff' },
              { value: totalRecruits, label: tab === 'thisMonth' ? 'This Month' : 'Total Recruits', color: '#4ADE80' },
            ].map((stat, i) => (
              <div key={i}>
                <p style={{ fontSize: '26px', fontWeight: '800', color: stat.color, margin: 0, lineHeight: 1 }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '600' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Your Invite Link ── */}
      {referralCode && (
        <div style={{
          background: '#fff', borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)',
          padding: '24px 28px', marginBottom: '28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(227, 169, 74,0.1)', border: '1px solid rgba(227, 169, 74,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0C1022', margin: 0 }}>
                Your Invite Link
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Share this link to recruit new agents — they&apos;ll be automatically linked to you
              </p>
            </div>
          </div>

          {/* Link display + copy */}
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'stretch',
            flexWrap: 'wrap',
          }}>
            <div style={{
              flex: 1, minWidth: '200px',
              background: '#F7F5F0', border: '1px solid #E7E3DA', borderRadius: '12px',
              padding: '12px 16px', fontSize: '15px', color: '#374151',
              fontFamily: 'monospace', wordBreak: 'break-all',
              display: 'flex', alignItems: 'center',
            }}>
              {inviteLink}
            </div>
            <a className="nxt-btn"
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Link
            </a>
            <button className="nxt-btn nxt-btn-primary"
              onClick={handleCopy}
             
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
            <button className="nxt-btn"
              onClick={handleEmailShare}
             
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Toggle ── */}
      <div style={{ marginBottom: '32px' }}>
        <SegTabs label="Period" value={tab} onChange={setTab} tabs={[{ key: 'allTime', label: 'All Time' }, { key: 'thisMonth', label: 'This Month' }]} />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <LoadingSpinner label="Loading leaderboard..." />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          variant="minimal"
          title={tab === 'thisMonth' ? 'No recruits this month yet' : 'No recruitment data yet'}
        />
      ) : (
        <>
          {/* ── Podium ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            gap: '16px', marginBottom: '40px', padding: '28px 16px 0',
          }}>
            {(top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3).map((recruiter, vi) => {
              const rank = top3.length >= 3 ? [2, 1, 3][vi] : vi + 1;
              return <PodiumCard key={recruiter.id} recruiter={recruiter} rank={rank} total={totalRecruits} />;
            })}
          </div>

          {/* ── Full Ranking Table ── */}
          {rest.length > 0 && (
            <div style={{
              background: '#fff', borderRadius: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)',
              overflow: 'hidden', marginBottom: '24px',
            }}>
              <div style={{
                padding: '20px 24px 12px',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0C1022', margin: 0 }}>
                  Full Rankings
                </h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <th scope="col" style={{ padding: '12px 24px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px', width: '60px' }}>Rank</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Agent</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px', width: '100px' }}>Recruits</th>
                    <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.8px', width: '100px' }}>Active</th>
                    <th scope="col" style={{ padding: '12px 24px', width: '48px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((recruiter, i) => {
                    const rank = i + 4;
                    const isExpanded = expandedId === recruiter.id;
                    return (
                      <React.Fragment key={recruiter.id}>
                        <tr
                          style={{
                            borderBottom: '1px solid rgba(0,0,0,0.03)',
                            cursor: 'pointer',
                            background: isExpanded ? '#FAFBFC' : 'transparent',
                            transition: 'background 150ms ease',
                          }}
                          onClick={() => setExpandedId(isExpanded ? null : recruiter.id)}
                          onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#FAFBFC'; }}
                          onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '14px 24px' }}>
                            <span style={{
                              fontWeight: '700', color: '#D1D5DB', fontSize: '15px',
                            }}>
                              #{rank}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Avatar name={recruiter.name} photoUrl={recruiter.photoUrl} size={36} />
                              <div>
                                <div style={{ fontWeight: '600', color: '#0C1022', fontSize: '16px' }}>{recruiter.name}</div>
                                {recruiter.nxtId && (
                                  <div style={{ fontSize: '13px', color: '#B0B5BC', marginTop: '1px' }}>{recruiter.nxtId}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span style={{
                              fontWeight: '700', fontSize: '16px', color: '#0C1022',
                              background: 'rgba(12, 16, 34,0.04)',
                              padding: '4px 14px', borderRadius: '999px',
                            }}>
                              {recruiter.recruitCount}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2FA84F' }} />
                              <span style={{ fontWeight: '600', color: 'var(--status-success)', fontSize: '16px' }}>
                                {recruiter.activeRecruits}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 24px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '24px', height: '24px', borderRadius: '6px',
                              background: isExpanded ? 'rgba(12, 16, 34,0.06)' : 'transparent',
                              transition: 'all 200ms',
                              color: 'var(--text-secondary)', fontSize: '13px',
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                            }}>
                              &#9660;
                            </span>
                          </td>
                        </tr>
                        {isExpanded && recruiter.recruits?.length > 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '0 24px 16px 84px', background: '#FAFBFC' }}>
                              <p style={{
                                fontSize: '13px', fontWeight: '700', color: '#B0B5BC',
                                margin: '8px 0 10px', textTransform: 'uppercase', letterSpacing: '1px',
                              }}>
                                Recent Recruits
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {recruiter.recruits.map(r => (
                                  <div key={r.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    fontSize: '15px', padding: '6px 12px', borderRadius: '8px',
                                    background: '#fff', border: '1px solid rgba(0,0,0,0.04)',
                                  }}>
                                    <span style={{
                                      width: '7px', height: '7px', borderRadius: '50%',
                                      background: STATUS_DOT[r.status] || '#5F5C56', flexShrink: 0,
                                      boxShadow: `0 0 4px ${STATUS_DOT[r.status] || '#5F5C56'}44`,
                                    }} />
                                    <span style={{ fontWeight: '500', color: '#0C1022', flex: 1 }}>{r.name}</span>
                                    <span style={{ color: '#B0B5BC', fontSize: '14px' }}>{formatDate(r.joinedAt)}</span>
                                    <span style={{
                                      fontSize: '13px', padding: '2px 8px', borderRadius: '999px',
                                      background: r.status === 'active' ? 'rgba(47,168,79,0.08)' : 'rgba(227, 169, 74,0.08)',
                                      color: r.status === 'active' ? 'var(--status-success)' : 'var(--ink-gold)',
                                      fontWeight: '600', textTransform: 'capitalize',
                                    }}>
                                      {r.status?.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* CSS Keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
