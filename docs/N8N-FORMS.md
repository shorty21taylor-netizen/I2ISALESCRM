# Hosted n8n forms → Summit CRM → WhatsApp

The three n8n forms are now the front door for rep submissions. Each one posts into
the CRM, the CRM writes the record, sends the WhatsApp message, and logs the send.

| Form | URL | CRM type |
|---|---|---|
| Booked Appointment | https://summitsales.app.n8n.cloud/form/lead-booking | `book-call` |
| Closed Deal (Gong channel) | https://summitsales.app.n8n.cloud/form/deal-won | `close-deal` |
| EOD Report | https://summitsales.app.n8n.cloud/form/eod-report | `eod-report` |

---

## 1. Set the ingest key (once)

The ingest endpoint is public, so it is protected by a shared secret.

**Railway → CRM service → Variables:**

```
FORM_INGEST_KEY = <a long random string>
```

Redeploy. (Alternatively: **Settings → Sales Forms (n8n) → Generate new ingest key**
— that route stores the key in the database and needs no redeploy, but the
environment variable wins if both are set.)

Without a key set, every n8n submission is rejected with `503`.

## 2. Wire each n8n workflow

In each of the three workflows, add an **HTTP Request** node immediately after the
**Form Trigger** node:

- **Method:** `POST`
- **URL:** `https://<your-crm-domain>/api/forms/ingest?type=close-deal`
  (use `book-call` for lead-booking, `eod-report` for the EOD form)
- **Authentication:** none — use a header instead
- **Headers:** `x-api-key: <FORM_INGEST_KEY>`
- **Body Content Type:** JSON
- **Body:** `{{ $json }}` (send all form fields — "JSON" mode, expression)

That is all the mapping required. The CRM matches the form's field labels
("Client Name", "Deal Value", "Cash Collected Today ($)") to its own fields, so the
labels can keep their current wording.

### 3. Decide who sends the WhatsApp message

Pick **one**, otherwise the group gets two messages per submission.

**Option A — the CRM sends (recommended).**
Delete or disable the WhatsApp node in the n8n workflow. Set the group IDs in
**Settings → Form Notifications**. Every message is then formatted, sent and logged
by the CRM.

**Option B — n8n keeps sending.**
Leave the n8n WhatsApp node in place and add `"skipWhatsapp": true` to the HTTP
Request body:

```
{{ { ...$json, skipWhatsapp: true } }}
```

The CRM then stores the record and logs the notification as *Sent by n8n* without
sending its own copy. Optionally include `"messageText"` with the exact text n8n
sent so the log holds the real message.

## 4. Verify

1. `GET https://<crm>/api/forms/ingest?type=close-deal` → should return
   `"ingestKeyConfigured": true`.
2. Submit each form once with test data.
3. **CRM → Closed Deals / EOD Logs / Dashboard** — the record is there.
4. **CRM → Message Log** — one row per submission showing `sent`, `failed`,
   `not sent`, or `sent by n8n`, with the exact message text and the destination group.

If a row says **failed**, the message text is still stored — the error column names
the reason (bad Assistro URL, wrong group id, auth). If it says **not sent**, the
form's group id is missing or its toggle is off in Settings → Form Notifications.

---

## Field mapping

Matching ignores case, spaces and punctuation, so `Deal Value`, `deal_value` and
`dealValue` all land in the same place. Anything unmatched is kept on the record
under `extra` rather than dropped.

**Booked Appointment (`book-call`)**

| Form label | CRM field |
|---|---|
| Lead Name | leadsName |
| Phone Number | leadsPhone |
| Email | leadsEmail |
| Booked In From | outboundInbound (source) |
| Credit Score | creditScore |
| Intent Score | intentScore |
| Goal | goal |
| Pain | pain |
| Notes | notes |

**Closed Deal (`close-deal`)**

| Form label | CRM field |
|---|---|
| Client Name | leadsName |
| Closer | closer |
| Deal Value | cashCollected (currency text is parsed: `$7,500` → 7500) |
| Product / Package | program |
| Payment Type | paymentDetails |
| Source | outboundInbound |
| Notes | notes |

**EOD Report (`eod-report`)**

| Form label | CRM field |
|---|---|
| Your Name | salesRep |
| Closer Name | closerName |
| Total Calls Today | callsTaken |
| Leads Called (names) | leadsCalled |
| Call Outcomes | callOutcomes |
| No Shows | callsNoShowed |
| Calls Offered | callsTakenAndPitched |
| Cash Collected Today ($) | cashCollectedI2I + revenueOnDay |
| Areas You Need Help In | improvementPlan |

Adding a field to a form is safe: it is stored under `extra` immediately, and it can
be promoted to a first-class column later by adding its label to
`src/lib/form-ingest.js`.

## Multi-workspace

Submissions land in the `default` workspace unless the payload carries a
`workspaceId`. To route a client's form elsewhere, add a hidden value in the n8n
HTTP Request body:

```
{{ { ...$json, workspaceId: 'acme' } }}
```
