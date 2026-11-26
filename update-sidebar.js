const fs = require('fs');

const path = 'src/app/dashboard/layout.js';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('<aside');
const endIndex = content.indexOf('</aside>') + '</aside>'.length;

if (startIndex !== -1 && endIndex !== -1) {
  const newAside = `<aside style={{
        width: '260px',
        margin: '16px 0 16px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '32px 24px 24px 24px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', justifyContent: 'center' }}>
            <img 
              src="/new-nxt-logo.png" 
              alt="Logo" 
              style={{ width: '120px', objectFit: 'contain' }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/nxt-financial-group-logo.png';
                if(e.target.src.includes('nxt-financial-group-logo.png')) {
                  e.target.style.display = 'none';
                }
              }}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, textAlign: 'center', fontWeight: '500' }}>
            {userProfile?.role === 'admin' ? 'Agency Admin' : userProfile?.role === 'manager' ? 'Manager' : 'Agent'}
          </p>
        </div>
        
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Link href="/dashboard/getting-started" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname === '/dashboard/getting-started' ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname === '/dashboard/getting-started' ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname === '/dashboard/getting-started' ? '600' : '500'
          }}>
            Getting Started
          </Link>
          <Link href="/dashboard" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname === '/dashboard' ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname === '/dashboard' ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname === '/dashboard' ? '600' : '500'
          }}>
            Home
          </Link>
          <Link href="/dashboard/leads" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname.startsWith('/dashboard/leads') ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname.startsWith('/dashboard/leads') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname.startsWith('/dashboard/leads') ? '600' : '500'
          }}>
            Contacts & Leads
          </Link>
          <Link href="/dashboard/pipeline" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname.startsWith('/dashboard/pipeline') ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname.startsWith('/dashboard/pipeline') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname.startsWith('/dashboard/pipeline') ? '600' : '500'
          }}>
            Pipeline
          </Link>
          <Link href="/dashboard/tasks" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname.startsWith('/dashboard/tasks') ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname.startsWith('/dashboard/tasks') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname.startsWith('/dashboard/tasks') ? '600' : '500'
          }}>
            Tasks
          </Link>

          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
            <Link href="/dashboard/team" style={{
              display: 'block',
              padding: '12px 16px',
              borderRadius: '12px',
              color: pathname === '/dashboard/team' ? 'var(--brand-navy)' : 'var(--text-secondary)',
              backgroundColor: pathname === '/dashboard/team' ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: pathname === '/dashboard/team' ? '600' : '500'
            }}>
              Team Dashboard
            </Link>
          )}

          <Link href="/dashboard/reports" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname.startsWith('/dashboard/reports') ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname.startsWith('/dashboard/reports') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname.startsWith('/dashboard/reports') ? '600' : '500'
          }}>
            Reports
          </Link>
          
          <Link href="/dashboard/commissions" style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: '12px',
            color: pathname === '/dashboard/commissions' || (pathname.startsWith('/dashboard/commissions/') && !pathname.includes('import') && !pathname.includes('needs-review')) ? 'var(--brand-navy)' : 'var(--text-secondary)',
            backgroundColor: pathname === '/dashboard/commissions' || (pathname.startsWith('/dashboard/commissions/') && !pathname.includes('import') && !pathname.includes('needs-review')) ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: pathname === '/dashboard/commissions' || (pathname.startsWith('/dashboard/commissions/') && !pathname.includes('import') && !pathname.includes('needs-review')) ? '600' : '500'
          }}>
            Commissions
          </Link>

          {userProfile?.role === 'admin' && (
            <>
              <div style={{ padding: '16px 16px 8px 16px', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '8px' }}>
                Admin Tools
              </div>
              <Link href="/dashboard/commissions/needs-review" style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: '12px',
                color: pathname.includes('needs-review') ? 'var(--brand-navy)' : 'var(--text-secondary)',
                backgroundColor: pathname.includes('needs-review') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: pathname.includes('needs-review') ? '600' : '500'
              }}>
                Needs Review
              </Link>
              <Link href="/dashboard/commissions/import" style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: '12px',
                color: pathname.includes('/import') ? 'var(--brand-navy)' : 'var(--text-secondary)',
                backgroundColor: pathname.includes('/import') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: pathname.includes('/import') ? '600' : '500'
              }}>
                Import Statement
              </Link>
              <Link href="/dashboard/settings/commissions" style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: '12px',
                color: pathname.includes('/settings/commissions') ? 'var(--brand-navy)' : 'var(--text-secondary)',
                backgroundColor: pathname.includes('/settings/commissions') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: pathname.includes('/settings/commissions') ? '600' : '500'
              }}>
                Carriers & Rates
              </Link>
              <Link href="/dashboard/settings/agent-levels" style={{
                display: 'block',
                padding: '12px 16px',
                borderRadius: '12px',
                color: pathname.includes('agent-levels') ? 'var(--brand-navy)' : 'var(--text-secondary)',
                backgroundColor: pathname.includes('agent-levels') ? 'rgba(201, 154, 61, 0.15)' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: pathname.includes('agent-levels') ? '600' : '500'
              }}>
                Agent Levels
              </Link>
            </>
          )}
        </nav>
        
        <div style={{ padding: '24px', borderTop: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'rgba(255,255,255,0.4)' }}>
          <button 
            onClick={() => setIsTaskModalOpen(true)}
            style={{ 
              width: '100%', 
              padding: '12px', 
              backgroundColor: 'var(--brand-gold)', 
              color: 'var(--brand-navy)', 
              border: 'none', 
              borderRadius: '12px', 
              cursor: 'pointer',
              fontWeight: '600',
              marginBottom: '16px',
              boxShadow: '0 4px 12px rgba(201, 154, 61, 0.2)'
            }}
          >
            + Quick Task
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', color: 'var(--brand-navy)', fontWeight: '600' }}>
              {userProfile?.full_name}
            </div>
            <button 
              onClick={() => auth.signOut()}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                padding: 0,
                textDecoration: 'none'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>`;

  content = content.substring(0, startIndex) + newAside + content.substring(endIndex);
  fs.writeFileSync(path, content);
  console.log("Updated layout.js sidebar successfully.");
} else {
  console.error("Could not find <aside> block.");
}
