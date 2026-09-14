# SOP — standing up a new workspace and its forms

Follow this in order, every time. It exists because of one specific failure: a
booked-call form set up for one client's offer filed its submissions into another
client's books, and nobody noticed, because a misrouted submission looks exactly
like a successful one.

**The rule everything else serves: a workspace's own ingest key is what binds its
forms to it. Never point a form at a workspace using the shared install-wide key.**

---

## 0. Before you touch anything

Know which workspace you are setting up, by id, not by name. Two workspaces can be
called something similar; their ids are unique. You will paste that id nowhere —
the point is that *you* are never confused about which one you are in.

Check the workspace switcher in the sidebar says the right company before you open
any admin screen. Every admin screen acts on the workspace you are standing in.

---

## 1. Create the workspace

**Admin → Workspaces → New Workspace.**

The moment it is created it is **sealed**: it generates its own ingest key, and
nothing can write a record into it without that key. A green banner shows the key
once, right there:

> ✅ *Acme Co is sealed* — `sk_ws1789420383_6719230c…`

**Copy it now.** You are about to need it. It is not lost if you dismiss the banner
— **Team → Submit Forms → Form ingest key** shows it again, with a copy
button.

> If the banner does not appear, the workspace was created **unsealed**. Stop and
> go to Team → Submit Forms → **Generate a key for this workspace** before doing
> anything else. An unsealed workspace is reachable by the shared key, which is the
> whole failure this SOP prevents.

---

## 2. Put the key in that workspace's n8n workflows

For **every** workflow that feeds this workspace, in its HTTP Request node:

```
Header:  x-api-key: <that workspace's key>
URL:     https://<crm-domain>/api/forms/ingest?type=book-call
```

Nothing else changes. Do **not** add `workspaceId` to the body — the key decides
where the record lands, and a payload that disagrees with the key loses.

**Never reuse another workspace's key.** A key belongs to exactly one workspace.
Using Acme's key on Beta's form files Beta's submissions into Acme, and the form
will look like it is working.

---

## 3. Give every form a destination

**Team → Submit Forms.**

Each form needs a route or its submissions are **refused, not saved**. That is
deliberate: a record nobody was told about is worse than a submission that failed
loudly. Set one of:

- **WhatsApp** + the group id for *this* client, or
- **no alerts** — the record is kept, nothing is sent.

Check the destination chip on each form is green before you move on. If you are not
certain a group id belongs to this client, use **no alerts** rather than guessing.
Sending one client's deal into another client's WhatsApp group is not recoverable.

---

## 4. If this workspace books through GoHighLevel

Add two integrations in the same screen:

| Provider | Key | Value |
|---|---|---|
| `gohighlevel` | `location_id` | this client's GHL location id |
| `gohighlevel` | `webhook_secret` | a long random string, also set in GHL |

The appointments webhook resolves the workspace from the location id. An unmapped
location is ignored, not guessed — so if bookings are not appearing, the location id
is missing or wrong.

The booking link is `gohighlevel / round_robin_booking_url`. **The calendar link you
paste decides where the booking lands.** Paste one client's link into another
client's workspace and the prospect genuinely books on the wrong calendar; no amount
of CRM configuration fixes that afterwards.

---

## 5. Prove it before anyone uses it

Do not skip this. It is two minutes and it is the only step that actually catches a
mistake.

1. Submit each form once with obvious test data (`ZZZ Test`).
2. Switch the workspace picker to the **new** workspace → the record is there.
3. Switch to **every other** workspace → the record is **not** there.
4. **Team → Message Log** → one row, right group or "not sent".
5. Delete the test records (operator only; they soft-delete and are recoverable).

If a test record shows up in the wrong workspace, stop and fix the key before any
rep touches the form. Do not "clean it up later" — attribution, commission and the
client's reported numbers are all downstream of it.

---

## 6. Migrating an existing workspace that is still on the shared key

Influence2Impact (`default`) predates all of this and still runs on the shared
`FORM_INGEST_KEY`. Its Submit Forms screen shows an amber warning saying so.

To migrate it:

1. Team → Submit Forms → **Generate a key for this workspace**.
2. Immediately update every I2I n8n workflow to send the new key.
3. Submit one test form and confirm it still lands.

Order matters — the moment the key exists, the shared key stops working for that
workspace. Expect a few minutes of rejected submissions if step 2 lags step 1; a
rejection is a `401`, visible in n8n and in the ingest log, and nothing is lost.

**Once every workspace is sealed, the shared key writes nowhere at all.** There is
no switch to remember to flip — it retires itself.

---

## Diagnosing a form that "isn't working"

`GET /api/forms/ingest?type=book-call` signed in as the operator returns the last
50 ingest attempts, accepted and rejected, with the reason. The log is in memory and
clears on restart.

| What you see | What it means |
|---|---|
| `401 Unauthorized` | The key is wrong, missing, or belongs to no workspace. |
| `403 … has its own ingest key` | The shared key was used against a sealed workspace. Use that workspace's key. |
| `400 Unknown workspace` | The payload named a workspace that does not exist. |
| `503 Ingest key not configured` | No key set anywhere on the install. |
| Accepted, but in the wrong workspace | The workflow is using another workspace's key. |
