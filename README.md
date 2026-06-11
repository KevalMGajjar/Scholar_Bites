# 🍽️ ScholarBites — University Canteen Management System

Full-stack canteen management system with a Flutter mobile app, admin panel, super admin panel, dean portal, and Node.js backend.

---

## 📁 Project Structure

```
Software/
├── backend/           → API server (Node.js + Express + PostgreSQL)
├── frontend/          → Mobile app (Flutter)
├── admin-panel/       → Admin dashboard (React + Vite)
├── superadmin-panel/  → Super admin dashboard (React + Vite)
└── event-portal/      → Event head budget portal (React + Vite)
```

---

## ⚙️ What You Need Installed

| Tool           | Version  | Link                                          |
|----------------|----------|-----------------------------------------------|
| Node.js        | v18+     | https://nodejs.org/                           |
| PostgreSQL     | v16      | https://www.postgresql.org/download/          |
| Flutter        | 3.x      | https://docs.flutter.dev/get-started/install  |
| Git            | Latest   | https://git-scm.com/downloads                 |

> During PostgreSQL installation, remember the password you set for the `postgres` user. You'll need it later.

---

## 🚀 Setup Guide

Open **Windows PowerShell** for all commands below.

---

### 1. Clone the Repo

```powershell
git clone <your-repo-url>
cd Software
```

---

### 2. Create the Database

Run this in PowerShell (enter your postgres password when prompted):

```powershell
psql -U postgres -c "CREATE DATABASE canteen_db;"
```

Then enable the required extension:

```powershell
psql -U postgres -d canteen_db -c "CREATE EXTENSION IF NOT EXISTS ""uuid-ossp"";"
```

> If `psql` is not recognized, add PostgreSQL's `bin` folder to your PATH:
> `C:\Program Files\PostgreSQL\16\bin`

---

### 3. Set Up the Backend

```powershell
cd backend
npm install
```

Create a `.env` file inside the `backend/` folder with this content:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/canteen_db?schema=public
PORT=3000
SERVER_URL=http://localhost:3000
JWT_SECRET=any-random-secret-string

RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXX

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

> Replace `YOUR_PASSWORD` with your PostgreSQL password.
> For Gmail SMTP, create an [App Password](https://myaccount.google.com/apppasswords) (requires 2FA enabled).

---

### 4. Initialize the Database

Run these commands one by one:

```powershell
# Create tables from Prisma schema
npx prisma db push

# Add extra tables and columns not managed by Prisma
psql -U postgres -d canteen_db -f src/scripts/fixLocalSchema.sql
psql -U postgres -d canteen_db -f src/scripts/eventSchema.sql

# Seed initial data (university, admin account, restaurants)
npx ts-node prisma/seedProduction.ts
```

> **Save the credentials** printed in the console after seeding — you'll need them to log in.

---

### 5. Start the Backend

```powershell
npm run dev
```

You should see: `🚀 Server running on port 3000`

> **Keep this terminal open.** Everything else depends on the backend running.

---

### 6. Set Up Admin Panel

Open a **new PowerShell window**:

```powershell
cd admin-panel
npm install
npm run dev
```

Opens at `http://localhost:5173`

For production: `npm run build` (output goes to `dist/`, served by backend at `/admin`).

---

### 7. Set Up Super Admin Panel

Open a **new PowerShell window**:

```powershell
cd superadmin-panel
npm install
npm run dev
```

For production: `npm run build` (served by backend at `/superadmin`).

---

### 8. Set Up Event Portal

Open a **new PowerShell window**:

```powershell
cd event-portal
npm install
npm run dev
```

For production: `npm run build` (served by backend at `/event`).

---

### 9. Set Up Flutter App

Open a **new PowerShell window**:

```powershell
cd frontend
flutter pub get
```

Update the API base URL in the app config:

- **Android emulator:** `http://10.0.2.2:3000`
- **Physical device:** `http://<your-pc-ip>:3000` (run `ipconfig` to find your IP)
- **iOS simulator:** `http://localhost:3000`

Run the app:

```powershell
flutter run
```

---

## 🔑 Default Logins

| Role          | Method           | Notes                                  |
|---------------|------------------|----------------------------------------|
| Super Admin   | Email + Password | Created during seeding (check console) |
| Admin         | Email + Password | Created during seeding                 |
| Staff         | Phone + OTP      | OTP sent to configured SMTP email      |
| Mobile User   | Phone + OTP      | OTP logged in backend console          |

---

## 📦 Tech Stack

| Layer       | Tech                                        |
|-------------|---------------------------------------------|
| Mobile App  | Flutter (Dart)                              |
| Web Panels  | React + Vite + TypeScript + Tailwind CSS    |
| Backend     | Node.js + Express 5 + TypeScript            |
| Database    | PostgreSQL 16 + Prisma ORM                  |
| Realtime    | Socket.IO                                   |
| Payments    | Razorpay                                    |
| Storage     | AWS S3                                      |
| Auth        | JWT + OTP                                   |
| Email       | Nodemailer + Gmail SMTP                     |

---

## 🛠️ Troubleshooting

| Error | Fix |
|-------|-----|
| `connect ECONNREFUSED :5432` | PostgreSQL service isn't running. Start it from Windows Services. |
| `password authentication failed` | Wrong password in `.env` `DATABASE_URL`. |
| `uuid_generate_v4() does not exist` | Run: `psql -U postgres -d canteen_db -c "CREATE EXTENSION IF NOT EXISTS ""uuid-ossp"";"` |
| `psql is not recognized` | Add `C:\Program Files\PostgreSQL\16\bin` to your system PATH. |
| `SMTP connection failed` | Use a Gmail App Password, not your regular password. |
| Flutter `Connection refused` | Use your PC's local IP (`ipconfig`) instead of `localhost`. |
| Admin panel blank after build | Run `npm run build` in admin-panel, then restart the backend. |

---

## 📄 License

Private project — not licensed for public distribution.
