// Resend usage examples for both flavors.
// Install:  npm i resend @react-email/components
//           (and @react-email/render if you want to pre-render to a string)

import { Resend } from 'resend';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { MagicLinkEmail, subjectFor, type MagicLinkKind } from './MagicLinkEmail';
import { AdminNotifyEmail, adminSubjectFor, type AdminNotifyKind } from './AdminNotifyEmail';
import {
  SubmissionStatusEmail, statusSubjectFor, type SubmissionStatusKind,
} from './SubmissionStatusEmail';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = 'The Grandest Slam <noreply@thegrandestslam.no>';
const ADMIN_RECIPIENTS = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean);

// ───────────────────────────────────────────────────────────────────────────
// Flavor 1 — React Email component (recommended)
// ───────────────────────────────────────────────────────────────────────────

export async function sendMagicLinkReact(opts: {
  kind: MagicLinkKind;
  to: string;
  name: string;
  magicUrl: string;
  teamName?: string;
  partnerName?: string;
  partnerSkill?: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: subjectFor(opts.kind),
    react: (
      <MagicLinkEmail
        kind={opts.kind}
        name={opts.name}
        magicUrl={opts.magicUrl}
        teamName={opts.teamName}
        partnerName={opts.partnerName}
        partnerSkill={opts.partnerSkill}
      />
    ),
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Flavor 2 — Plain HTML template with token replacement
// ───────────────────────────────────────────────────────────────────────────

const TEMPLATE = readFileSync(new URL('./magic-link.html', import.meta.url), 'utf8');

export async function sendMagicLinkHtml(opts: {
  kind: MagicLinkKind;
  to: string;
  name: string;
  magicUrl: string;
  teamName?: string;
  partnerName?: string;
  partnerSkill?: string;
}) {
  const html = TEMPLATE
    .replaceAll('{{kind}}',          opts.kind)
    .replaceAll('{{name}}',          opts.name)
    .replaceAll('{{magic_url}}',     opts.magicUrl)
    .replaceAll('{{team_name}}',     opts.teamName ?? '')
    .replaceAll('{{partner_name}}',  opts.partnerName ?? '')
    .replaceAll('{{partner_skill}}', opts.partnerSkill ?? '');

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: subjectFor(opts.kind),
    html,
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Example calls — four flows
// ───────────────────────────────────────────────────────────────────────────

// Sign-in:
// await sendMagicLinkReact({ kind: 'signin', to: 'ola@x.no', name: 'Ola',
//                            magicUrl: 'https://thegrandestslam.no/auth/m/abc123' });

// Solo signup approved by admin (sign-in link):
// await sendMagicLinkReact({ kind: 'approved', to: 'ola@x.no', name: 'Ola',
//                            magicUrl: 'https://thegrandestslam.no/auth/m/abc123' });

// Team signup approved by admin (each teammate gets one, sign-in link):
// await sendMagicLinkReact({ kind: 'approved-team', to: 'ola@x.no', name: 'Ola',
//                            magicUrl: 'https://thegrandestslam.no/auth/m/abc123',
//                            teamName: 'Slagferdig', partnerName: 'Kari Nordmann' });

// Team-assigned (solo signups who have been paired by the organisers):
// await sendMagicLinkReact({ kind: 'team-assigned', to: 'ola@x.no', name: 'Ola',
//                            magicUrl: 'https://thegrandestslam.no/dashboard',
//                            partnerName: 'Kari Nordmann', partnerSkill: 'Avansert' });

// ───────────────────────────────────────────────────────────────────────────
// Admin notification — fires when a new signup hits the waitlist
// ───────────────────────────────────────────────────────────────────────────

export async function sendAdminNotify(payload: {
  kind: AdminNotifyKind;
  name: string;
  email: string;
  skill: string;
  signedUpAt: string;
  adminUrl: string;
  teamName?: string;
  partnerName?: string;
  partnerEmail?: string;
  partnerSkill?: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: ADMIN_RECIPIENTS,
    subject: adminSubjectFor(payload),
    react: <AdminNotifyEmail {...payload} />,
  });
}

// Solo signup:
// await sendAdminNotify({
//   kind: 'solo',
//   name: 'Ola Nordmann', email: 'ola@x.no', skill: 'Avansert',
//   signedUpAt: '21. mai 2026 · 14:32',
//   adminUrl: 'https://thegrandestslam.no/admin/signups/sg_9f3a2b',
// });

// Team signup:
// await sendAdminNotify({
//   kind: 'team',
//   teamName: 'Slagferdig',
//   name: 'Ola Nordmann',    email: 'ola@x.no',  skill: 'Avansert',
//   partnerName: 'Kari Hansen', partnerEmail: 'kari@x.no', partnerSkill: 'Mellomnivå',
//   signedUpAt: '21. mai 2026 · 14:32',
//   adminUrl: 'https://thegrandestslam.no/admin/signups/sg_9f3a2b',
// });

// ───────────────────────────────────────────────────────────────────────────
// Submission status — linkless emails (received + rejected)
// ───────────────────────────────────────────────────────────────────────────

export async function sendSubmissionStatus(opts: {
  kind: SubmissionStatusKind;
  to: string;
  name: string;
  teamName?: string;
  partnerName?: string;
  reason?: string | null;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: statusSubjectFor(opts.kind, { teamName: opts.teamName }),
    react: (
      <SubmissionStatusEmail
        kind={opts.kind}
        name={opts.name}
        teamName={opts.teamName}
        partnerName={opts.partnerName}
        reason={opts.reason}
      />
    ),
  });
}

// Plain-HTML flavor for the submission-status template. Handles stripping the optional
// reason block when no reason is provided.
const STATUS_TEMPLATE = readFileSync(new URL('./submission-status.html', import.meta.url), 'utf8');

export async function sendSubmissionStatusHtml(opts: {
  kind: SubmissionStatusKind;
  to: string;
  name: string;
  teamName?: string;
  partnerName?: string;
  reason?: string | null;
}) {
  const hasReason = opts.reason != null && opts.reason.trim().length > 0;
  let html = STATUS_TEMPLATE;

  // Strip the optional reason block when empty; otherwise substitute it in.
  if (hasReason) {
    html = html.replaceAll('{{reason}}', opts.reason!.trim());
  } else {
    html = html.replace(/<!-- REASON_START -->[\s\S]*?<!-- REASON_END -->/g, '');
  }

  html = html
    .replaceAll('{{kind}}',         opts.kind)
    .replaceAll('{{name}}',         opts.name)
    .replaceAll('{{team_name}}',    opts.teamName ?? '')
    .replaceAll('{{partner_name}}', opts.partnerName ?? '');

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: statusSubjectFor(opts.kind, { teamName: opts.teamName }),
    html,
  });
}

// Solo signup just hit the waitlist:
// await sendSubmissionStatus({ kind: 'received-solo', to: 'ola@x.no', name: 'Ola' });

// Team signup just hit the waitlist (send to BOTH teammates):
// await sendSubmissionStatus({ kind: 'received-team', to: 'ola@x.no', name: 'Ola',
//                              teamName: 'Slagferdig', partnerName: 'Kari Hansen' });
// await sendSubmissionStatus({ kind: 'received-team', to: 'kari@x.no', name: 'Kari',
//                              teamName: 'Slagferdig', partnerName: 'Ola Nordmann' });

// Admin rejected the solo submission, with a reason:
// await sendSubmissionStatus({ kind: 'rejected-solo', to: 'ola@x.no', name: 'Ola',
//                              reason: 'Fullt opp på din erfaringsklasse i år.' });

// Admin rejected a team submission, no reason:
// await sendSubmissionStatus({ kind: 'rejected-team', to: 'ola@x.no', name: 'Ola',
//                              teamName: 'Slagferdig' });
