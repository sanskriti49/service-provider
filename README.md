# TaskGenie — On-Demand Hyper-Local Service Marketplace

[![Deployed Link](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://taskgenieee.vercel.app/)
[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/sanskriti49/service-provider)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat&logo=docker)](https://docker.com)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?style=flat&logo=terraform)](https://terraform.io)
[![Prometheus](https://img.shields.io/badge/Metrics-Prometheus-E6522C?style=flat&logo=prometheus)](https://prometheus.io)

TaskGenie is a cloud-native, high-concurrency hyper-local on-demand service marketplace connecting consumers with vetted professionals in real-time. Built on a decoupled **PERN stack** (PostgreSQL, Express.js, React, Node.js), TaskGenie combines **PostGIS spatial indexing**, **Redis distributed locks (Redlock)** and PostgreSQL row locks for multi-tiered concurrency, **durable BullMQ + Redis event-driven background workers**, **PgBouncer-compatible connection pooling safeguards**, **API rate limiting & Opossum circuit breakers**, and **Prometheus cloud observability**.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Tier (React + Vite + Tailwind CSS)"]
        UI[Customer / Provider UI]
        GeoLookup[Geolocation & Radius Selector]
        BookingFlow[Booking & Schedule Engine]
        PayModal[Razorpay Checkout Modal]
    end

    subgraph Gateway ["API & Observability Tier (Express.js)"]
        MetricsMiddleware[Prometheus Latency Middleware]
        Auth[JWT & RBAC Guards]
        GeoCtrl[Geospatial Matching Engine]
        BookingCtrl[State Machine & Concurrency Locker]
        PaymentCtrl[HMAC-SHA256 Payment Handler]
        HealthProbes["/health/live & /health/ready Probes"]
        MetricsEndpoint["/metrics (Prometheus Scraper)"]
    end

    subgraph AsyncWorker ["Event-Driven Worker Tier (EDA)"]
        EventQueue[Asynchronous Worker Queue]
        EmailWorker[Email Notification Worker]
        SocketWorker[Real-Time WebSocket Dispatcher]
        DLQ[Dead Letter Queue & Exponential Backoff]
    end

    subgraph Storage ["Cloud Data Tier"]
        DB[(PostgreSQL - ACID Transactions)]
        RedisCache[(Redis - Distributed Cache / Locks)]
        S3Storage[(AWS S3 / LocalStack - Media Storage)]
    end

    UI --> GeoLookup
    GeoLookup --> GeoCtrl
    BookingFlow --> BookingCtrl
    PayModal --> PaymentCtrl

    MetricsMiddleware -.-> MetricsEndpoint
    BookingCtrl --> DB
    BookingCtrl -- "Publish Event (<40ms)" --> EventQueue
    EventQueue --> EmailWorker
    EventQueue --> SocketWorker
    EventQueue -. Failures .-> DLQ

    GeoCtrl --> RedisCache
    GeoCtrl --> DB
    PaymentCtrl --> DB
    Auth --> DB
```

---

## ⚡ Engineering & Architectural Highlights

### 1. ⚡ BullMQ + Redis Distributed Background Workers (EDA)

- Migrated asynchronous workload processing from an in-memory queue to **BullMQ on Redis** with persistent job storage, worker concurrency limits, and distributed locking.
- Employs **exponential backoff retries** (up to 3 attempts) and routes permanently failed jobs to a **Dead-Letter Queue (DLQ)**.
- Features **resilient dual-mode fallback**: automatically degrades to an in-memory worker queue if Redis is temporarily unreachable, guaranteeing zero downtime.
- Offloads slow transactional email (Nodemailer) and push notifications, keeping HTTP request-response latency strictly under **$<40\text{ms}$**.

### 2. 📍 Sub-10ms PostGIS Geospatial Proximity Matching

- Replaced table-scanning trigonometry with native PostgreSQL **PostGIS (`GEOGRAPHY(Point, 4326)`)** and **R-Tree GIST spatial indexing (`idx_users_geom_gist`)**.
- Uses `ST_DWithin()` for bounded radius filtering and `ST_Distance()` for database-engine distance calculation.
- Backed by an automatic database trigger (`trg_users_geom_sync`) to keep coordinates synchronized, and falls back to spherical **Haversine Distance algorithms** if running on standard non-spatial PostgreSQL.

### 3. 🔒 Two-Tiered Concurrency Control & Double-Booking Elimination

- **Tier 1 (Redis Edge Lock):** Employs the **Redlock pattern** (`SET lock:slot <token> PX 15000 NX`) with atomic Lua script releasing. Under concurrent booking spikes, conflicting requests fail fast with HTTP 409 before opening or stalling database connections.
- **Tier 2 (PostgreSQL ACID Isolation):** Uses row-level locks (`SELECT ... FOR UPDATE`) inside atomic database transactions (`BEGIN ... COMMIT`) during the final slot allocation and transit buffer verification.

### 4. 🛡️ API Rate Limiting & Circuit Breakers (Chaos Resilience)

- **Tiered Rate Limiting (`express-rate-limit` + `rate-limit-redis`):** Global limiter (300 req / 15 min), sensitive authentication limiter (15 req / 15 min on login, registration, password reset, and OTP verification), and booking limiter (25 req / 5 min).
- **Opossum Circuit Breakers:** Wraps external third-party I/O (Razorpay payment order creation, Nodemailer SMTP delivery) with circuit breakers. When downstream services fail or time out, the circuit trips to `OPEN`, immediately failing fast without exhausting thread pools or hanging customer requests.

### 5. 📊 Database Connection Pooling Safeguards & SRE Observability

- **PgBouncer-Compatible Pool Tuning:** Configured connection recycling (`maxUses: 7500`), fast client timeouts (`connectionTimeoutMillis: 5000`), and idle connection pruning (`idleTimeoutMillis: 30000`) to prevent pool starvation.
- **Prometheus Metrics (`/metrics`)**: Exposes custom duration histograms (`taskgenie_http_request_duration_seconds`), booking counters (`taskgenie_bookings_total`), database pool saturation gauges (`taskgenie_db_pool_total`, `taskgenie_db_pool_idle`, `taskgenie_db_pool_waiting`), and circuit breaker state gauges.
- **Container Probes**: Kubernetes/ECS-ready `/health/live` (process health & memory) and `/health/ready` (active PostgreSQL pool & queue health checks).

### 6. 🏗️ Infrastructure as Code (IaC) & Docker

- Complete **Terraform (`terraform/main.tf`)** specification provisioning S3 asset buckets with CORS, SQS FIFO queues with DLQ, and IAM least-privilege execution roles.
- **Docker Compose** orchestration running the Node API, PostGIS (`postgis/postgis:15-3.4-alpine`), Redis, Prometheus, and LocalStack (offline AWS S3 & SQS emulation) for \$0 local cloud development.

---

## 📁 Repository Structure

```text
service-provider/
├── terraform/                # Infrastructure as Code (IaC)
│   ├── main.tf               # AWS S3, SQS, DLQ & IAM Resources
│   └── variables.tf          # Configurable Deployment Variables
├── client/                   # React + Vite Frontend Application
│   ├── src/
│   │   ├── components/       # Reusable UI Components
│   │   ├── contexts/         # React Contexts for Global State
│   │   ├── hooks/            # Custom React Hooks
│   │   ├── layouts/          # Different Layouts for Pages
│   │   ├── pages/            # Marketplace, Dashboard, Booking Views
│   │   └── App.jsx           # Routing Engine
│   └── package.json
├── server/                   # Node.js + Express.js Cloud-Native REST API
│   ├── Dockerfile            # Multi-stage production container build
│   ├── config/               # PostgreSQL Connection Pool & Env Setup
│   ├── controllers/          # Booking, Provider, User, and Payment Controllers
│   ├── middleware/           # JWT Auth Guards & Joi Input Validation
│   ├── migrations/           # PostgreSQL DDL Schemas & Index Definitions
│   ├── routes/               # REST API Endpoint Routers
│   ├── test/                 # Test Suite (EventQueue, Metrics, Pricing, Geo)
│   ├── utils/
│   │   ├── eventQueue.js     # Asynchronous Event Queue Worker Pool
│   │   ├── metrics.js        # Prometheus Metrics & Latency Middleware
│   │   ├── cache.js          # In-memory / Redis Cache Layer
│   │   └── geoUtils.js       # Haversine Distance & Transit Calculator
│   └── index.js              # Server Entrypoint with Health Probes & /metrics
├── docker-compose.yml        # Multi-container orchestration (API, PG, Redis, LocalStack, Prometheus)
├── prometheus.yml            # Prometheus Scrape Configuration
└── README.md
```

---

## 🚀 Local Setup & Installation

### Prerequisites

- **Node.js**: v18+
- **PostgreSQL**: v14+ (Local instance or Cloud: NeonDB / Supabase)
- **Razorpay Account**: Test API Keys

### 1. Clone the Repository

```bash
git clone https://github.com/sanskriti49/service-provider.git
cd service-provider
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create `.env` inside `/server`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/taskgenie
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
JWT_SECRET=your_secure_jwt_secret
```

Run test suite:

```bash
npm test
```

Run server:

```bash
npm run dev
```

### 3. Docker Compose (Full Cloud Stack Emulation)

To spin up the entire cloud architecture locally (API + Postgres + Redis + LocalStack + Prometheus):

```bash
docker-compose up --build
```

Access:

- **API**: `http://localhost:5000`
- **Prometheus Metrics**: `http://localhost:5000/metrics`
- **Liveness Probe**: `http://localhost:5000/health/live`
- **Readiness Probe**: `http://localhost:5000/health/ready`
- **Prometheus Dashboard**: `http://localhost:9090`

---

## 🛡️ Security Best Practices

- **Parameterized SQL Queries**: Complete protection against SQL injection.
- **Stateless Authentication**: Signed JWT tokens with strict expiration.
- **Cryptographic Verification**: HMAC-SHA256 signature verification for payment webhooks.
- **Least-Privilege IAM**: Granular policies restricting cloud storage and queue permissions.

---

## 📜 License

Distributed under the MIT License.
