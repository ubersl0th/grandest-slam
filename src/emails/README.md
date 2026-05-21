# Emails — The Grandest Slam

Norwegian-only, playful tone. Three templates covering the full lifecycle of a signup.

## Lifecycle

```
        SIGNUP
          │
          ├──▶ submission-status (received-solo | received-team)   →  player
          └──▶ admin-notify (solo | team)                          →  organisers
                       │
                       ▼
                  ADMIN REVIEW
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
  APPROVED                       REJECTED
  magic-link                     submission-status
    (approved | approved-team)     (rejected-solo | rejected-team,
    →  player, with sign-in link    optional admin reason)
                                   →  player, no link
        │
        ▼
  (later, solo only) ORGANISERS PAIR
  magic-link (team-assigned) → player, sign-in link
```

Two later, independent triggers:
- An existing user requesting a login link → `magic-link` with `kind: 'signin'`.

## Templates

### 1. `submission-status.html` / `SubmissionStatusEmail.tsx` — **no link**

| `kind` | Sent when | Subject |
|---|---|---|
| `received-solo` | A solo player just submitted | `Påmelding mottatt — vi vurderer den nå` |
| `received-team` | A team just submitted (send to **both** teammates) | `Påmelding mottatt — vi vurderer {{team_name}}` |
| `rejected-solo` | Admin rejected a solo submission | `Påmeldingen din — beslutning fra organisatorene` |
| `rejected-team` | Admin rejected a team submission | `Laget deres — beslutning fra organisatorene` |

`rejected-*` variants accept an optional `{{reason}}` — admin-written explanation. When empty, the reason block is stripped from the HTML (strip the `<!-- REASON_START --> … <!-- REASON_END -->` block; see `sendSubmissionStatusHtml` for the regex).

### 2. `magic-link.html` / `MagicLinkEmail.tsx` — **with sign-in link**

| `kind` | Sent when | Subject |
|---|---|---|
| `signin` | Existing user requested a login link | `Velkommen tilbake til slammet — trykk her ↓` |
| `approved` | Admin approved a solo submission | `Du er godkjent — logg inn for å komme i gang ↓` |
| `approved-team` | Admin approved a team submission (both teammates get one) | `Laget er godkjent — logg inn for å komme i gang ↓` |
| `team-assigned` | Organisers paired a solo player with a partner (post-approval) | `Laget ditt er klart — møt makkeren din ↓` |

Tokens: `{{kind}}`, `{{name}}`, `{{magic_url}}`, `{{team_name}}`, `{{partner_name}}`, `{{partner_skill}}`.

### 3. `admin-notify.html` / `AdminNotifyEmail.tsx` — **to organisers**

Fires whenever a new player or team hits the waitlist. Two variants in one template (`kind: 'solo' | 'team'`). Uses an **ink-on-cream tag** to visually distinguish from player emails. Contains a data block with all signup details and one CTA into the admin panel.

Tokens: `{{kind}}`, `{{name}}`, `{{email}}`, `{{skill}}`, `{{team_name}}`, `{{partner_name}}`, `{{partner_email}}`, `{{partner_skill}}`, `{{signed_up_at}}`, `{{admin_url}}`.

## Files

| File | Purpose |
|---|---|
| `submission-status.html` | Linkless template for received + rejected (player). |
| `SubmissionStatusEmail.tsx` | React Email version of the above. |
| `magic-link.html` | Sign-in / approved / team-assigned (player, with magic link). |
| `MagicLinkEmail.tsx` | React Email version of the above. |
| `admin-notify.html` | New-signup notification (organisers). |
| `AdminNotifyEmail.tsx` | React Email version of the above. |
| `preview.html` | Local preview — toggle between all 10 views in your browser. |
| `send-example.tsx` | Resend usage snippets for all three templates. |

## Optional reason block (rejected emails)

The HTML template marks the reason quote block with HTML comments so the sender can strip it cleanly when no reason was provided:

```js
const hasReason = reason && reason.trim().length > 0;
let html = template;
if (hasReason) {
  html = html.replaceAll('{{reason}}', reason.trim());
} else {
  html = html.replace(/<!-- REASON_START -->[\s\S]*?<!-- REASON_END -->/g, '');
}
```

The React Email component handles this automatically — pass `reason=""` / `null` / `undefined` and the block is omitted.
