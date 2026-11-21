
# Payment Failure and Recovery Matrix

| Scenario | Expected System Behavior |
|---|---|
| Duplicate payment request | Return existing logical payment |
| Payment service crashes | Recover payment using durable state |
| Provider timeout | Mark outcome unresolved and verify |
| Duplicate Kafka event | Prevent duplicate financial effects |
| Consumer crashes | Replay safely |
| PostgreSQL unavailable | Reject or defer operations safely |
| Concurrent withdrawals | Prevent overdraft |
| Provider callback duplicated | Process financial effect once |
| Ledger posting interrupted | Retry or recover without duplicate posting |
| Refund interrupted | Recover using refund idempotency |
| Webhook delivery fails | Retry with controlled backoff |
| Provider/internal mismatch | Create reconciliation discrepancy |

## Core Reliability Principles

1. Never assume a timeout means payment failure.
2. Never retry a charge blindly.
3. Never create financial entries without durable transaction boundaries.
4. Never trust message delivery to be exactly once.
5. Every financial operation must be idempotent.
6. Every unresolved transaction must have a recovery path.
7. Financial discrepancies must be detectable.
