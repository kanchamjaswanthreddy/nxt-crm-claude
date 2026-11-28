import { Resend } from 'resend';

let resendClient = null;

function getResend() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    resendClient = new Resend(key);
  }
  return resendClient;
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'NXT CRM <onboarding@resend.dev>';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const LOGO_URL = `${BASE_URL}/new-nxt-logo.png`;

// M-14: Retry wrapper — 2 retries with 1s delay between attempts
async function sendWithRetry(resend, payload, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const { data, error } = await resend.emails.send(payload);
    if (!error) return data;
    lastError = error;
  }
  throw new Error(lastError?.message || 'Failed to send email after retries');
}

// ─── Shared email wrapper ───────────────────────────────────────
function emailLayout(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>NXT CRM</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, 'SF Pro Display', 'Inter', 'Segoe UI', system-ui, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F3F4F6;">
    <tr>
      <td align="center" style="padding: 40px 16px 48px 16px;">

        <!-- Logo header -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="${LOGO_URL}" alt="NXT CRM" height="44" style="height: 44px; width: auto; display: block;" />
            </td>
          </tr>
        </table>

        <!-- Main card -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03);">

          ${content}

        </table>

        <!-- Footer -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          <tr>
            <td style="padding: 32px 24px 0 24px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} NXT Financial Group, NXT World Holdings, Inc. All Rights Reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #D1D5DB; line-height: 1.5;">
                This is an automated message from NXT CRM. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Invite Email ───────────────────────────────────────────────
