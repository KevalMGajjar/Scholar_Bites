# 🍽️ ScholarBites — University Canteen Management System

A full-stack multi-platform canteen management system for university campuses. Includes a mobile app (Flutter), admin panel, super admin panel, dean portal, and a Node.js/Express backend with PostgreSQL.

---

## 📁 Project Structure

```
Software/
├── backend/           → Node.js + Express + PostgreSQL API server
├── frontend/          → Flutter mobile app (Android/iOS)
├── admin-panel/       → React (Vite + Tailwind) admin dashboard
├── superadmin-panel/  → React (Vite + Tailwind) super admin dashboard
├── dean-portal/       → React (Vite + Tailwind) dean budget portal
└── README.md          → This file
```

---

## ⚙️ Prerequisites

Make sure you have the following installed on your machine:

| Tool         | Version       | Download Link                                         |
|-------------|---------------|-------------------------------------------------------|
| **Node.js** | v18 or higher | https://nodejs.org/                                   |
| **npm**     | v9+           | Comes with Node.js                                    |
| **PostgreSQL** | v14+       | https://www.postgresql.org/download/                  |
| **Flutter** | 3.x           | https://docs.flutter.dev/get-started/install           |
| **Git**     | Latest        | https://git-scm.com/downloads                         |

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd Software
```

---

### Step 2: Set Up PostgreSQL Database

1. **Open pgAdmin** or your preferred PostgreSQL client.
2. **Create a new database** called `canteen_db`:

```sql
CREATE DATABASE canteen_db;
```

3. Make sure the **uuid-ossp** extension is available (it's included by default in most PostgreSQL installs).

---

### Step 3: Configure Backend Environment

1. Navigate to the backend folder:

```bash
cd backend
```

2. Create a `.env` file by copying the example below:

```env
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/canteen_db?schema=public

# Server
PORT=3000
SERVER_URL=http://localhost:3000

# JWT Secret (use any random string)
JWT_SECRET=your-secret-key-here

# Razorpay (get test keys from https://dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXX

# SMTP Email (Gmail app password recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

