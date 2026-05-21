// React Email component for the submission-status emails (no magic link).
// Sent to the player after signup ("received") and after admin review ("rejected" — approved
// is handled by MagicLinkEmail's 'approved' / 'approved-team' kinds, since those carry a link).
//
// Usage:
//   await resend.emails.send({
//     from: 'The Grandest Slam <noreply@thegrandestslam.no>',
//     to: user.email,
//     subject: statusSubjectFor(kind, payload),
//     react: <SubmissionStatusEmail kind="rejected-solo" name="Ola" reason="…" />,
//   });

import * as React from 'react';
import {
  Body, Container, Head, Heading, Html, Img, Preview, Section, Text,
} from '@react-email/components';

export type SubmissionStatusKind =
  | 'received-solo'
  | 'received-team'
  | 'rejected-solo'
  | 'rejected-team';

export interface SubmissionStatusEmailProps {
  kind: SubmissionStatusKind;
  name: string;
  /** Required for team variants. */
  teamName?: string;
  partnerName?: string;
  /** Optional admin-written explanation for rejected variants. Pass null/undefined/empty to omit the block. */
  reason?: string | null;
  logoUrl?: string;
}

const ink = '#1a1410';
const cream = '#f7ecd2';
const cream50 = '#fbf6e8';
const cream200 = '#efddb1';
const terracottaDark = '#a83a1c';
const teal = '#2f7e7a';
const mustard = '#e8a838';
const plum = '#6b3464';

const fontDisplay = '"Bowlby One","Arial Black",system-ui,sans-serif';
const fontSans = '"Inter",system-ui,-apple-system,Arial,sans-serif';

interface KindConfig {
  preview: string;
  tagText: string;
  tagBg: string;
  tagFg: string;
  isRejected: boolean;
  heading: (p: SubmissionStatusEmailProps) => React.ReactNode;
  body: (p: SubmissionStatusEmailProps) => React.ReactNode;
}

const COPY: Record<SubmissionStatusKind, KindConfig> = {
  'received-solo': {
    preview: 'Vi har mottatt påmeldingen din. En organisator vurderer den nå.',
    tagText: 'Påmelding mottatt',
    tagBg: mustard,
    tagFg: ink,
    isRejected: false,
    heading: (p) => <>Takk, <span style={{ color: teal }}>{p.name}</span>!</>,
    body: () => (
      <>
        <Text style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.55, color: ink }}>
          Vi har mottatt påmeldingen din. En organisator vurderer den i løpet av kort tid — du får beskjed på e-post så snart vi har bestemt oss.
        </Text>
        <Text style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'rgba(26,20,16,0.7)' }}>
          Du trenger ikke å foreta deg noe nå. Spar denne e-posten så du har den om du lurer på status.
        </Text>
      </>
    ),
  },
  'received-team': {
    preview: 'Vi har mottatt påmeldingen for laget. En organisator vurderer den nå.',
    tagText: 'Lag mottatt',
    tagBg: mustard,
    tagFg: ink,
    isRejected: false,
    heading: (p) => <><span style={{ color: plum }}>{p.teamName ?? '…'}</span> er meldt på.</>,
    body: (p) => (
      <>
        <Text style={{ margin: '0 0 8px', fontSize: 16, lineHeight: 1.55, color: ink }}>
          Hei {p.name} — vi har mottatt påmeldingen for laget <strong>{p.teamName ?? '…'}</strong> ({p.name} + {p.partnerName ?? '…'}).
          En organisator vurderer den i løpet av kort tid, og dere får begge beskjed på e-post så snart vi har bestemt oss.
        </Text>
        <Text style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'rgba(26,20,16,0.7)' }}>
          Dere trenger ikke å foreta dere noe nå.
        </Text>
      </>
    ),
  },
  'rejected-solo': {
    preview: 'Vi har dessverre ikke plass til deg i årets slam.',
    tagText: 'Ikke godkjent',
    tagBg: cream200,
    tagFg: ink,
    isRejected: true,
    heading: () => <>Vi har dessverre ikke <span style={{ color: terracottaDark }}>plass</span>.</>,
    body: (p) => (
      <Text style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.55, color: ink }}>
        Hei {p.name} — vi har gått gjennom påmeldingen din, og dessverre har vi ikke plass til deg i årets slam.
      </Text>
    ),
  },
  'rejected-team': {
    preview: 'Vi har dessverre ikke plass til laget i årets slam.',
    tagText: 'Ikke godkjent',
    tagBg: cream200,
    tagFg: ink,
    isRejected: true,
    heading: () => <>Vi har dessverre ikke <span style={{ color: terracottaDark }}>plass</span>.</>,
    body: (p) => (
      <Text style={{ margin: '0 0 16px', fontSize: 16, lineHeight: 1.55, color: ink }}>
        Hei {p.name} — vi har gått gjennom påmeldingen for laget <strong>{p.teamName ?? '…'}</strong>, og dessverre har vi ikke plass til dere i årets slam.
      </Text>
    ),
  },
};

