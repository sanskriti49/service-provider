# TaskGenie — On-Demand Hyper-Local Service Marketplace

[![Deployed Link](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://taskgenieee.vercel.app/)
[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/sanskriti49/service-provider)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?style=flat&logo=postgresql)](https://postgresql.org)
[![Razorpay](https://img.shields.io/badge/Razorpay-API-blueviolet?style=flat)](https://razorpay.com)

TaskGenie is a production-grade, hyper-local on-demand service marketplace that connects consumers with skilled service professionals in real-time. Built on a decoupled **PERN stack** (PostgreSQL, Express.js, React, Node.js), TaskGenie features **geospatial proximity matching**, **row-level concurrency locking** to eliminate double-booking race conditions, and an **idempotent, cryptographically verified Razorpay payment pipeline**.

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

    subgraph API ["Server Tier (Node.js + Express REST API)"]
        Auth[JWT & OAuth 2.0 Auth Guards]
        GeoCtrl[Geospatial Provider Matching]
        BookingCtrl[State Machine & Concurrency Locker]
        PaymentCtrl[HMAC-SHA256 Webhook & Refund Handler]
        Notifier[Email Dispatcher Engine]
    end

    subgraph Storage ["Database Tier (PostgreSQL)"]
        Users[(Users & RBAC)]
        Providers[(Providers & Spatial Index)]
        Bookings[(Bookings - Row Lock `FOR UPDATE`)]
        Payments[(Payment Events & Idempotency)]
    end

    UI --> GeoLookup
    GeoLookup --> GeoCtrl
    BookingFlow --> BookingCtrl
    PayModal --> PaymentCtrl

    GeoCtrl --> Providers
    BookingCtrl --> Bookings
    PaymentCtrl --> Payments
    Auth --> Users
```

---

## ⚡ Engineering & Architectural Highlights

### 1. 📍 Geospatial Proximity Search (<5ms Lookup Latency)
- Utilizes indexed spatial queries (`idx_providers_location`) and spherical **Haversine Distance algorithms** to compute nearest service providers within a dynamic radius (1km – 50km).
- Incorporates real-time transit buffer calculations (`estimateTravelTimeMinutes`) between adjacent booking slots to prevent impossible provider schedules.

### 2. 🔒 Concurrency Control & Double-Booking Prevention
- Employs PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) inside atomic database transactions (`BEGIN ... COMMIT`) during the booking window.
- Guarantees zero race conditions when multiple customers attempt to reserve the same professional's overlapping time slot simultaneously.

### 3. 💳 Cryptographic Payment Integrity & Idempotency
- **HMAC-SHA256 Signature Verification**: Validates all incoming Razorpay webhooks and client payloads locally using cryptographic secret hashes to protect against tampering and replay attacks.
- **Automated Refund State Machine**: Dynamically computes 100% or partial refunds upon cancellation depending on SLA cancellation windows (e.g., $>2$ hours prior to scheduled appointment).

### 4. 👥 Dual-Role Role-Based Access Control (RBAC)
- Clean domain separation for `customer` and `provider` workflows.
- Dynamic provider availability schedules, exception date overrides, OTP handshake verification on job start, and automated email notifications.

---

## 📁 Repository Structure

```text
service-provider/
├── client/                 # React + Vite Frontend Application
│   ├── src/
│   │   ├── components/     # Reusable UI & Modal Elements
│   │   ├── pages/          # Dashboard, Marketplace, Booking Views
│   │   └── App.jsx         # SPA Routing Engine
│   └── package.json
├── server/                 # Node.js + Express.js REST API
│   ├── config/             # PostgreSQL Connection Pool & Env Setup
│   ├── controllers/        # Booking, Provider, User, and Payment Controllers
│   ├── middleware/         # JWT Auth Guards & Input Validation (Joi)
│   ├── migrations/         # PostgreSQL DDL Schemas & Index Definitions
│   ├── routes/             # REST API Endpoint Routers
│   ├── utils/              # GeoUtils, Pricing, Email, and Time Handlers
│   └── index.js            # Server Entrypoint
└── README.md
```

---

## 🚀 Local Setup & Installation

### Prerequisites
- **Node.js**: v18+ 
- **PostgreSQL**: v14+ (Local instance or Cloud: NeonDB / Supabase / Render)
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

Run database migrations:
```bash
node migrations/create_tables.js
npm run dev
```

### 3. Frontend Setup
```bash
cd ../client
npm install
```

Create `.env` inside `/client`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

```bash
npm run dev
```

---

## 🛡️ Security Best Practices
- **Parameterized SQL Queries**: Complete protection against SQL injection.
- **Stateless Authentication**: Signed JWT tokens with strict token expiration.
- **Input Sanitization**: Joi schema validation for all API inputs.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