export async function sendInviteEmail({ to, inviteLink, role, agencyName }) {
  const resend = getResend();
  const roleLabel = role === 'admin' ? 'Admin' : 'Agent';

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <!-- Icon circle -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(201, 154, 61, 0.15); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/C99A3D/new-post.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          You're Invited
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          Join <strong style="color: #FFFFFF;">${agencyName || 'NXT CRM'}</strong> and start building your business
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px;">

        <!-- Role badge -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="padding: 6px 20px; background-color: rgba(15, 42, 82, 0.06); border-radius: 999px; font-size: 13px; font-weight: 600; color: #0F2A52; text-align: center;">
              You've been invited as ${roleLabel}
            </td>
          </tr>
        </table>

        <!-- Info text -->
        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7; text-align: center;">
          Click the button below to create your account and get started with onboarding. You'll set up your profile, licensing details, and compliance information.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${inviteLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                Accept Invitation
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding: 0 40px;">
        <div style="height: 1px; background-color: #E5E7EB; margin: 24px 0;"></div>
      </td>
    </tr>

    <!-- Copy link section -->
    <tr>
      <td style="padding: 0 40px 12px 40px;">
        <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em;">
          Or copy this link
        </p>
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px 16px;">
          <p style="margin: 0; font-size: 12px; color: #0F2A52; word-break: break-all; font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.5;">
            ${inviteLink}
          </p>
        </div>
      </td>
    </tr>

    <!-- What to expect -->
    <tr>
      <td style="padding: 20px 40px 40px 40px;">
        <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #0F2A52;">
          What happens next
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">1</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Create your account</strong> — set your name and password
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">2</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Complete onboarding</strong> — personal info, licensing & compliance
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">3</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Start working</strong> — access your CRM dashboard and begin
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Expiry notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          This invite expires in <strong style="color: #6B7280;">7 days</strong>. If you didn't expect this email, you can safely ignore it.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `You've been invited to join ${agencyName || 'NXT CRM'}`,
    html,
  });
}

// ─── Approval Email ─────────────────────────────────────────────
export async function sendApprovalEmail({ to, name }) {
  const resend = getResend();
  const loginLink = `${BASE_URL}/auth/login`;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(47, 168, 79, 0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/2FA84F/checkmark.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          You're Approved!
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          ${name ? `Congratulations ${name},` : 'Congratulations,'} your account has been approved
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 15px; color: #6B7280; line-height: 1.7;">
          Your onboarding application has been reviewed and approved by the admin team. You now have full access to the NXT CRM dashboard.
        </p>
        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7;">
          Sign in to start managing your business, leads, and commissions.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${loginLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                Sign In to NXT CRM
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          Welcome to the NXT Financial Group family. If you have any questions, reach out to your upline or admin.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: 'You\'ve been approved — Welcome to NXT CRM!',
    html,
  });
}

// ─── Admin Notification Email ───────────────────────────────────
export async function sendAdminNotificationEmail({ to, agentName, agentEmail, agentRole }) {
  const resend = getResend();
  const reviewLink = `${BASE_URL}/dashboard/admin/approvals`;
  const roleLabel = agentRole === 'it_engineer' ? 'IT Engineer' : agentRole.charAt(0).toUpperCase() + agentRole.slice(1);

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(201, 154, 61, 0.15); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/C99A3D/user-shield.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          New Agent Awaiting Approval
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          An agent has completed onboarding and needs your review
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px;">
        <!-- Agent info card -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Name</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">${agentName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Email</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right;">${agentEmail}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Role</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right;">${roleLabel}</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 24px 0; font-size: 15px; color: #6B7280; line-height: 1.7; text-align: center;">
          Please review their details and approve or reject their application in the CRM.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${reviewLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                Review Application
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          This notification was sent because you are an admin of this NXT CRM agency.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `New agent awaiting approval: ${agentName}`,
    html,
  });
}

// ─── Document Approved Email ───────────────────────────────────
export async function sendDocumentApprovedEmail({ to, name, docTypeLabel }) {
  const resend = getResend();
  const docsLink = `${BASE_URL}/dashboard/business/documents`;
  const firstName = name ? name.split(' ')[0] : null;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(47, 168, 79, 0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/2FA84F/checkmark.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          Document Approved
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          ${firstName ? `${firstName}, your` : 'Your'} document has been reviewed and approved
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px; text-align: center;">
        <!-- Document info card -->
        <div style="background-color: #F0FFF4; border: 1px solid #C6F6D5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Document</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">${docTypeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Status</td>
              <td style="padding: 4px 0; font-size: 14px; text-align: right;">
                <span style="display: inline-block; padding: 2px 12px; background-color: #D4EDDA; color: #155724; border-radius: 999px; font-size: 12px; font-weight: 700;">Approved</span>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7;">
          Your <strong style="color: #111827;">${docTypeLabel}</strong> has been reviewed and approved by the admin team. No further action is needed for this document.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${docsLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                View My Documents
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          If you have any questions, reach out to your upline or admin.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `Document Approved: ${docTypeLabel}`,
    html,
  });
}

// ─── Document Rejected Email ──────────────────────────────────
export async function sendDocumentRejectedEmail({ to, name, docTypeLabel, reason }) {
  const resend = getResend();
  const docsLink = `${BASE_URL}/dashboard/business/documents`;
  const firstName = name ? name.split(' ')[0] : null;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(220, 53, 69, 0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/DC3545/cancel.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          Document Needs Attention
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          ${firstName ? `${firstName}, a` : 'A'} document you submitted requires changes
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px; text-align: center;">
        <!-- Document info card -->
        <div style="background-color: #FFF5F5; border: 1px solid #FED7D7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Document</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">${docTypeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Status</td>
              <td style="padding: 4px 0; font-size: 14px; text-align: right;">
                <span style="display: inline-block; padding: 2px 12px; background-color: #F8D7DA; color: #721C24; border-radius: 999px; font-size: 12px; font-weight: 700;">Rejected</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Reason box -->
        <div style="background-color: #FFF8F0; border-left: 4px solid #C99A3D; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px; text-align: left;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF;">
            Reason from Admin
          </p>
          <p style="margin: 0; font-size: 15px; color: #111827; line-height: 1.6; font-weight: 500;">
            ${reason || 'Document did not meet requirements.'}
          </p>
        </div>

        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7;">
          Please review the reason above and re-upload a corrected version of your <strong style="color: #111827;">${docTypeLabel}</strong>.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${docsLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                Re-upload Document
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          If you believe this was a mistake or need help, reach out to your upline or admin.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `Action Required: ${docTypeLabel} needs to be re-uploaded`,
    html,
  });
}

// ─── Payment Reminder Email ─────────────────────────────────────
export async function sendPaymentReminderEmail({ to, name }) {
  const resend = getResend();
  const billingLink = `${BASE_URL}/dashboard/billing`;
  const firstName = name ? name.split(' ')[0] : null;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(220, 53, 69, 0.2); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/DC3545/bank-card-missing.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          Payment Details Required
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          ${firstName ? `${firstName}, please` : 'Please'} add your card to keep your account active
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px; text-align: center;">
        <!-- Warning card -->
        <div style="background-color: #FFF5F5; border: 1px solid #FED7D7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Status</td>
              <td style="padding: 4px 0; font-size: 14px; text-align: right;">
                <span style="display: inline-block; padding: 2px 12px; background-color: #F8D7DA; color: #721C24; border-radius: 999px; font-size: 12px; font-weight: 700;">Card Missing</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Action</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">Add payment method</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7;">
          Our records show your account does not have a payment method on file. To continue using NXT CRM without interruption, please add your card details as soon as possible.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #DC3545 0%, #E04A59 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(220, 53, 69, 0.35);">
              <a href="${billingLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #FFFFFF; text-decoration: none; letter-spacing: 0.02em;">
                Add Payment Method
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Steps -->
    <tr>
      <td style="padding: 20px 40px 40px 40px;">
        <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 700; color: #0F2A52;">
          How to add your card
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">1</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Sign in</strong> to your NXT CRM dashboard
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">2</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Go to Settings</strong> &rarr; Billing
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 28px;">
              <div style="width: 22px; height: 22px; background-color: rgba(47, 168, 79, 0.1); border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 700; color: #2FA84F;">3</div>
            </td>
            <td style="padding: 8px 0 8px 12px; font-size: 13px; color: #6B7280; line-height: 1.5;">
              <strong style="color: #111827;">Enter your card details</strong> and save
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          If you've already added your payment details, you can safely ignore this email. Contact your upline or admin if you need help.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `Action Required: Add your payment details to NXT CRM`,
    html,
  });
}

// ─── Ticket Update Email ───────────────────────────────────────
export async function sendTicketUpdateEmail({ to, name, ticketNumber, subject, updateType, detail }) {
  const resend = getResend();
  const ticketsLink = `${BASE_URL}/dashboard/help`;
  const firstName = name ? name.split(' ')[0] : null;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 48px 40px 40px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td style="width: 64px; height: 64px; background-color: rgba(201, 154, 61, 0.15); border-radius: 50%; text-align: center; vertical-align: middle;">
              <img src="https://img.icons8.com/sf-regular-filled/48/C99A3D/ticket.png" alt="" width="28" height="28" style="display: inline-block; vertical-align: middle;" />
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">
          Ticket Updated
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.65); line-height: 1.5;">
          ${firstName ? `${firstName}, there's` : 'There\'s'} an update on your support ticket
        </p>
      </td>
    </tr>

    <!-- Body content -->
    <tr>
      <td style="padding: 40px 40px 16px 40px;">
        <!-- Ticket info card -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Ticket</td>
              <td style="padding: 4px 0; font-size: 14px; color: #0F2A52; text-align: right; font-weight: 700;">${ticketNumber}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Subject</td>
              <td style="padding: 4px 0; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-size: 13px; color: #9CA3AF; font-weight: 600;">Update</td>
              <td style="padding: 4px 0; font-size: 14px; text-align: right;">
                <span style="display: inline-block; padding: 2px 12px; background-color: rgba(201, 154, 61, 0.12); color: #8B6914; border-radius: 999px; font-size: 12px; font-weight: 700;">${updateType}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Detail box -->
        <div style="background-color: #FFF8F0; border-left: 4px solid #C99A3D; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px; text-align: left;">
          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF;">
            What Changed
          </p>
          <p style="margin: 0; font-size: 15px; color: #111827; line-height: 1.6; font-weight: 500;">
            ${detail}
          </p>
        </div>

        <p style="margin: 0 0 32px 0; font-size: 15px; color: #6B7280; line-height: 1.7; text-align: center;">
          Log in to view the full ticket details and respond if needed.
        </p>

        <!-- CTA Button -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${ticketsLink}" target="_blank" style="display: inline-block; padding: 16px 48px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                View Ticket
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 16px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          You are receiving this because you created ticket ${ticketNumber}. If you have questions, reply to the ticket in NXT CRM.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `[${ticketNumber}] ${updateType} — ${subject}`,
    html,
  });
}