const SPORT_STRIP = (
  <Section style={{ textAlign: 'center', paddingTop: 28 }}>
    <span style={{ fontFamily: fontDisplay, fontSize: 14, letterSpacing: '0.18em', color: ink }}>
      ★&nbsp;PADEL&nbsp;&nbsp;★&nbsp;TENNIS&nbsp;&nbsp;★&nbsp;FRISBEEGOLF&nbsp;&nbsp;★&nbsp;GOLF
    </span>
  </Section>
);

export const SubmissionStatusEmail: React.FC<SubmissionStatusEmailProps> = (props) => {
  const { kind, reason, logoUrl = 'https://www.thegrandestslam.no/The_Grandest_Slam.webp' } = props;
  const c = COPY[kind];
  const hasReason = c.isRejected && reason != null && reason.trim().length > 0;

  return (
    <Html lang="no">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Inter:wght@400;600;700;800&display=swap"
        />
      </Head>
      <Preview>{c.preview}</Preview>
      <Body style={{ margin: 0, padding: 0, background: cream, fontFamily: fontSans, color: ink }}>
        <Container style={{ width: '100%', maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>

          {/* Wordmark */}
          <Section style={{ textAlign: 'center', paddingBottom: 24 }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: 10, verticalAlign: 'middle' }}>
                    <Img src={logoUrl} alt="" width={44} height={44}
                         style={{ display: 'block', width: 44, height: 44, borderRadius: 9999, border: `2px solid ${ink}`, background: mustard }} />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span style={{ fontFamily: fontDisplay, color: ink, fontSize: 18, letterSpacing: '0.08em' }}>
                      THE GRANDEST SLAM
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Card */}
          <Section style={{
            background: cream50, border: `2px solid ${ink}`, borderRadius: 20,
            boxShadow: `6px 6px 0 ${ink}`, padding: '36px 36px 32px',
          }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{
                display: 'inline-block', padding: '6px 12px', background: c.tagBg, color: c.tagFg,
                fontFamily: fontSans, fontWeight: 700, fontSize: 12, letterSpacing: '0.08em',
                textTransform: 'uppercase', border: `2px solid ${ink}`, borderRadius: 9999,
              }}>{c.tagText}</span>
            </div>

            <Heading as="h1" style={{
              margin: '0 0 16px',
              fontFamily: fontDisplay, fontWeight: 400,
              fontSize: 54, lineHeight: 0.9, letterSpacing: '-0.01em', color: ink,
            }}>
              {c.heading(props)}
            </Heading>

            {c.body(props)}

            {hasReason && (
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 20px' }}>
                <tbody>
                  <tr>
                    <td style={{
                      padding: '14px 18px', background: cream200, border: `2px solid ${ink}`,
                      borderRadius: 12, borderLeftWidth: 8,
                    }}>
                      <div style={{
                        fontFamily: fontSans, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: 'rgba(26,20,16,0.7)', margin: '0 0 6px',
                      }}>Beskjed fra organisatorene</div>
                      <div style={{ fontSize: 15, lineHeight: 1.55, color: ink }}>{reason}</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {c.isRejected && (
              <Text style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'rgba(26,20,16,0.85)' }}>
                Vi setter pris på at du ville være med, og håper å se deg neste år. Har du spørsmål, svar gjerne på denne e-posten — vi leser alt.
              </Text>
            )}
          </Section>

          {!c.isRejected && SPORT_STRIP}

          {/* Footer */}
          <Section style={{ padding: '28px 0 8px', textAlign: 'center' }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'rgba(26,20,16,0.55)' }}>
              The Grandest Slam · Sommer 2026
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default SubmissionStatusEmail;

// Helper: Norwegian subject lines
export function statusSubjectFor(
  kind: SubmissionStatusKind,
  p: { teamName?: string } = {},
): string {
  switch (kind) {
    case 'received-solo': return 'Påmelding mottatt — vi vurderer den nå';
    case 'received-team': return `Påmelding mottatt — vi vurderer ${p.teamName ?? 'laget'}`;
    case 'rejected-solo': return 'Påmeldingen din — beslutning fra organisatorene';
    case 'rejected-team': return 'Laget deres — beslutning fra organisatorene';
  }
}
