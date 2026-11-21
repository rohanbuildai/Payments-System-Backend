
# Architecture Decision Records

## ADR-001: Monorepo

Status: Accepted

Decision:
All microservices and shared packages will live in one Git repository.

Reason:
Simplifies cross-service development, contract management, and coordinated changes.

Tradeoff:
CI/CD must identify and deploy services independently.

## ADR-002: Database Ownership Per Service

Status: Accepted

Decision:
Every microservice owns its database and controls access to its data.

Reason:
Prevents tight coupling and supports independent service evolution.

Tradeoff:
Cross-service transactions require distributed workflow patterns.

## ADR-003: Hybrid Communication

Status: Accepted

Decision:
REST for synchronous communication and Kafka for asynchronous events.

Reason:
Combines immediate request-response operations with decoupled event processing.

Tradeoff:
Requires event versioning, idempotent consumers, and eventual consistency handling.

## ADR-004: Feature-Based Architecture

Status: Accepted

Decision:
Every microservice organizes business functionality into feature modules.

Reason:
Improves modularity, maintainability, and testing.

Tradeoff:
Requires clear module boundaries and dependency management.
