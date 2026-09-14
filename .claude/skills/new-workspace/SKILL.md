---
name: new-workspace
description: Stand up a new Summit OS workspace and wire its forms without leaking data into another company's books. Use whenever someone is creating a workspace, onboarding a new client, adding or changing submit forms, setting up n8n workflows or a GoHighLevel booking link for a workspace, or asks why a submission landed in the wrong workspace.
---

# Setting up a workspace and its forms

Read `docs/SOP-NEW-WORKSPACE.md` and follow it in order. Do not improvise around it
— it exists because a booked-call form set up for one client filed its submissions
into another client's books, and a misrouted submission looks exactly like a
successful one.

## The rule that this whole SOP serves

**A workspace's own ingest key is what binds its forms to it.** The key decides
which workspace a submission lands in — not the form, not the URL, and not the
`workspaceId` in the n8n body.

So, before any form is pointed at a workspace:

1. The workspace must have its **own** ingest key. New workspaces are sealed at
   creation and show the key on **Admin → Workspaces**; it is always available at
   **Team → Submit Forms → Form ingest key**. If the screen shows an amber
   "no key of its own" warning, generate one before doing anything else.
2. That key — and no other workspace's key — goes in that workspace's n8n HTTP
   Request nodes as `x-api-key`.
3. Never add `workspaceId` to an n8n body. It is ignored when a workspace key is
   used and refused when the shared key is.

## Never do these

- Reuse one workspace's ingest key on another workspace's form. The form will look
  like it is working while filing into the wrong company.
- Paste one client's GoHighLevel booking link into another client's workspace. The
  calendar link decides where the booking genuinely lands; no CRM setting undoes it.
- Guess a WhatsApp group id. Choose **no alerts** instead — the record is still kept.
- Seal an existing workspace before its n8n workflows have been updated. Sealing
  takes effect immediately and its submissions start failing with `401`.

## Always finish with step 5 of the SOP

Submit one test record per form, confirm it appears in the new workspace **and in no
other**, then delete it. This is the only step that actually catches a wrong key, and
it takes two minutes. A mistake found afterwards has already corrupted attribution,
commission and the client's reported numbers.