> **Note:** For Gmail SMTP, you need to create an [App Password](https://myaccount.google.com/apppasswords). Regular passwords won't work with 2FA enabled.

---

### Step 4: Install Backend Dependencies & Initialize Database

```bash
# Install dependencies
npm install

# Push the Prisma schema to create all tables
npx prisma db push

# Run the fix script to add extra columns/tables not in Prisma
# Open pgAdmin or psql and run the contents of:
#   backend/src/scripts/fixLocalSchema.sql
#   backend/src/scripts/eventSchema.sql
```

**Using psql:**
```bash
psql -U postgres -d canteen_db -f src/scripts/fixLocalSchema.sql
psql -U postgres -d canteen_db -f src/scripts/eventSchema.sql
```

**Or paste the SQL directly in pgAdmin's query tool.**

---

### Step 5: Seed the Database (Initial Data)

Run the production seed script to create the default university, admin user, and restaurants:

```bash
npx ts-node prisma/seedProduction.ts
```

> This creates the initial university, super admin account, and sample restaurants. Note down the admin credentials printed in the console.

---

### Step 6: Start the Backend Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`. You should see:
```
🚀 Server running on port 3000
```

> Keep this terminal open. The backend must be running for all other apps to work.

---

### Step 7: Set Up the Admin Panel

Open a **new terminal**:

```bash
cd admin-panel
npm install
```

**For development:**
```bash
npm run dev
```
→ Opens at `http://localhost:5173`

**For production build:**
```bash
npm run build
```
→ The built files go into `admin-panel/dist/` and are served by the backend at `/admin`.

---

### Step 8: Set Up the Super Admin Panel

Open a **new terminal**:

```bash
cd superadmin-panel
npm install
```

**For development:**
```bash
npm run dev
```

**For production build:**
```bash
npm run build
```
→ Built files are served by the backend at `/superadmin`.

---

### Step 9: Set Up the Dean Portal

Open a **new terminal**:

```bash
cd dean-portal
npm install
```

**For development:**
```bash
npm run dev
```

**For production build:**
```bash
npm run build
```
→ Built files are served by the backend at `/dean`.

---

### Step 10: Set Up the Flutter Mobile App

Open a **new terminal**:

```bash
cd frontend
flutter pub get
```

**Update the API base URL:**

Find the API configuration file in the Flutter project and update the base URL to point to your local machine:

```
# For Android emulator:
http://10.0.2.2:3000

# For physical device (use your PC's local IP):
http://192.168.x.x:3000

# For iOS simulator:
http://localhost:3000
```

> To find your local IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

**Run the app:**
```bash
# For Android
flutter run

# For Web
flutter run -d chrome
```

---

## 🔑 Default Login Credentials

After running the seed script, you'll have:

| Role          | Login Method          | Notes                                    |
|---------------|-----------------------|------------------------------------------|
| Super Admin   | Email + Password      | Created during seeding (check console)   |
| Admin         | Email + Password      | Created during seeding                   |
| Staff         | Phone + OTP           | OTP is sent to the configured SMTP email |
| Mobile User   | Phone + OTP           | OTP is sent via SMS/console              |

---

## 📦 Tech Stack

| Layer       | Technology                                  |
|-------------|---------------------------------------------|
| Mobile App  | Flutter (Dart)                              |
| Admin Panel | React + Vite + TypeScript + Tailwind CSS    |
| Super Admin | React + Vite + TypeScript + Tailwind CSS    |
| Dean Portal | React + Vite + TypeScript + Tailwind CSS    |
| Backend     | Node.js + Express 5 + TypeScript            |
| Database    | PostgreSQL + Prisma ORM + raw SQL           |
| Realtime    | Socket.IO                                   |
| Payments    | Razorpay                                    |
| Storage     | AWS S3 (image uploads)                      |
| Auth        | JWT + OTP (2FA for staff)                   |
| Email       | Nodemailer + Gmail SMTP                     |

---

## 🗄️ Database Schema Notes

The project uses a **hybrid approach** — Prisma manages the core schema, but some columns and tables are added via raw SQL scripts for flexibility.

After running `npx prisma db push`, you **must** also run:

1. `backend/src/scripts/fixLocalSchema.sql` — Adds: `staff_login_otps`, `audit_logs`, `locked_accounts`, `global_notifications`, `refund_requests`, `user_favorites`, and extra columns on `restaurants`, `users`, `orders`, `staff`, etc.
2. `backend/src/scripts/eventSchema.sql` — Adds: `rejection_reason` column and new enum values (`approved`, `rejected`, `pending`) to `EventStatus`.

---

## 🛠️ Common Issues & Fixes

### 1. `Error: connect ECONNREFUSED 127.0.0.1:5432`
→ PostgreSQL is not running. Start the PostgreSQL service.

### 2. `Error: password authentication failed`
→ Check your `DATABASE_URL` in `.env`. Make sure the password matches your PostgreSQL user.

### 3. `uuid_generate_v4() does not exist`
→ Run this in your database:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 4. `SMTP connection failed`
→ Make sure you're using a Gmail **App Password**, not your regular password. Enable 2FA first.

### 5. Flutter `SocketException` or `Connection refused`
→ Update the API base URL to your machine's local IP if testing on a physical device.

### 6. Admin panel shows blank after build
→ Make sure you ran `npm run build` in the admin-panel, and the backend is serving the `dist/` folder.

---

## 🌐 Production Deployment

For AWS/VPS deployment:

1. Build all frontend panels: `npm run build` in each panel directory.
2. Set `SERVER_URL` in `.env` to your public IP/domain.
3. Use `pm2` or `systemd` to run the backend:
   ```bash
   npm run build
   pm2 start dist/server.js --name canteen-backend
   ```
4. Configure Nginx as a reverse proxy (optional but recommended).
5. Set up SSL with Let's Encrypt for HTTPS.

---

## 📄 License

This project is private and not licensed for public distribution.
