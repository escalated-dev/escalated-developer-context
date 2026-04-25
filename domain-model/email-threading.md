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

---

## Why this shape

- **No DB lookup on the critical outbound path.** Message-ID is deterministic from `ticketId`, so outbound is O(1).
- **HMAC signature prevents spoofing.** An attacker can't fabricate a reply-to address for an arbitrary ticket without the secret.
- **5 resolution paths prevent a single failure mode from dropping inbound mail.** Gmail stripped the header? `References` covers you. Corporate proxy rewrote everything? Subject ref covers you. Legacy email from the old format? The `InboundEmail` table covers you.

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
