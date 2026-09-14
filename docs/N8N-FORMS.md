# Hosted n8n forms → Summit CRM → WhatsApp

The three n8n forms are now the front door for rep submissions. Each one posts into
the CRM, the CRM writes the record, sends the WhatsApp message, and logs the send.

| Form | URL | CRM type |
|---|---|---|
| Booked Appointment | https://summitsales.app.n8n.cloud/form/lead-booking | `book-call` |
| Closed Deal (Gong channel) | https://summitsales.app.n8n.cloud/form/deal-won | `close-deal` |
| EOD Report | https://summitsales.app.n8n.cloud/form/eod-report | `eod-report` |
| After-Call Report | https://summitsales.app.n8n.cloud/form/after-call-report | `after-call` |

---

## 1. Get the workspace's ingest key

The ingest endpoint is public, so it is protected by a key — and **the key decides
which workspace the submission lands in.**

Every workspace has its own. A new workspace is sealed the moment it is created and
shows its key once on **Admin → Workspaces**; it is always available afterwards at
**Team → Submit Forms → Form ingest key**.

Use **that workspace's key** in that workspace's workflows. Never reuse another
workspace's key: the form will look like it is working while filing its submissions
into the other company's books.

> **Setting up a new workspace?** Follow `docs/SOP-NEW-WORKSPACE.md` instead of this
> page. It covers the key, the routes, the GoHighLevel link and how to prove the
> records landed in the right place before a rep touches the form.

### The shared key (legacy)

`FORM_INGEST_KEY` on the Railway service is an install-wide key kept only for
workspaces that have not been migrated yet — today that is Influence2Impact
(`default`). It cannot write into any workspace that has a key of its own, and it
stops working entirely once every workspace is sealed.

Without any key set, every n8n submission is rejected with `503`.

## 2. Wire each n8n workflow

In each of the three workflows, add an **HTTP Request** node immediately after the
**Form Trigger** node:

- **Method:** `POST`
- **URL:** `https://<your-crm-domain>/api/forms/ingest?type=close-deal`
  (`book-call` for lead-booking, `eod-report` for the EOD form, `after-call` for the
  after-call report)
- **Authentication:** none — use a header instead
- **Headers:** `x-api-key: <this workspace's ingest key>`
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
   `"ingestKeyConfigured": true`. Signed in as the operator it also returns the
   last 50 ingest attempts with the reason each was accepted or rejected.
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

**EOD Report (`eod-report`)** — one form, two branches. `Position` sets `role`, and
the EOD Logs card renders setter tiles or closer tiles accordingly.

| Form label | CRM field | Branch |
|---|---|---|
| Your Name | salesRep | both |
| Position | position + role | both |
| Cash Collected Today ($) | cashCollectedI2I + revenueOnDay | both |
| Areas You Need Help In | improvementPlan | both |
| Self Rating (1-10) | selfRating | both |
| Deals Closed | closes | setter |
| Dials | outboundDials | setter |
| Conversations / Pickups | conversations | setter |
| Live Calls | liveCalls | setter |
| Total Talk Time | talkTime | setter |
| Sets | sets, and netNewCallsBooked when the closer field is absent | setter |
| Follow-Ups Scheduled | followUpsScheduled | setter |
| Closer Name | closerName | setter |
| Total Calls Today | callsTaken | closer |
| Calls Offered | callsTakenAndPitched | closer |
| No Shows | callsNoShowed | closer |
| Leads Called (names) | leadsCalled | closer |
| Call Outcomes | callOutcomes | closer |

The report's date comes from the team's timezone (`REPORT_TIMEZONE`, default
`America/Los_Angeles`), not the server's. An 8pm PT submission belongs to that day,
not to tomorrow in UTC.

**After-Call Report (`after-call`)**

| Form label | CRM field |
|---|---|
| Lead Name | leadsName |
| Lead Phone Number | leadsPhone |
| Call Notes | callNotes |

Adding a field to a form is safe: it is stored under `extra` keyed by the question
as the rep saw it, and **every page that shows a record also renders `extra`** — so a
new question appears in the CRM immediately, looking out of place, instead of
vanishing into JSONB. Promote it to a first-class column by adding its label to
`src/lib/form-ingest.js`.

## Where each form is read

| Form | Page |
|---|---|
| Lead Booking | Booked Calls |
| Deal Won | Closed Deals |
| EOD Report | EOD Logs → Details |
| After-Call Report | After-Call |

## Multi-workspace

**The key decides the workspace. The payload does not.**

Point a workflow at a workspace by giving it that workspace's ingest key — nothing
else. Do **not** put `workspaceId` in the HTTP Request body:

- with that workspace's own key, a `workspaceId` in the body is ignored;
- with the shared key, naming a sealed workspace is refused with `403`, and naming a
  workspace that does not exist is refused with `400`.

This is deliberate. The body used to decide, which meant a form set up for one
client filed into another client's books whenever its workflow said the wrong thing
— and a form whose workflow said nothing at all defaulted into `default`, the first
company's books.

---

## Deleting a record

The Delete button on Closed Deals, EOD Logs, Booked Calls and After-Call now
reaches a real route: `DELETE /api/webhooks/<type>/<id>`. Two properties matter:

- **Operator only, enforced on the server.** Hiding the button in the UI is not a
  permission check — the route rejects anyone but the operator account with `403`.
- **Soft delete.** The record leaves memory at once, so every dashboard, leaderboard
  and commission figure is correct immediately, but the Postgres row is kept with
  `deleted_at` stamped. To bring one back:

```sql
UPDATE closed_deals SET deleted_at = NULL WHERE id = 'close-...';
```

If the database write fails, the record is put back in memory rather than leaving
memory and Postgres disagreeing, and the page shows the error instead of silently
refetching.

## Questions worth adding to the forms

Three CRM columns are blank because no form asks for them. The mappings are already
in place — add the question and the data lands automatically, no deploy needed.

| Form | Question to add | Fills | Unlocks |
|---|---|---|---|
| Lead Booking | `Your Name` (or `Setter`) | `setter` | Bookings attributable to a setter; setter leaderboards |
| Lead Booking | `Call Date` + `Call Time` | `bookedDay`, `bookedTime` | No-show tracking that isn't self-reported |
| Deal Won | `Setter` | `setter` | Closed Deals stops printing "Setter: N/A"; setter commission |

Aliases accepted for each: setter — `Setter`, `Setter Name`, `Set By`, `Booked By`,
`Your Name`; date — `Call Date`, `Booked Date`, `Appointment Date`, `Date`,
`Booked For`; time — `Call Time`, `Booked Time`, `Appointment Time`, `Time`.
