/**
 * Email Reminders
 *
 * Sends a reminder email to every member of a group the day before their meeting.
 * Runs once per day at the configured time (default 8am server time).
 *
 * Required env vars:
 *   RESEND_API_KEY   — from resend.com (free tier: 3,000 emails/month)
 *   RESEND_FROM      — verified sender address, e.g. "Small Group Manager <no-reply@yourdomain.com>"
 *   APP_URL          — public URL of the app, e.g. "https://small-group-manager.onrender.com"
 *
 * Optional env vars:
 *   REMINDER_HOUR    — hour (0-23) to run the daily check, default 8 (8am server time)
 */

import { storage } from "./storage";
import { log } from "./index";

// ─── Resend email sender ─────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Small Group Manager <no-reply@example.com>";

  if (!apiKey) {
    log("RESEND_API_KEY not set — skipping email to " + to, "reminders");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    log(`Failed to send email to ${to}: ${res.status} ${body}`, "reminders");
  } else {
    log(`Reminder sent to ${to}`, "reminders");
  }
}

// ─── Build reminder email HTML ───────────────────────────────────────────────

function buildReminderHtml(params: {
  firstName: string;
  groupName: string;
  meetingTitle: string;
  meetingDate: string;   // e.g. "Thursday, April 17"
  meetingTime: string;   // e.g. "7:00 PM"
  location: string | null;
  appUrl: string;
}): string {
  const { firstName, groupName, meetingTitle, meetingDate, meetingTime, location, appUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meeting Reminder</title>
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
              <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Meeting Reminder</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hi ${firstName},</p>
              <p style="margin:0 0 20px;font-size:15px;color:#374151;">
                Just a reminder that <strong>${groupName}</strong> has a meeting tomorrow.
              </p>

              <!-- Meeting details box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111827;">${meetingTitle}</p>
                    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">📅 ${meetingDate} at ${meetingTime}</p>
                    ${location ? `<p style="margin:0;font-size:13px;color:#6b7280;">📍 ${location}</p>` : ""}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
                Open the app to sign up for food or leader slots if they're still available.
              </p>

              <a href="${appUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;">
                Open App
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You're receiving this because you're a member of ${groupName}. 
                Contact your group admin to update your email preferences.
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

// ─── Format helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(timeStr: string): string {
  // timeStr is "HH:MM" (24h)
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Core reminder logic ─────────────────────────────────────────────────────

export async function sendDailyReminders(): Promise<void> {
  const appUrl = process.env.APP_URL || "https://small-group-manager.onrender.com";

  // Get tomorrow's date string "YYYY-MM-DD"
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  log(`Checking for meetings on ${tomorrowStr}...`, "reminders");

  // Get all groups, find meetings scheduled for tomorrow
  const allGroups = storage.getAllGroups();
  let emailsSent = 0;

  for (const group of allGroups) {
    if (group.isArchived) continue;

    const meetings = storage.getMeetingsForGroup(group.id);
    const tomorrowMeetings = meetings.filter(m => m.date === tomorrowStr);

    for (const meeting of tomorrowMeetings) {
      // Get all members of this group
      const members = storage.getMembershipsForGroup(group.id);

      for (const member of members) {
        const user = storage.getUserById(member.userId);
        if (!user || !user.isActive || !user.email) continue;

        const html = buildReminderHtml({
          firstName: user.firstName,
          groupName: group.name,
          meetingTitle: meeting.title,
          meetingDate: formatDate(meeting.date),
          meetingTime: formatTime(meeting.startTime),
          location: meeting.location,
          appUrl,
        });

        await sendEmail(
          user.email,
          `Reminder: ${group.name} meets tomorrow`,
          html,
        );

        emailsSent++;
      }
    }
  }

  log(`Daily reminder run complete — ${emailsSent} email(s) sent`, "reminders");
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Starts a daily reminder job. Calculates ms until the next target hour,
 * fires once, then repeats every 24 hours.
 */
export function startReminderScheduler(): void {
  if (!process.env.RESEND_API_KEY) {
    log("RESEND_API_KEY not set — reminder scheduler disabled", "reminders");
    return;
  }

  const targetHour = parseInt(process.env.REMINDER_HOUR || "8", 10);

  function msUntilNextRun(): number {
    const now = new Date();
    const next = new Date();
    next.setHours(targetHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); // already past today's slot
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = msUntilNextRun();
    const nextRun = new Date(Date.now() + delay);
    log(`Next reminder run scheduled for ${nextRun.toLocaleString()}`, "reminders");

    setTimeout(async () => {
      await sendDailyReminders().catch(err =>
        log(`Reminder run error: ${err.message}`, "reminders")
      );
      scheduleNext(); // reschedule for next day
    }, delay);
  }

  scheduleNext();
  log(`Reminder scheduler started (runs daily at ${targetHour}:00 server time)`, "reminders");
}
