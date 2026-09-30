# ScholarBites

**A university canteen ordering and management system.** Students and staff order food from campus
restaurants in a Flutter mobile app, pay online or from an in-app wallet, and collect their order
with a QR code. Restaurant staff, university admins and event heads each get their own web panel,
all served by one Node.js backend.

Built for Ahmedabad University as a Software Engineering project.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Production build](#production-build)
- [Troubleshooting](#troubleshooting)

## Features

### Mobile app (students and staff)

- **Phone + OTP sign-in** with JWT sessions.
- **Browse restaurants and menus** by category, with search, price filters and favorites.
- **Cart and checkout** across one or several restaurants in a single order.
- **Order types:** takeaway, dine-in and hostel delivery.
- **Payments** through Razorpay, or from an **in-app wallet** with top-ups and coupon redemption.
- **Group orders:** create a lobby, share the code, let everyone add items, lock the order and
  split the payment per member.
- **QR pickup:** each order gets a QR token that the counter scans to hand it over.
- **Live order status** over Socket.IO, plus push notifications (Firebase Cloud Messaging).
- **Staff pre-orders and event orders** for university staff and event representatives.
- **Invoices as PDF**, order history, reviews and feedback.
- **Voice search** and animated UI (Rive, Lottie).

### Admin panel (restaurant and canteen staff)

- **Live orders board** that updates in real time, with a built-in QR scanner.
- **Menu, category and restaurant management**, including image uploads.
- **Order history, refunds and invoices.**
- **Statistics dashboard** with charts and Excel export.
- **Events calendar and pre-orders** with approval workflow.
- **Dean / event budget management** and fund-distribution reports.
- **Login** by email and password with OTP verification, or Google sign-in.

### Super admin panel

- **System and service health** dashboard.
- **Staff and university-staff management**, including bulk import.
- **Audit logs** of admin actions.
- **Stuck-order resolution** and a **refund queue**.
- **Locked-account handling** and **broadcast notifications** to all users.

### Event portal (deans and event heads)

- **Issue and revoke food coupons** against an allocated budget.
- **Track fund distribution** across representatives, with Excel export.

### Backend

- REST API with **role-based access** (user, staff, admin, super admin, dean).
- **Security middleware:** Helmet headers, CORS whitelist in production, request size limits,
  Zod input validation, and rate limiting (stricter limits on login and OTP endpoints).
- **Scheduled jobs** for notifications and cleanup of unpaid pending orders.
- **Self-healing schema:** missing tables are created at startup.

## Architecture

```mermaid
flowchart LR
    M[Flutter mobile app] -->|REST + Socket.IO| B
    A[Admin panel] -->|REST + Socket.IO| B
    S[Super admin panel] -->|REST| B
    E[Event portal] -->|REST| B
    B[Node.js + Express API] --> DB[(PostgreSQL)]
    B --> RZ[Razorpay]
    B --> S3[AWS S3]
    B --> FCM[Firebase Cloud Messaging]
    B --> SMTP[SMTP email]
```

In production the backend also serves the three built web panels as static files at `/admin`,
`/superadmin` and `/event`, so a single server hosts everything.

## Tech stack

| Layer | Technology |
|---|---|
| Mobile app | Flutter (Dart), Provider, Dio, Hive |
| Web panels | React 19, TypeScript, Vite, Tailwind CSS, Chart.js |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Realtime | Socket.IO |
| Payments | Razorpay |
| Storage | AWS S3 |
| Notifications | Firebase Cloud Messaging, Nodemailer (SMTP) |
| Auth | JWT, OTP, Google sign-in |

## Project structure

```
Scholar_Bites/
├── backend/            API server (Express + TypeScript + Prisma)
│   ├── prisma/         schema, migrations and seed scripts
│   └── src/            controllers, routes, middlewares, services
├── frontend/           Flutter mobile app
├── admin-panel/        React dashboard for restaurant and canteen staff
├── superadmin-panel/   React dashboard for system administrators
└── event-portal/       React portal for deans and event heads
```

## Getting started

### Prerequisites

| Tool | Version |
|---|---|
| [Node.js](https://nodejs.org/) | 18 or newer |
| [PostgreSQL](https://www.postgresql.org/download/) | 16 |
| [Flutter](https://docs.flutter.dev/get-started/install) | 3.x |

### 1. Clone

```bash
git clone https://github.com/KevalMGajjar/Scholar_Bites.git
cd Scholar_Bites
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE canteen_db;"
psql -U postgres -d canteen_db -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

### 3. Configure and start the backend

```bash
cd backend
npm install
```

Create `backend/.env` (see [Environment variables](#environment-variables)), then set up the
schema and seed data:

```bash
# Tables from the Prisma schema
npx prisma db push

# Tables and columns that Prisma does not manage
psql -U postgres -d canteen_db -f src/scripts/fixLocalSchema.sql
psql -U postgres -d canteen_db -f src/scripts/eventSchema.sql

# Universities, restaurants and menu items
npx ts-node prisma/seedProduction.ts

# Super admin and admin accounts (run after seedProduction)
npx ts-node prisma/seedAdmins.ts
```

`seedAdmins.ts` creates accounts with a default password set in the script. Change it before
running the script anywhere other than your own machine.

Start the server:

```bash
npm run dev
```

The API runs at `http://localhost:3000/api`. Keep this terminal open; every other app depends on
it.

### 4. Start the web panels

Each panel is a separate Vite app. In development they proxy `/api` to `http://localhost:3000`.
Run each in its own terminal:

```bash
cd admin-panel && npm install && npm run dev
cd superadmin-panel && npm install && npm run dev
cd event-portal && npm install && npm run dev
```

Vite prints the local URL for each one (the first starts on `http://localhost:5173`).

### 5. Run the mobile app

```bash
cd frontend
flutter pub get
```

Set the API address in `frontend/lib/utils/app_config.dart` to point at your backend:

| Running on | `baseUrl` |
|---|---|
| Android emulator | `http://10.0.2.2:3000/api` |
| iOS simulator | `http://localhost:3000/api` |
| Physical device | `http://<your-computer-ip>:3000/api` |

Then:

```bash
flutter run
```

## Environment variables

Create `backend/.env`:

```env
# Required
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/canteen_db?schema=public
JWT_SECRET=a-long-random-string

# Server
PORT=3000
SERVER_URL=http://localhost:3000
NODE_ENV=development
CORS_ORIGINS=

# Payments (Razorpay test keys work for development)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx

# Email for OTPs
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password

# Image uploads
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=

# Google sign-in for the admin panel
GOOGLE_CLIENT_ID=
```

- Only `DATABASE_URL` and `JWT_SECRET` are required. The server refuses to start without them.
- Without the Razorpay, AWS or SMTP values the server still starts, but logs a warning and the
  related feature does not work.
- `CORS_ORIGINS` is a comma-separated whitelist. It is only enforced when `NODE_ENV=production`.
- For Gmail, `SMTP_PASS` must be an [App Password](https://myaccount.google.com/apppasswords),
  not your account password.
- Push notifications need a Firebase service account file at
  `backend/firebase-service-account.json`.

Never commit `.env`, service account files or private keys.

## Production build

Build the panels, then the backend. The backend serves the built panels itself.

```bash
cd admin-panel && npm run build
cd ../superadmin-panel && npm run build
cd ../event-portal && npm run build

cd ../backend
npm run build
NODE_ENV=production npm start
```

| Path | Serves |
|---|---|
| `/api` | REST API |
| `/admin` | Admin panel |
| `/superadmin` | Super admin panel |
| `/event` | Event portal |

## Troubleshooting

| Problem | Fix |
|---|---|
| `connect ECONNREFUSED :5432` | PostgreSQL is not running. Start the service. |
| `password authentication failed` | The password in `DATABASE_URL` is wrong. |
| `uuid_generate_v4() does not exist` | Run the `CREATE EXTENSION "uuid-ossp"` command from step 2. |
| `psql` is not recognized | Add PostgreSQL's `bin` folder to your `PATH`. |
| OTP email is not sent | Use a Gmail App Password in `SMTP_PASS`. |
| Flutter app shows "Connection refused" | Use your computer's local IP in `app_config.dart`, not `localhost`. |
| `/admin` returns "Admin panel not built" | Run `npm run build` in `admin-panel`, then restart the backend. |

## License

This is a private university project. All rights reserved.