// ─── Welcome & Verification Email ──────────────────────────────
export async function sendVerificationEmail({ to, verificationLink, name }) {
  const resend = getResend();
  const firstName = name ? name.split(' ')[0] : null;

  const content = `
    <!-- Navy hero banner -->
    <tr>
      <td style="background: linear-gradient(135deg, #0F2A52 0%, #163566 50%, #1B3A6B 100%); padding: 56px 40px 48px 40px; text-align: center;">
        <p style="margin: 0 0 16px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #C99A3D;">
          Welcome to NXT Financial Group
        </p>
        <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em; line-height: 1.3;">
          ${firstName ? `${firstName}, your journey starts here.` : 'Your journey starts here.'}
        </h1>
        <p style="margin: 0; font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.6; max-width: 400px; display: inline-block;">
          Verify your email to activate your account and begin building your financial services career.
        </p>
      </td>
    </tr>

    <!-- Verify CTA -->
    <tr>
      <td style="padding: 40px 40px 8px 40px; text-align: center;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
          <tr>
            <td style="background: linear-gradient(135deg, #C99A3D 0%, #D4A94D 100%); border-radius: 999px; text-align: center; box-shadow: 0 4px 14px rgba(201, 154, 61, 0.35);">
              <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 16px 52px; font-size: 16px; font-weight: 700; color: #0F2A52; text-decoration: none; letter-spacing: 0.02em;">
                Verify My Email
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0 0; font-size: 12px; color: #9CA3AF;">
          This link expires in 24 hours
        </p>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding: 8px 40px 0 40px;">
        <div style="height: 1px; background-color: #E5E7EB; margin: 24px 0;"></div>
      </td>
    </tr>

    <!-- What's next section -->
    <tr>
      <td style="padding: 8px 40px 0 40px;">
        <p style="margin: 0 0 20px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9CA3AF;">
          What happens after you verify
        </p>
      </td>
    </tr>

    <!-- Step 1 -->
    <tr>
      <td style="padding: 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td style="width: 44px; vertical-align: top;">
              <div style="width: 36px; height: 36px; background-color: rgba(15, 42, 82, 0.06); border-radius: 10px; text-align: center; line-height: 36px; font-size: 14px; font-weight: 800; color: #0F2A52;">1</div>
            </td>
            <td style="vertical-align: top; padding-top: 2px;">
              <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 700; color: #111827;">Complete your profile</p>
              <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.5;">Personal details, employment history, and licensing information.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Step 2 -->
    <tr>
      <td style="padding: 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td style="width: 44px; vertical-align: top;">
              <div style="width: 36px; height: 36px; background-color: rgba(15, 42, 82, 0.06); border-radius: 10px; text-align: center; line-height: 36px; font-size: 14px; font-weight: 800; color: #0F2A52;">2</div>
            </td>
            <td style="vertical-align: top; padding-top: 2px;">
              <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 700; color: #111827;">Get approved</p>
              <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.5;">Our team reviews your application — most are approved within 24 hours.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Step 3 -->
    <tr>
      <td style="padding: 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 8px;">
          <tr>
            <td style="width: 44px; vertical-align: top;">
              <div style="width: 36px; height: 36px; background-color: rgba(15, 42, 82, 0.06); border-radius: 10px; text-align: center; line-height: 36px; font-size: 14px; font-weight: 800; color: #0F2A52;">3</div>
            </td>
            <td style="vertical-align: top; padding-top: 2px;">
              <p style="margin: 0 0 2px 0; font-size: 14px; font-weight: 700; color: #111827;">Start selling</p>
              <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.5;">Access 70+ carrier appointments, training, and your full back-office dashboard.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding: 8px 40px 0 40px;">
        <div style="height: 1px; background-color: #E5E7EB; margin: 16px 0;"></div>
      </td>
    </tr>

    <!-- Why NXT highlights -->
    <tr>
      <td style="padding: 8px 40px 0 40px;">
        <p style="margin: 0 0 16px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9CA3AF;">
          Why agents choose NXT
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 40px 24px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 50%; padding: 8px 8px 8px 0; vertical-align: top;">
              <div style="background-color: #F9FAFB; border-radius: 10px; padding: 14px 16px;">
                <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0F2A52; letter-spacing: -0.02em;">130%</p>
                <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.4;">Top-tier contracts with room to grow to 160% total comp</p>
              </div>
            </td>
            <td style="width: 50%; padding: 8px 0 8px 8px; vertical-align: top;">
              <div style="background-color: #F9FAFB; border-radius: 10px; padding: 14px 16px;">
                <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0F2A52; letter-spacing: -0.02em;">70+</p>
                <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.4;">A-rated carrier appointments nationwide</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 8px 8px 8px 0; vertical-align: top;">
              <div style="background-color: #F9FAFB; border-radius: 10px; padding: 14px 16px;">
                <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0F2A52; letter-spacing: -0.02em;">Weekly</p>
                <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.4;">Paid every Friday — no monthly delays</p>
              </div>
            </td>
            <td style="width: 50%; padding: 8px 0 8px 8px; vertical-align: top;">
              <div style="background-color: #F9FAFB; border-radius: 10px; padding: 14px 16px;">
                <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0F2A52; letter-spacing: -0.02em;">100%</p>
                <p style="margin: 0; font-size: 11px; color: #6B7280; line-height: 1.4;">You own your book — immediate release, no lock-in</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Quote / Promise -->
    <tr>
      <td style="padding: 0 40px 32px 40px;">
        <div style="background: linear-gradient(135deg, #0F2A52 0%, #1B3A6B 100%); border-radius: 12px; padding: 24px 28px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #C99A3D;">
            The NXT Promise
          </p>
          <p style="margin: 0; font-size: 15px; font-weight: 600; color: #FFFFFF; line-height: 1.5; font-style: italic;">
            &ldquo;Build a career worth having. Own a business worth keeping. Leave a legacy worth passing down.&rdquo;
          </p>
        </div>
      </td>
    </tr>

    <!-- Copy link fallback -->
    <tr>
      <td style="padding: 0 40px 24px 40px;">
        <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.06em;">
          Button not working? Copy this link
        </p>
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 10px 14px;">
          <p style="margin: 0; font-size: 11px; color: #0F2A52; word-break: break-all; font-family: 'SF Mono', 'Fira Code', monospace; line-height: 1.5;">
            ${verificationLink}
          </p>
        </div>
      </td>
    </tr>

    <!-- Footer notice -->
    <tr>
      <td style="background-color: #F9FAFB; padding: 20px 40px; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #9CA3AF; text-align: center; line-height: 1.5;">
          Questions? Reply to this email or contact us at <a href="tel:8572053333" style="color: #0F2A52; font-weight: 600; text-decoration: none;">857-205-3333</a>
        </p>
        <p style="margin: 0; font-size: 11px; color: #D1D5DB; text-align: center; line-height: 1.5;">
          If you didn't create this account, you can safely ignore this email.
        </p>
      </td>
    </tr>
  `;

  const html = emailLayout(content);

  return await sendWithRetry(resend, {
    from: FROM_ADDRESS,
    to,
    subject: `${firstName ? firstName + ', welcome' : 'Welcome'} to NXT Financial Group — verify your email`,
    html,
  });
}

