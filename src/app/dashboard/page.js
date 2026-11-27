"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchDashboardV2Data } from '@/app/actions/dashboard-v2';
import { updateTaskStatus } from '@/app/actions/tasks';
import Avatar from '@/components/Avatar';
import InviteAgentModal from '@/components/InviteAgentModal';
import FlyerCarousel from '@/components/FlyerCarousel';
import s from './dashboard.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function fmtCurrency(n) {
  return '$' + (n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function fmtCompact(n) {
  if (!n || n === 0) return '$0';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function taskStatus(dueAt) {
  if (!dueAt) return 'upcoming';
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  if (due < now) return 'overdue';
  if (due <= eod.getTime()) return 'today';
  return 'upcoming';
}

function fmtDue(dueAt) {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  const diff = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff < 0) return 'Yesterday';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DOT_CLASS = { overdue: s.dotOverdue, today: s.dotToday, upcoming: s.dotUpcoming };
const PIPE_COLORS = ['#1B2A4E', '#245BB3', '#1B2A4E', '#0C1022', '#E3A94A', '#8B5CF6', '#059669'];

const BANNER_DISMISS_KEY = 'nxt_v2_banner_dismissed_at';
const SEVEN_DAYS_MS = 7 * 86400000;

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#1B2A4E', width = 80, height = 28 }) {
  if (!data || data.length < 2 || data.every(v => v === 0)) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`)
    .join(' ');
  return (
    <svg width={width} height={height} className={s.kpiSparkline} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function FeaturedSparkline({ data }) {
  if (!data || data.length < 2 || data.every(v => v === 0)) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const xy = data.map((v, i) => [(i / (data.length - 1)) * 100, 100 - ((v - min) / range) * 72 - 14]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const last = xy[xy.length - 1];
  return (
    <svg className={s.featuredSparkline} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="nxtSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E3A94A" stopOpacity="0.38" />
          <stop offset="1" stopColor="#E3A94A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 100 L0 100 Z`} fill="url(#nxtSparkFill)" />
      <path className={s.featuredSparkLine} d={line} fill="none" stroke="#F5D9A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" />
      <circle className={s.featuredSparkDot} cx={last[0]} cy={last[1]} r="1.6" fill="#fff" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className={s.container}>
      <div className={s.greeting}>
        <div className={s.skeleton} style={{ width: 280, height: 32, marginBottom: 8 }} />
        <div className={s.skeleton} style={{ width: 200, height: 14 }} />
      </div>
      <div className={s.skeletonRow}>
        {[1, 2, 3].map(i => (
          <div key={i} className={s.skeletonCard}>
            <div className={s.skeletonLine} />
            <div className={s.skeletonValue} />
          </div>
        ))}
      </div>
      <div className={s.skeletonFeatured} />
      <div className={s.skeletonColumns}>
        <div className={s.skeletonBlock} />
        <div className={s.skeletonBlock} />
      </div>
    </div>
  );
}

// ── Onboarding banner (#5) ───────────────────────────────────────────────────

function OnboardingBanner({ agent, dismissed, onDismiss }) {
  const router = useRouter();
  let task = null;
  if (!agent.documentsUploaded) {
    task = { label: 'Upload Documents', desc: 'Government ID, SSN card, voided check, and more.', link: '/dashboard/business/documents' };
  } else if (!agent.hasNpn) {
    task = { label: 'Add Licensing Info', desc: 'Add your NPN and licensed states.', link: '/dashboard/settings/profile' };
  } else if (!agent.hasEO) {
    task = { label: 'Add E&O Insurance', desc: 'Complete your compliance requirements.', link: '/dashboard/settings/profile' };
  }
  if (!task || dismissed) return null;
  return (
    <div className={s.banner}>
      <div className={s.bannerIcon}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E3A94A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </div>
      <div className={s.bannerContent}>
        <p className={s.bannerTitle}>{task.label}</p>
        <p className={s.bannerDesc}>{task.desc}</p>
      </div>
      <div className={s.bannerButtons}>
        <button className={s.bannerDismiss} onClick={onDismiss} aria-label="Dismiss">&times;</button>
        <button className={s.bannerAction} onClick={() => router.push(task.link)}>Complete</button>
      </div>
    </div>
  );
}

