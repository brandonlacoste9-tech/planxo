import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const BASE_URL = 'https://rdv-qc.vercel.app';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Toronto',
  });
}

// Shared dark cognac styles
const palette = {
  bg: '#1a1208',
  surface: '#241a0d',
  border: '#3d2e1a',
  gold: '#c8a96e',
  goldLight: '#e0c48a',
  text: '#f5efe6',
  muted: '#9a8870',
};

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Planxo</title>
</head>
<body style="margin:0;padding:0;background-color:${palette.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${palette.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${palette.bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${palette.surface};border-radius:12px;border:1px solid ${palette.border};overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2a1c0e 0%,#3d2a12 100%);padding:32px 40px;border-bottom:2px solid ${palette.gold};">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:${palette.gold};letter-spacing:2px;text-transform:uppercase;">
                PLANXO
              </h1>
              <p style="margin:4px 0 0;font-size:12px;color:${palette.muted};letter-spacing:1px;text-transform:uppercase;">
                Gestion de rendez-vous
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid ${palette.border};text-align:center;">
              <p style="margin:0;font-size:12px;color:${palette.muted};">
                © ${new Date().getFullYear()} Planxo — Tous droits réservés
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${palette.muted};">
                Ce courriel a été généré automatiquement. Veuillez ne pas y répondre directement.
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

// ── sendBookingConfirmation ───────────────────────────────────────────────────

export interface BookingConfirmationParams {
  to: string;
  guestName: string;
  hostName: string;
  eventTitle: string;
  startTime: string | Date;
  endTime: string | Date;
  meetingUrl?: string;
  uid: string;
}

export async function sendBookingConfirmation(params: BookingConfirmationParams) {
  const { to, guestName, hostName, eventTitle, startTime, endTime, meetingUrl, uid } = params;

  const formattedStart = formatDateTime(startTime);
  const formattedEnd = formatDateTime(endTime);
  const cancelUrl = `${BASE_URL}/booking/${uid}/cancel`;
  const rescheduleUrl = `${BASE_URL}/booking/${uid}/reschedule`;

  const meetingBlock = meetingUrl
    ? `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
          <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Lien de réunion</span><br/>
          <a href="${meetingUrl}" style="color:${palette.gold};font-size:15px;font-weight:600;text-decoration:none;">${meetingUrl}</a>
        </td>
      </tr>`
    : '';

  const content = `
    <!-- Greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${palette.goldLight};">
      Bonjour ${guestName} !
    </h2>
    <p style="margin:0 0 32px;font-size:15px;color:${palette.muted};line-height:1.6;">
      Votre rendez-vous est confirmé. Voici les détails :
    </p>

    <!-- Details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background-color:${palette.bg};border-radius:8px;border:1px solid ${palette.border};margin-bottom:32px;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Événement</span><br/>
                <span style="font-size:18px;font-weight:700;color:${palette.gold};">${eventTitle}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Avec</span><br/>
                <span style="font-size:15px;font-weight:600;color:${palette.text};">${hostName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Date et heure de début</span><br/>
                <span style="font-size:15px;font-weight:600;color:${palette.text};">${formattedStart}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Heure de fin</span><br/>
                <span style="font-size:15px;font-weight:600;color:${palette.text};">${formattedEnd}</span>
              </td>
            </tr>
            ${meetingBlock}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA buttons -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td style="padding-right:12px;">
          <a href="${rescheduleUrl}"
            style="display:inline-block;padding:12px 24px;background-color:${palette.gold};color:#1a1208;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
            Reprogrammer
          </a>
        </td>
        <td>
          <a href="${cancelUrl}"
            style="display:inline-block;padding:12px 24px;background-color:transparent;color:${palette.muted};font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;border:1px solid ${palette.border};letter-spacing:0.5px;">
            Annuler
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${palette.muted};line-height:1.6;">
      Si vous avez des questions, veuillez contacter votre hôte directement.<br/>
      Merci de votre confiance envers <strong style="color:${palette.gold};">Planxo</strong>.
    </p>
  `;

  return resend.emails.send({
    from: 'Planxo <onboarding@resend.dev>',
    to,
    subject: `Confirmation : ${eventTitle} avec ${hostName}`,
    html: emailWrapper(content),
  });
}

// ── sendBookingNotificationToHost ─────────────────────────────────────────────

export interface BookingNotificationToHostParams {
  to: string;
  hostName: string;
  guestName: string;
  eventTitle: string;
  startTime: string | Date;
  meetingUrl?: string;
}

export async function sendBookingNotificationToHost(params: BookingNotificationToHostParams) {
  const { to, hostName, guestName, eventTitle, startTime, meetingUrl } = params;

  const formattedStart = formatDateTime(startTime);

  const meetingBlock = meetingUrl
    ? `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
          <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Lien de réunion</span><br/>
          <a href="${meetingUrl}" style="color:${palette.gold};font-size:15px;font-weight:600;text-decoration:none;">${meetingUrl}</a>
        </td>
      </tr>`
    : '';

  const content = `
    <!-- Greeting -->
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${palette.goldLight};">
      Bonjour ${hostName} !
    </h2>
    <p style="margin:0 0 32px;font-size:15px;color:${palette.muted};line-height:1.6;">
      Vous avez un nouveau rendez-vous. Voici les détails :
    </p>

    <!-- Details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background-color:${palette.bg};border-radius:8px;border:1px solid ${palette.border};margin-bottom:32px;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Événement</span><br/>
                <span style="font-size:18px;font-weight:700;color:${palette.gold};">${eventTitle}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid ${palette.border};">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Invité</span><br/>
                <span style="font-size:15px;font-weight:600;color:${palette.text};">${guestName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 0;${meetingUrl ? 'border-bottom:1px solid ' + palette.border + ';' : ''}">
                <span style="font-size:13px;color:${palette.muted};text-transform:uppercase;letter-spacing:1px;">Date et heure</span><br/>
                <span style="font-size:15px;font-weight:600;color:${palette.text};">${formattedStart}</span>
              </td>
            </tr>
            ${meetingBlock}
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${palette.muted};line-height:1.6;">
      Connectez-vous à votre tableau de bord <strong style="color:${palette.gold};">Planxo</strong> pour gérer ce rendez-vous.
    </p>
  `;

  return resend.emails.send({
    from: 'Planxo <onboarding@resend.dev>',
    to,
    subject: `Nouveau rendez-vous : ${guestName} — ${eventTitle}`,
    html: emailWrapper(content),
  });
}
