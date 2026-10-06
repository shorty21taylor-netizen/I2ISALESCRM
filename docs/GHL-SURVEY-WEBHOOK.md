# Wiring the hosted GoHighLevel surveys into Summit

The floor files its reports on three hosted surveys. Without this, those
submissions reach GoHighLevel and nothing else — the boards, the leaderboards,
the KPI cards and the commission run all read Summit's own records, so they
simply stop moving.

One webhook per survey. No field mapping: `src/lib/ghl-survey.js` knows what the
questions are called.

## Once per workspace

In Summit → **Submit Forms → Integrations**, add:

| Provider | Key | Value |
|---|---|---|
| `gohighlevel` | `location_id` | the GHL location (sub-account) id |
| `gohighlevel` | `webhook_secret` | any long random string — you will paste the same one into GHL |

The location id decides which workspace a submission lands in. It is never taken
from the payload and never defaults: an unmapped location is ignored, because a
report landing on the wrong company's board is worse than one that never arrived.

## Once per survey, in GoHighLevel

Workflow → Trigger **Survey Submitted** → pick the survey → Action **Webhook**:

- Method: `POST`
- URL: `https://<your-summit-url>/api/webhooks/ghl/survey?type=<form>`
  - Booked Call Report → `?type=book-call`
  - End-of-Call Report → `?type=after-call`
  - Setter End-of-Day → `?type=eod-report`
- Header: `x-summit-signature: <HMAC-SHA256 of the raw body, keyed with webhook_secret>`
- Body: the survey submission. Send everything; nothing needs renaming.

Leaving `?type=` off works too — the route reads the questions only one survey
asks (`call_outcome`, `setter_type`, `booking_source`) — but one workflow per
survey with the parameter set is the documented setup, because a stated answer
beats a deduced one.

## What each submission produces

- **Booked Call** → a booked call, plus its pipeline card. Booking Source lands in
  `outboundInbound` (every screen calls it Source); Lead Temperature in
  `intentScore`.
- **End-of-Call** → an after-call report. On `🟢 Closed` it ALSO files a closed
  deal: the report is the account of the call, the deal is the money. Neither
  figure doubles — cash is read off deals, calls off reports.
- **Setter End-of-Day** → one EOD, stamped `Setter` or `DM Setter` from the Setter
  Type answer, carrying none of the closer call figures (which would otherwise
  outrank the stated position and file the day onto the closer board).

Each one then sends its WhatsApp message through the workspace's own route, the
same as a form filed inside the CRM. A form with no destination set records the
submission and skips the send.

## The call recording

The internal End-of-Call form requires a link to the recording. The hosted survey
has no such question, so by default a call report submitted without one is
**refused** and the response says so.

Two ways out, in order of preference:

1. Add a **Call Recording Link** question to the GHL survey. The route accepts it
   under any of `call_recording`, `call_recording_link`, `recording_url`,
   `recording_link`, `gong_link`, `fathom_link`.
2. Stand the requirement down for this workspace: add
   `summit` / `require_call_recording` = `off` in Integrations. Records then file
   without a tape and show "no recording" on the board.

## Retries

GoHighLevel retries on its own timeout as well as on ours. The same body arriving
again within ten minutes produces one record and a `{ "duplicate": true }`
response. A duplicate hours later is a rep filing twice, which is a real record.