// ── Payment notice banner ────────────────────────────────────────────────────

function PaymentNoticeBanner({ userProfile }) {
  const router = useRouter();

  // Don't show for exempt roles
  if (!userProfile) return null;
  if (userProfile.is_owner || userProfile.billingExempt || userProfile.role === 'it_engineer') return null;

  // Check if payment is missing
  const hasCard = !!(
    userProfile.stripe_customer_id &&
    userProfile.stripe_subscription_id &&
    userProfile.payment?.cardLastFour
  );
  if (hasCard) return null;

  return (
    <div className={s.paymentBanner}>
      <div className={s.paymentBannerIcon}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className={s.bannerContent}>
        <p className={s.bannerTitle} style={{ color: '#DC3545' }}>Payment Details Required</p>
        <p className={s.bannerDesc}>Your card details are missing. Please add your payment method to avoid service interruption.</p>
      </div>
      <button className={s.paymentBannerAction} onClick={() => router.push('/dashboard/billing')}>
        Add Payment
      </button>
    </div>
  );
}

// ── Quick actions (#8) ───────────────────────────────────────────────────────

function QuickActions({ isPrivileged, pendingApprovals, onInvite }) {
  const router = useRouter();

  const adminActions = [
    { label: 'Invite agent', icon: '+', action: onInvite },
    { label: 'Add deal', icon: '+', href: '/dashboard/deals/new' },
    { label: 'Add lead', icon: '+', href: '/dashboard/leads/new' },
    { label: 'Review approvals', icon: null, href: '/dashboard/admin/approvals', badge: pendingApprovals || 0 },
  ];
  const agentActions = [
    { label: 'Add deal', icon: '+', href: '/dashboard/deals/new' },
    { label: 'Add lead', icon: '+', href: '/dashboard/leads/new' },
    { label: 'My tasks', icon: null, href: '/dashboard/tasks' },
    { label: 'Upload documents', icon: null, href: '/dashboard/business/documents' },
  ];

  const actions = isPrivileged ? adminActions : agentActions;

  return (
    <div className={s.quickActions}>
      {actions.map(a => (
        <button key={a.label} className={s.quickPill} onClick={() => a.action ? a.action() : router.push(a.href)}>
          {a.icon && <span className={s.quickPillIcon}>{a.icon}</span>}
          {a.label}
          {a.badge > 0 && <span className={s.quickBadge}>{a.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ── KPI pill (agent view) ────────────────────────────────────────────────────

function KpiPill({ label, value, hint, sparkData, sparkColor }) {
  return (
    <div className={`${s.card} ${s.cardHover} ${s.kpiPill}`}>
      <div className={s.kpiInfo}>
        <p className={s.kpiLabel}>{label}</p>
        <p className={s.kpiValue}>{value}</p>
        {hint && <p className={s.kpiHint}>{hint}</p>}
      </div>
      {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
    </div>
  );
}

// ── Featured card (#6) ───────────────────────────────────────────────────────

function FeaturedCard({ label, production, pending, sparkData, momPct }) {
  const hasData = production > 0 || pending > 0;
  const showComparison = momPct !== null && momPct !== undefined;

  return (
    <div className={s.featured}>
      <span className={s.featuredRing} aria-hidden="true" />
      <span className={s.featuredGlow} aria-hidden="true" />
      <div className={s.featuredContent}>
        <div className={s.featuredMain}>
          <p className={s.featuredLabel}>{label || 'MTD Production'}</p>
          <p className={s.featuredValue}>{fmtCurrency(production).replace(/\.00$/, '')}</p>
          {hasData && pending > 0 && (
            <p className={s.featuredSubtext}><span className={s.featuredChip}>+ {fmtCurrency(pending)} pending</span></p>
          )}
          {!hasData && (
            <p className={s.featuredSubtext}>Close deals to start earning commissions</p>
          )}
        </div>
        {showComparison && (
          <div className={`${s.featuredStat} ${momPct >= 0 ? s.featuredStatUp : s.featuredStatDown}`}>
            {momPct >= 0 ? '▲' : '▼'} {Math.abs(momPct)}% vs last month
          </div>
        )}
      </div>
      <FeaturedSparkline data={sparkData} />
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ text, linkText, onAction }) {
  return (
    <div className={s.emptyState}>
      <p className={s.emptyText}>{text}</p>
      {linkText && (
        <button className={s.emptyLink} onClick={onAction}>{linkText}</button>
      )}
    </div>
  );
}

// ── Pipeline section (#3) ────────────────────────────────────────────────────

function PipelineSection({ data, emptyAction }) {
  const router = useRouter();
  const total = data.reduce((sum, st) => sum + st.count, 0);
  const totalValue = data.reduce((sum, st) => sum + st.value, 0);

  if (data.length === 0) {
    return (
      <EmptyState
        text="No pipeline stages configured"
        linkText="Set up pipeline"
        onAction={() => router.push('/dashboard/business/pipeline')}
      />
    );
  }

  // Agents keep personal copies of the same stages; show each stage name once, in order.
  const byName = [];
  for (const st of data) {
    const hit = byName.find(g => g.name === st.name);
    if (hit) { hit.count += st.count; hit.value += st.value; }
    else byName.push({ stageId: st.stageId, name: st.name, count: st.count, value: st.value });
  }
  const shown = byName.filter(g => g.count > 0 || !/closed/i.test(g.name));
  const peak = Math.max(...shown.map(g => g.value), 1);

  return (
    <>
      <p className={s.pipelineSummary}>
        {total} open deal{total !== 1 ? 's' : ''} &middot; {fmtCurrency(totalValue)} in pipeline
      </p>
      <div className={s.pipeBlocks}>
        {shown.map((stage, i) => (
          <button
            type="button"
            key={stage.name}
            className={s.pipeCol}
            onClick={() => router.push(`/dashboard/business/pipeline?stage=${stage.stageId}`)}
          >
            <span className={s.pipeTrack}>
              <span
                className={s.pipeBlock}
                data-tone={Math.min(i, 4)}
                style={{ height: `${34 + Math.round((stage.value / peak) * 66)}%`, animationDelay: `${i * 70}ms` }}
              >
                <span className={s.pipeCount}>{stage.count}</span>
                {stage.value > 0 && <span className={s.pipeValue}>{fmtCompact(stage.value)}</span>}
              </span>
            </span>
            <span className={s.pipeName}>{stage.name}</span>
          </button>
        ))}
      </div>
      {total === 0 && emptyAction && (
        <div className={s.emptyState} style={{ paddingTop: 8 }}>
          <button className={s.emptyLink} onClick={emptyAction.onClick}>
            {emptyAction.text}
          </button>
        </div>
      )}
    </>
  );
}

// ── Task list ────────────────────────────────────────────────────────────────

function TaskList({ tasks, onComplete }) {
  const router = useRouter();
  if (tasks.length === 0) {
    return (
      <EmptyState
        text="You're all caught up!"
        linkText="View all tasks"
        onAction={() => router.push('/dashboard/tasks')}
      />
    );
  }
  return (
    <>
      <div className={s.taskList}>
        {tasks.slice(0, 7).map(t => {
          const st = taskStatus(t.dueAt);
          return (
            <div key={t.id} className={s.taskItem}>
              <button className={s.taskCheckbox} onClick={() => onComplete(t.id)} aria-label={`Complete: ${t.title}`} />
              <span className={`${s.taskDot} ${DOT_CLASS[st]}`} />
              <span className={s.taskTitle}>{t.title}</span>
              <span className={st === 'overdue' ? s.taskDueOverdue : s.taskDue}>{fmtDue(t.dueAt)}</span>
            </div>
          );
        })}
      </div>
      <button className={s.viewAll} onClick={() => router.push('/dashboard/tasks')}>
        {tasks.length > 7 ? `View all ${tasks.length} tasks` : 'View all tasks'}
      </button>
    </>
  );
}

// ── Pending reviews (#4) ─────────────────────────────────────────────────────

function PendingReviews({ admin }) {
  const router = useRouter();
  const items = [];

  if (admin.pendingApprovals > 0) {
    items.push({
      count: admin.pendingApprovals,
      text: `Agent${admin.pendingApprovals !== 1 ? 's' : ''} awaiting approval`,
      href: '/dashboard/admin/approvals',
    });
  }
  if (admin.docsAwaitingReview.length > 0) {
    items.push({
      count: admin.docsAwaitingReview.length,
      text: `Document${admin.docsAwaitingReview.length !== 1 ? 's' : ''} to review`,
      href: '/dashboard/admin/documents',
    });
  }

  if (items.length === 0) {
    return <EmptyState text="No pending reviews" />;
  }

  return (
    <div>
      {items.slice(0, 4).map((item, i) => (
        <div key={i} className={s.reviewItem}>
          <span className={s.reviewBadge}>{item.count}</span>
          <span className={s.reviewText}>{item.text}</span>
          <button className={s.reviewLink} onClick={() => router.push(item.href)}>Review</button>
        </div>
      ))}
    </div>
  );
}

// ── Top producers (#7) ───────────────────────────────────────────────────────

function TopProducers({ producers }) {
  if (!producers || producers.length === 0) {
    return <EmptyState text="Rankings appear once deals close" />;
  }

  return (
    <div className={s.producerList}>
      {producers.map(p => (
        <div key={p.id} className={s.producerItem}>
          <span className={s.producerRank}>#{p.rank}</span>
          <Avatar name={p.name} photoUrl={p.photoUrl} size={32} />
          <div className={s.producerInfo}>
            <p className={s.producerName}>{p.name}</p>
            {p.level && <span className={s.producerLevel}>{p.level}</span>}
          </div>
          <span className={s.producerAmount}>{fmtCompact(p.production)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Recent activity (#7) ─────────────────────────────────────────────────────

const ACTIVITY_DOT = {
  agent_invited: s.activityDotAgent,
  agent_approved: s.activityDotAgent,
  agent_activated: s.activityDotAgent,
  deal_created: s.activityDotDeal,
  deal_moved: s.activityDotDeal,
  deal_won: s.activityDotDeal,
  doc_uploaded: s.activityDotDoc,
};

function RecentActivity({ activity }) {
  if (!activity || activity.length === 0) {
    return <EmptyState text="No recent activity" />;
  }

  return (
    <div className={s.activityList}>
      {activity.map((ev, i) => (
        <div key={i} className={s.activityItem}>
          <span className={`${s.activityDot} ${ACTIVITY_DOT[ev.type] || s.activityDotAgent}`} />
          <div className={s.activityBody}>
            <p className={s.activityText}>
              <span className={s.activityActor}>{ev.actor}</span>{' '}{ev.text}
            </p>
          </div>
          <span className={s.activityTime}>{relativeTime(ev.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Needs attention with onboarding fallback (#9) ────────────────────────────

function NeedsAttentionContent({ admin }) {
  const router = useRouter();

  if (admin.needsAttention.length > 0) {
    return (
      <div className={s.attentionList}>
        {admin.needsAttention.map(a => (
          <div key={a.id} className={s.attentionItem} onClick={() => router.push(`/dashboard/team/${a.id}`)} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
            <span className={s.attentionDot} />
            <span className={s.attentionName}>{a.fullName}</span>
            <span className={s.attentionBadge}>{a.days}d overdue</span>
          </div>
        ))}
      </div>
    );
  }

  // Empty state: show recently onboarding agents
  return (
    <div>
      <p className={s.emptyText} style={{ textAlign: 'left', marginBottom: admin.recentlyOnboarding.length > 0 ? 12 : 0 }}>
        All agents are on track
      </p>
      {admin.recentlyOnboarding.length > 0 && (
        admin.recentlyOnboarding.map(a => (
          <div key={a.id} className={s.onboardingItem}>
            <span className={s.onboardingName}>{a.name}</span>
            <div className={s.progressBar}>
              <div className={s.progressFill} style={{ width: `${Math.max(a.progress, 5)}%` }} />
            </div>
            <span className={s.progressPct}>{a.progress}%</span>
          </div>
        ))
      )}
    </div>
  );
}

// ── Top Recruiters card (visible to ALL) ────────────────────────────────────

const RECRUIT_MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

function TopRecruitersCard({ topRecruiters }) {
  if (!topRecruiters || topRecruiters.length === 0) {
    return <EmptyState text="Recruit agents to see rankings" />;
  }

  return (
    <div className={s.recruiterList}>
      {topRecruiters.map((r, i) => (
        <div key={r.id} className={`${s.recruiterItem} ${i === 0 ? s.recruiterItemTop : ''}`}>
          <div
            className={s.recruiterMedal}
            style={{ background: RECRUIT_MEDAL[i] || 'var(--border-color)' }}
          >
            {i + 1}
          </div>
          <Avatar name={r.name} photoUrl={r.photoUrl} size={32} />
          <div className={s.recruiterInfo}>
            <p className={s.recruiterName}>{r.name}</p>
          </div>
          <div className={s.recruiterStat}>
            <span className={s.recruiterCount}>{r.count}</span>
            <span className={s.recruiterLabel}>recruited</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Agent view ───────────────────────────────────────────────────────────────

function AgentView({ data, onCompleteTask }) {
  const router = useRouter();
  const { kpis, pipelineByStage, tasks } = data;
  return (
    <>
      {/* Row 1: this month's production beside pipeline and tasks */}
      <div className={s.heroRow}>
        <FeaturedCard
          label="Your production, month to date"
          production={kpis.mtdProduction}
          pending={kpis.mtdPending}
          sparkData={kpis.sparkProduction}
          momPct={kpis.momPct}
        />
        <button type="button" className={`${s.bigTile} ${s.bigTileWarm}`} onClick={() => router.push('/dashboard/business/pipeline')}>
          <span className={s.bigTileLabel}>Open pipeline</span>
          <span className={s.bigTileValue}>{fmtCompact(kpis.pipelineValue)}</span>
          <span className={s.bigTileHint}>
            {kpis.pipelineValue === 0 ? 'Add deals to build pipeline' : `Across ${pipelineByStage.reduce((t, st) => t + st.count, 0)} deals`}
          </span>
        </button>
        <button type="button" className={s.bigTile} onClick={() => router.push('/dashboard/tasks')}>
          <span className={s.bigTileLabel}>Deals won this month</span>
          <span className={s.bigTileValue}>{kpis.dealsWonMonth}</span>
          <span className={s.bigTileHint} data-alert={kpis.overdueTaskCount > 0 || undefined}>
            {kpis.overdueTaskCount > 0 ? `${kpis.overdueTaskCount} overdue task${kpis.overdueTaskCount !== 1 ? 's' : ''}` : 'All tasks on track'}
          </span>
        </button>
      </div>

      <div className={s.splitRow}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Your Pipeline</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/business/pipeline')}>
              View all
            </button>
          </div>
          <PipelineSection
            data={pipelineByStage}
            emptyAction={{ text: 'Add your first deal', onClick: () => router.push('/dashboard/deals/new') }}
          />
        </div>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Action Items</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/tasks')}>
              View all
            </button>
          </div>
          <TaskList tasks={tasks} onComplete={onCompleteTask} />
        </div>
      </div>

      {/* Top Recruiters — visible to all agents */}
      <div className={s.bottomRow} style={{ marginTop: '20px' }}>
        <div className={`${s.card} ${s.cardHover}`} onClick={() => router.push('/dashboard/recruitment')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Top Recruiters</h3>
            <button className={s.headerLink} onClick={e => { e.stopPropagation(); router.push('/dashboard/recruitment'); }}>
              View all
            </button>
          </div>
          <TopRecruitersCard topRecruiters={data.topRecruiters} />
        </div>
      </div>
    </>
  );
}

// ── Admin view ───────────────────────────────────────────────────────────────

function AdminView({ data, onCompleteTask }) {
  const router = useRouter();
  const { kpis, pipelineByStage, tasks, admin } = data;

  return (
    <>
      {/* Row 1: production beside the two figures an owner checks first */}
      <div className={s.heroRow}>
        <FeaturedCard
          label="Agency production, month to date"
          production={admin.agencyMtdProduction}
          pending={kpis.mtdPending}
          sparkData={kpis.sparkProduction}
          momPct={admin.agencyMomPct}
        />
        <button type="button" className={`${s.bigTile} ${s.bigTileWarm}`} onClick={() => router.push('/dashboard/business/pipeline')}>
          <span className={s.bigTileLabel}>Open pipeline</span>
          <span className={s.bigTileValue}>{fmtCompact(admin.agencyPipelineValue)}</span>
          <span className={s.bigTileHint}>
            {admin.openDealCount > 0 ? `${admin.openDealCount} open deal${admin.openDealCount !== 1 ? 's' : ''}` : 'No open deals'}
          </span>
        </button>
        <button type="button" className={s.bigTile} onClick={() => router.push('/dashboard/team')}>
          <span className={s.bigTileLabel}>Team</span>
          <span className={s.bigTileFaces} aria-hidden="true">
            {(admin.topProducers || []).slice(0, 3).map(p => <Avatar key={p.id} name={p.name} photoUrl={p.photoUrl} size={40} />)}
          </span>
          <span className={s.bigTileValue}>{admin.teamSize}</span>
          <span className={s.bigTileHint}>{admin.activeCount} active &middot; {admin.onboardingCount} onboarding</span>
        </button>
      </div>

      {/* Row 2: pipeline beside what is waiting on this person */}
      <div className={s.splitRow}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Agency Pipeline</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/business/pipeline')}>
              Open board
            </button>
          </div>
          <PipelineSection data={pipelineByStage} />
        </div>

        <div className={s.sideStack}>
          <div className={`${s.card} ${s.waitCard}`}>
            <div className={s.cardHeader}>
              <h3 className={s.cardHeaderTitle}><span className={s.waitDot} aria-hidden="true" />Waiting on you</h3>
              {(admin.pendingApprovals > 0 || admin.docsAwaitingReview.length > 0) && (
                <button className={s.headerLink} onClick={() => router.push('/dashboard/admin/approvals')}>
                  View all
                </button>
              )}
            </div>
            <PendingReviews admin={admin} />
          </div>
          <div className={s.miniRow}>
            <div className={s.miniTile}>
              <span className={s.bigTileLabel}>Deals won this month</span>
              <span className={s.miniValue}>{admin.agencyDealsWon}</span>
              <span className={s.bigTileHint}>
                {admin.agencyDealsWon > 0 ? fmtCurrency(admin.agencyDealsWonPremium) + ' premium' : 'None closed yet'}
              </span>
            </div>
            <button type="button" className={s.miniTile} onClick={() => router.push('/dashboard/team?filter=invited')}>
              <span className={s.bigTileLabel}>Pending invites</span>
              <span className={s.miniValue}>{admin.pendingInvites}</span>
              <span className={s.bigTileHint}>
                {admin.pendingInvites > 0 && admin.oldestInviteDays > 0 ? `Oldest ${admin.oldestInviteDays}d ago` : 'All invites accepted'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 3: Top Producers + Recent Activity (#7) */}
      <div className={s.bottomRow}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Top Producers</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/scoreboard')}>
              Scoreboard
            </button>
          </div>
          <TopProducers producers={admin.topProducers} />
        </div>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Recent Activity</h3>
          </div>
          <RecentActivity activity={admin.recentActivity} />
        </div>
      </div>

      {/* Row 4: Needs Attention + Action Items */}
      <div className={s.bottomRow}>
        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Needs Attention</h3>
            {admin.needsAttention.length > 0 && (
              <button className={s.headerLink} onClick={() => router.push('/dashboard/team')}>
                View team
              </button>
            )}
          </div>
          <NeedsAttentionContent admin={admin} />
        </div>

        <div className={s.card}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Your Action Items</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/tasks')}>
              View all
            </button>
          </div>
          <TaskList tasks={tasks} onComplete={onCompleteTask} />
        </div>
      </div>

      {/* Row 5: Top Recruiters — visible to all */}
      <div className={s.bottomRow}>
        <div className={`${s.card} ${s.cardHover}`} onClick={() => router.push('/dashboard/recruitment')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Top Recruiters</h3>
            <button className={s.headerLink} onClick={e => { e.stopPropagation(); router.push('/dashboard/recruitment'); }}>
              Leaderboard
            </button>
          </div>
          <TopRecruitersCard topRecruiters={data.topRecruiters} />
        </div>
      </div>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardV2Page() {
  const { userProfile } = useUser();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    // Check localStorage for 7-day banner dismiss (#5)
    try {
      const dismissedAt = typeof window !== 'undefined' ? localStorage.getItem(BANNER_DISMISS_KEY) : null;
      if (dismissedAt && Date.now() - Number(dismissedAt) < SEVEN_DAYS_MS) {
        return true;
      }
    } catch {}
    return false;
  });

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try { localStorage.setItem(BANNER_DISMISS_KEY, String(Date.now())); } catch {}
  }, []);

  const loadData = useCallback(async (profile) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetchDashboardV2Data();
      if (res.success) {
        setData(res);
      } else {
        const errMsg = res.error || 'Unknown error';
        console.error('[Dashboard] fetchDashboardV2Data failed:', errMsg);
        setLoadError(errMsg);
      }
    } catch (e) {
      const errMsg = e?.message || 'Network error';
      console.error('[Dashboard] fetchDashboardV2Data threw:', e);
      setLoadError(errMsg);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching is a valid use of setState in effects
    if (userProfile) loadData(userProfile);
  }, [userProfile, loadData]);

  const handleCompleteTask = useCallback(async (taskId) => {
    try {
      const res = await updateTaskStatus(taskId, 'completed');
      if (res.success) {
        setData(prev => {
          if (!prev) return prev;
          const remaining = prev.tasks.filter(t => t.id !== taskId);
          const removedTask = prev.tasks.find(t => t.id === taskId);
          const wasOverdue = removedTask && taskStatus(removedTask.dueAt) === 'overdue';
          return {
            ...prev,
            tasks: remaining,
            kpis: {
              ...prev.kpis,
              overdueTaskCount: wasOverdue
                ? Math.max(0, prev.kpis.overdueTaskCount - 1)
                : prev.kpis.overdueTaskCount,
            },
          };
        });
      }
    } catch (e) {
      // silenced
    }
  }, []);

  if (isLoading) return <SkeletonLoader />;

  if (loadError || !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 32 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e' }}>Unable to load dashboard</h2>
      <p style={{ fontSize: 16, color: '#5F5C56', textAlign: 'center', maxWidth: 400 }}>
        {loadError || 'No data returned from server.'}
      </p>
      <button
        onClick={() => loadData(userProfile)}
        style={{ marginTop: 8, padding: '10px 24px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500 }}
      >
        Retry
      </button>
    </div>
  );

  const showBanner = !data.agent.onboardingCompleted && !bannerDismissed &&
    (!data.agent.documentsUploaded || !data.agent.hasNpn || !data.agent.hasEO);

  const firstName = data.agent.fullName?.split(' ')[0] || '';

  // Role badge text
  let roleBadge = '';
  if (data.agent.isOwner) roleBadge = 'Owner';
  else if (data.agent.role === 'admin') roleBadge = 'Admin';
  else if (data.agent.role === 'it_engineer') roleBadge = 'IT';
  else if (data.agent.contractLevel) roleBadge = data.agent.contractLevel;

  return (
    <div className={s.container}>
      {/* #10: Greeting with role badge */}
      <div className={s.greeting}>
        <div className={s.greetingRow}>
          <h1 className={s.greetingText}>
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          {roleBadge && <span className={s.roleBadge}>{roleBadge}</span>}
        </div>
        <p className={s.greetingDate}>{formatDate()}</p>
      </div>

      {/* Payment notice — auto-hides once card is added */}
      <PaymentNoticeBanner userProfile={userProfile} />

      {showBanner && (
        <OnboardingBanner agent={data.agent} dismissed={bannerDismissed} onDismiss={handleDismissBanner} />
      )}

      {/* #8: Quick actions */}
      <QuickActions
        isPrivileged={data.agent.isPrivileged}
        pendingApprovals={data.admin?.pendingApprovals || 0}
        onInvite={() => setIsInviteOpen(true)}
      />

      <FlyerCarousel />

      {data.agent.isPrivileged ? (
        <AdminView data={data} onCompleteTask={handleCompleteTask} />
      ) : (
        <AgentView data={data} onCompleteTask={handleCompleteTask} />
      )}

      <InviteAgentModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        userProfile={userProfile}
      />
    </div>
  );
}
