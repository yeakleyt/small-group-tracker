/**
 * Shared email sending utility using Resend.
 * Required env vars: RESEND_API_KEY, RESEND_FROM
 */

const FROM = () => process.env.RESEND_FROM || "Small Group Manager <no-reply@example.com>";

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping email to ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM(), to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[email] Failed to send to ${to}: ${res.status} ${body}`);
  } else {
    console.log(`[email] Sent to ${to}: ${subject}`);
  }
}

export function buildInviteEmailHtml(params: {
  invitedByName: string;
  groupName: string | null;
  inviteUrl: string;
}): string {
  const { invitedByName, groupName, inviteUrl } = params;

  const groupLine = groupName
    ? `<p style="margin:0 0 20px;font-size:15px;color:#374151;">
         You've been invited by <strong>${invitedByName}</strong> to join
         <strong>${groupName}</strong> on Small Group Manager.
       </p>`
    : `<p style="margin:0 0 20px;font-size:15px;color:#374151;">
         You've been invited by <strong>${invitedByName}</strong> to join
         Small Group Manager.
       </p>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You're Invited</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#3730a3;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">Small Group Manager</p>
              <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">You have an invitation</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hi there,</p>
              ${groupLine}
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
                Click the button below to create your account and get started.
                This invitation link expires in 7 days and can only be used once.
              </p>
              <a href="${inviteUrl}"
                 style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">
                Accept Invitation
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                If you weren't expecting this invitation you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