// ─── Today's schedule (calendar reminder) ─────────────────────
const escHtml = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendScheduleEmail({ to, name, dayLabel, items }) {
  const resend = getResend();
  const firstName = name ? name.split(' ')[0] : null;
  const rows = items.map(i => `
        <tr>
          <td style="padding: 14px 0; border-bottom: 1px solid #E7E3DA; width: 150px; font-size: 14px; color: #5F5C56; vertical-align: top;">${escHtml(i.when)}</td>
          <td style="padding: 14px 0; border-bottom: 1px solid #E7E3DA; font-size: 16px; color: #0C1022; font-weight: 600;">${escHtml(i.title)}${i.link ? `<br><a href="${escHtml(i.link)}" style="font-size: 14px; font-weight: 500; color: #8A5A0B;">Join meeting</a>` : ''}</td>
        </tr>`).join('');
  const content = `
    <tr>
      <td style="background: #0C1022; padding: 40px 40px 34px 40px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #F5D9A0;">${escHtml(dayLabel)}</p>
        <h1 style="margin: 0; font-size: 28px; font-weight: 400; color: #ffffff;">${firstName ? `${escHtml(firstName)}, here` : 'Here'} is your schedule</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 26px 40px 34px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">${rows}</table>
        <p style="margin: 26px 0 0 0;"><a href="${BASE_URL}/dashboard/calendar" style="display: inline-block; padding: 13px 26px; border-radius: 999px; background: #0C1022; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none;">Open Calendar</a></p>
      </td>
    </tr>
  `;
  return await sendWithRetry(resend, { from: FROM_ADDRESS, to, subject: `Your schedule for ${dayLabel}: ${items.length} ${items.length === 1 ? 'event' : 'events'}`, html: emailLayout(content) });
}
