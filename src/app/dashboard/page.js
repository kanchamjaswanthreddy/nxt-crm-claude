"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchDashboardV2Data } from '@/app/actions/dashboard-v2';
import { updateTaskStatus } from '@/app/actions/tasks';
import Avatar from '@/components/Avatar';
import InviteAgentModal from '@/components/InviteAgentModal';
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
const PIPE_COLORS = ['#2D6FC4', '#245BB3', '#1B3A6B', '#0F2A52', '#C99A3D', '#8B5CF6', '#059669'];

const BANNER_DISMISS_KEY = 'nxt_v2_banner_dismissed_at';
const SEVEN_DAYS_MS = 7 * 86400000;

// ── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#2D6FC4', width = 80, height = 28 }) {
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
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100}%,${100 - ((v - min) / range) * 80 - 10}%`)
    .join(' ');
  return (
    <svg
      className={s.featuredSparkline}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        vectorEffect="non-scaling-stroke"
      />
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C99A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <div className={s.featuredContent}>
        <div className={s.featuredMain}>
          <p className={s.featuredLabel}>{label || 'MTD Production'}</p>
          <p className={s.featuredValue}>{fmtCurrency(production)}</p>
          {hasData && pending > 0 && (
            <p className={s.featuredSubtext}>+ {fmtCurrency(pending)} pending</p>
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

  return (
    <>
      <p className={s.pipelineSummary}>
        {total} open deal{total !== 1 ? 's' : ''} &middot; {fmtCurrency(totalValue)} in pipeline
      </p>
      <div className={s.pipelineGrid}>
        {data.map((stage, i) => (
          <div
            key={stage.stageId}
            className={s.pipelineStage}
            onClick={() => router.push(`/dashboard/business/pipeline?stage=${stage.stageId}`)}
            role="button"
            tabIndex={0}
          >
            <p className={s.pipelineStageName}>{stage.name}</p>
            <p className={s.pipelineStageCount}>{stage.count}</p>
            <div className={s.pipelineStageBar}>
              <div
                className={s.pipelineStageFill}
                style={{
                  width: total > 0 ? `${Math.max((stage.count / total) * 100, stage.count > 0 ? 8 : 0)}%` : '0%',
                  backgroundColor: PIPE_COLORS[i % PIPE_COLORS.length],
                }}
              />
            </div>
          </div>
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
      <div className={s.kpiRow}>
        <KpiPill
          label="Open Pipeline"
          value={fmtCurrency(kpis.pipelineValue)}
          hint={kpis.pipelineValue === 0
            ? 'Add deals to build pipeline'
            : `Across ${pipelineByStage.reduce((t, st) => t + st.count, 0)} deals`}
          sparkColor="#0F2A52"
        />
        <KpiPill
          label="Deals Won"
          value={String(kpis.dealsWonMonth)}
          hint="This month"
          sparkData={kpis.sparkDeals}
          sparkColor="#2FA84F"
        />
        <KpiPill
          label="Overdue Tasks"
          value={String(kpis.overdueTaskCount)}
          hint={kpis.overdueTaskCount > 0 ? 'Needs your attention' : 'All on track'}
          sparkColor={kpis.overdueTaskCount > 0 ? '#D33F3F' : '#A9ACB1'}
        />
      </div>

      <FeaturedCard
        label="MTD Production"
        production={kpis.mtdProduction}
        pending={kpis.mtdPending}
        sparkData={kpis.sparkProduction}
        momPct={kpis.momPct}
      />

      <div className={s.columns}>
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
      {/* Featured gradient card */}
      <FeaturedCard
        label="Agency MTD Production"
        production={admin.agencyMtdProduction}
        pending={kpis.mtdPending}
        sparkData={kpis.sparkProduction}
        momPct={admin.agencyMomPct}
      />

      {/* Row 1: Pipeline (span 2) + Pending Reviews (span 2) */}
      <div className={s.bento}>
        <div className={`${s.card} ${s.bentoWide}`}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Agency Pipeline</h3>
            <button className={s.headerLink} onClick={() => router.push('/dashboard/business/pipeline')}>
              View all
            </button>
          </div>
          <PipelineSection data={pipelineByStage} />
        </div>

        <div className={`${s.card} ${s.bentoWide}`}>
          <div className={s.cardHeader}>
            <h3 className={s.cardHeaderTitle}>Pending Reviews</h3>
            {(admin.pendingApprovals > 0 || admin.docsAwaitingReview.length > 0) && (
              <button className={s.headerLink} onClick={() => router.push('/dashboard/admin/approvals')}>
                View all
              </button>
            )}
          </div>
          <PendingReviews admin={admin} />
        </div>

        {/* Row 2: 4 KPI squares with icon chips (#2) */}
        <div className={`${s.card} ${s.cardHover} ${s.kpiSquare}`} onClick={() => router.push('/dashboard/team')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className={`${s.kpiIconChip} ${s.kpiIconChipBlue}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <p className={s.kpiLabel}>Team Size</p>
          <p className={s.kpiSquareValue}>{admin.teamSize}</p>
          <p className={s.kpiHint}>
            {admin.activeCount} active &middot; {admin.onboardingCount} onboarding
          </p>
        </div>

        <div className={`${s.card} ${s.cardHover} ${s.kpiSquare}`}>
          <div className={`${s.kpiIconChip} ${s.kpiIconChipGreen}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <p className={s.kpiLabel}>Open Pipeline Value</p>
          <p className={s.kpiSquareValue}>{fmtCurrency(admin.agencyPipelineValue)}</p>
          <p className={s.kpiHint}>
            {admin.openDealCount > 0 ? `${admin.openDealCount} open deal${admin.openDealCount !== 1 ? 's' : ''}` : 'No open deals'}
          </p>
        </div>

        <div className={`${s.card} ${s.cardHover} ${s.kpiSquare}`}>
          <div className={`${s.kpiIconChip} ${s.kpiIconChipGold}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-1-3.25-2.03-3.79A1.07 1.07 0 0114 17v-2.34"/><path d="M6 2h12v7a6 6 0 11-12 0V2z"/></svg>
          </div>
          <p className={s.kpiLabel}>Deals Won (Month)</p>
          <p className={s.kpiSquareValue}>{admin.agencyDealsWon}</p>
          <p className={s.kpiHint}>
            {admin.agencyDealsWon > 0 ? fmtCurrency(admin.agencyDealsWonPremium) + ' premium' : 'No closed deals this month'}
          </p>
        </div>

        <div className={`${s.card} ${s.cardHover} ${s.kpiSquare}`} onClick={() => router.push('/dashboard/team?filter=invited')} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
          <div className={`${s.kpiIconChip} ${s.kpiIconChipRed}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </div>
          <p className={s.kpiLabel}>Pending Invites</p>
          <p className={s.kpiSquareValue} style={admin.pendingInvites > 0 ? { color: '#C99A3D' } : undefined}>
            {admin.pendingInvites}
          </p>
          <p className={s.kpiHint}>
            {admin.pendingInvites > 0 && admin.oldestInviteDays > 0
              ? `Oldest ${admin.oldestInviteDays}d ago`
              : 'All invites accepted'}
          </p>
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
      <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 400 }}>
        {loadError || 'No data returned from server.'}
      </p>
      <button
        onClick={() => loadData(userProfile)}
        style={{ marginTop: 8, padding: '10px 24px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
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
