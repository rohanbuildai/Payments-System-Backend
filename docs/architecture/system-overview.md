
# Distributed Payment Gateway — System Overview

## 1. Project Objective

Build a production-grade, fault-tolerant payment gateway using independently deployable microservices.

The system must handle payment processing, concurrency, duplicate requests, service crashes, network failures, refunds, and financial reconciliation.

## 2. Architecture Style

- Microservices architecture
- Monorepo
- Feature-based internal architecture
- Database ownership per service
- Hybrid REST and Kafka communication

## 3. Microservices

| Service | Responsibility |
|---|---|
| API Gateway | Request routing and gateway security |
| Merchant Service | Merchant accounts and API credentials |
| Payment Service | Payment lifecycle and orchestration |
| Provider Service | External payment provider integrations |
| Ledger Service | Double-entry financial accounting |
| Refund Service | Refund lifecycle |
| Webhook Service | Merchant notifications |
| Risk Service | Transaction risk assessment |
| Reconciliation Service | Financial discrepancy detection |

## 4. Technology Stack

- Node.js
- Express.js
- JavaScript (CommonJS)
- PostgreSQL
- Apache Kafka
- Redis
- Docker
- GitHub Actions
- Prometheus
- Grafana

## 5. Core Engineering Requirements

- Idempotent payment processing
- Concurrency-safe financial operations
- Durable event processing
- Crash recovery
- Transactional Outbox and Inbox
- Double-entry ledger
- Reliable refunds
- Provider reconciliation
- Distributed tracing

## 6. Financial Correctness

PostgreSQL is the source of truth for financial records.

Redis must never be treated as the authoritative financial ledger.

Every financial posting must preserve accounting balance.

Duplicate requests and duplicate events must not create duplicate financial effects.

## 7. Reliability

Every asynchronous workflow must account for:

- Duplicate delivery
- Delayed messages
- Consumer crashes
- Retry exhaustion
- Network timeouts
- Partial failures
- Recovery and reconciliation
