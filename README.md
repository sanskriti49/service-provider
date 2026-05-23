# TaskGenie 

[![Deployed Link](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=vercel)](https://taskgenieee.vercel.app/)
[![Repository](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/sanskriti49/service-provider)

TaskGenie is a robust, hyper-local service marketplace platform that seamlessly connects service seekers with independent skilled professionals. Built using a modern full-stack decoupled architecture, TaskGenie enables automated booking management, proximity-based discovery, and secure end-to-end transactional workflows.

---

## Live Demo & Deployment
* **Frontend Web App:** [https://taskgenieee.vercel.app/](https://taskgenieee.vercel.app/)
* **Backend API Repository:** Located under the `/server` directory of this monorepo.

---

## System Architecture & Tech Stack

TaskGenie utilizes the **PERN stack** configured as an optimized monorepo splitting client and server runtimes for modular scalability.

* **Frontend:** React.js, Vite (High-performance HMR toolchain), Tailwind CSS (Clean, responsive layout layouts)
* **Backend:** Node.js, Express.js RESTful API, MVC Architecture
* **Database:** PostgreSQL (Relational schema optimization with robust indexing and foreign-key integrity constraints)
* **Payment Infrastructure:** Razorpay API Integration (Secure payment processing, webhook listener execution, and transactional lifecycle management)

---

## Key Features & Technical Implementations

* **Dual-Role Architecture:** Native support for separate workflows handling service seekers (clients) and independent service providers.
* **Hyper-Local Discovery Engine:** Database-level relational mapping designed to filter and display registered service professionals based on regional preferences and categorizations.
* **Advanced Real-Time Transaction Workflow:** * Dynamic service booking states (Pending ➔ Accepted ➔ In Progress ➔ Completed).
    * Automated updates keeping booking parameters synced perfectly across both sides of the application.
* **Secure Payment Gateway Integration:**
    * Bridges client-side actions securely with backend order generation through the **Razorpay API**.
    * Protects financial workflows by validating cryptographic signature tokens before updating service records.

---

## Project Structure

```text
service-provider/
├── client/                 # React + Vite Frontend Application
│   ├── src/
│   │   ├── hooks/   
│   │   ├── pages/          # Functional View containers (Dashboards, Bookings, Marketplace)
│   │   ├── ui/             # UI related code
│   │   └── App.jsx         # Client-Side SPA Routing Engine
│   └── package.json
├── server/                 # Node.js + Express.js Backend Application
│   ├── config/             # Database connection & Environment setups
│   ├── controllers/        # Business logic controllers (User, Bookings, Payments)
│   ├── routes/             # REST API endpoint definitions
│   └── server.js           # Express Application Bootstrapper
├── package.json            # Monorepo Workspace Configuration
└── README.md

Local Setup and Installation

Follow these steps to configure your local development environment.
Prerequisites

    Node.js (v16.x or higher)

    PostgreSQL (Local instance or Cloud hosted e.g., Supabase/Aiven)

    Razorpay Merchant Account (Sandbox/Test API Keys)

1. Clone the Repository
Bash

git clone [https://github.com/sanskriti49/service-provider.git](https://github.com/sanskriti49/service-provider.git)
cd service-provider

2. Configure Environment Variables

Create a .env file inside the /server directory:
Code snippet

PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5173/taskgenie
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
JWT_SECRET=your_jwt_signing_token_secret

Create a .env file inside the /client directory:
Code snippet

VITE_API_BASE_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id

3. Install Dependencies & Run Locally
Setting up the Backend Server:
Bash

cd server
npm install
npm run dev # Runs with nodemon for active file-watch hot reloading

Setting up the Frontend Client:
Bash

cd ../client
npm install
npm run dev # Boots up local Vite server (typically at localhost:5173)
```
## Security & Optimization Best Practices Implemented

    Cryptographic Verification: Validates Razorpay webhooks and hashes signatures locally using standard Node.js crypto toolsets to guarantee payment authenticity.

    CORS Configuration: Explicit cross-origin allowance restrictions set up in the backend to ensure secure client-to-server transaction contexts.

    Normalized Database Relational Schemas: Strict data rules on cascading targets handle operations cleanly, preventing orphan rows across user profiles, service states, and invoice tracking maps.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

```    Fork the Project

    Create your Feature Branch (git checkout -b feature/AmazingFeature)

    Commit your Changes (git commit -m 'Add some AmazingFeature')

    Push to the Branch (git push origin feature/AmazingFeature)

    Open a Pull Request
