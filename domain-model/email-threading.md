# Email Threading

How outbound emails carry enough information to route inbound replies back to the right ticket, without relying on brittle subject parsing.

---

## Outbound: what we set

Every outbound email from Escalated sets these headers:

```
Message-ID: <ticket-{ticketId}@{replyDomain}>
From:       "Support" <support@{replyDomain}>
Reply-To:   reply+{ticketId}.{hmac8}@{replyDomain}
X-Escalated-Ticket-Id: {ticketId}
```

For replies (not the initial ticket-created email), additionally:

```
Message-ID: <ticket-{ticketId}-reply-{replyId}@{replyDomain}>
In-Reply-To: <ticket-{ticketId}@{replyDomain}>
References:  <ticket-{ticketId}@{replyDomain}>
```

So the initial email anchors the thread; replies chain via `In-Reply-To` / `References`. MUAs (Gmail, Outlook, Apple Mail, Thunderbird) all thread correctly from this.

**Signed Reply-To** — `reply+{ticketId}.{hmac8}@{domain}` where `hmac8 = HMAC-SHA256(ticketId, inboundReplySecret)` truncated to 8 hex chars. Verified timing-safely (`hash_equals` / `hmac.compare_digest` / `crypto.timingSafeEqual` / language equivalent) before accepting the reply.

---

## Inbound: the 5-priority resolution chain

When an inbound email arrives, `InboundRouterService` resolves it to a ticket in this order. First match wins:

1. **`In-Reply-To` header** -> `parseTicketIdFromMessageId` -> look up by id. Primary path for reply-to-reply chains.
2. **`References` header** -> same parse. Primary path when the MUA drops `In-Reply-To` but keeps `References`.
3. **Envelope `To` address** -> `verifyReplyTo` against `inboundReplySecret`. Primary path when headers are stripped by a forwarding layer but the address survives.
4. **Subject `[TK-XXX]` reference** -> look up by reference. Fallback for agents who manually forward with subject preserved.
5. **Legacy `InboundEmail.message_id` table lookup** -> historical Message-IDs from before the canonical format. Eventually removable.

If none match, the email is treated as a new submission — create-or-resolve `Contact` by sender email, create ticket.

### Which paths count

Paths 1, 2, 4 and 5 are built from values anyone can guess or copy: Message-IDs are deterministic from the ticket id, and references are sequential. Only the signed Reply-To (path 3) proves the sender received mail about that ticket.

- **Inbound secret configured** (outbound therefore carries the signed Reply-To): only path 3 identifies a ticket. Mail that fails verification, or arrives without the signed address, is a new submission.
- **No inbound secret**: the full chain above is used, as a compatibility mode for hosts that have not set one.

---

## Inbound: who a reply may post as

Matching a thread is not enough to post on it. After a ticket is found:

1. **The sender must be the ticket's requester.** The `From` address, compared case-insensitively, must equal the ticket's guest email or the requester's email. Anyone else — a stranger quoting a reference, a forwarded copy, a CC'd party — gets a new ticket of their own. Their mail is never dropped silently and never reopens the matched ticket.
2. **The author comes from the ticket, not the header.** A matching sender posts as the requester (the requester user, or a guest reply). Staff identity is never derived from `From`, which is unauthenticated: an email naming an agent's address is not treated as that agent. Agents reply in the app. Until a per-agent signed reply address exists, agent email replies become new tickets.
3. **Only an accepted reply reopens** a resolved or closed ticket.

`From` can still be forged for the requester's own address, so hosts should also have their inbound provider enforce SPF/DKIM/DMARC. The signed Reply-To keeps a forged requester reply from landing on a ticket the forger never received mail about.

---

## Why this shape

- **No DB lookup on the critical outbound path.** Message-ID is deterministic from `ticketId`, so outbound is O(1).
- **HMAC signature prevents spoofing.** An attacker can't fabricate a reply-to address for an arbitrary ticket without the secret.
- **A thread match is not an identity.** Message-IDs and references are guessable, so the requester check and the author rule above decide whether a matched email may post.
- **Mail is never lost.** Anything that is not an accepted reply becomes a new ticket, so a stripped header or rewritten address costs threading, not the message.

---

## Portfolio note

The canonical format is `<ticket-{id}@{domain}>`. Some frameworks had divergent historical formats before the 2026-04 email rollout:

| Framework | Before | After |
|---|---|---|
| WordPress | `reply-{id}-ticket-{ref}@{domain}` | `<ticket-{id}@{domain}>` |
| Django | `<ticket-{pk}-{ref}@{domain}>` | `<ticket-{pk}@{domain}>` |
| Symfony | `escalated.{ref}@{domain}` | `<ticket-{id}@{domain}>` |
| Phoenix | `<escalated-{ref}@{domain}>` | `<ticket-{id}@{domain}>` |
| Adonis | `<escalated-{unique}-{sha256:16}@{domain}>` | `<ticket-{id}@{domain}>` |
| .NET | `<{ref}@escalated>` | `<ticket-{id}@{domain}>` |
| Laravel | `<ticket-{id}@{domain}>` | (unchanged — canonical from day one) |

Pre-migration emails can still be resolved via path #5 (legacy table lookup). New emails use path #1 directly.

---

## See also

- [ticketing-model](ticketing-model.md) — what a ticket is and how replies attach
- [guest-policy](guest-policy.md) — how inbound from unrecognized senders becomes tickets
