# MedTrack — Backend API

The backend service for **MedTrack**, a medication adherence tracking platform. Built with Express, TypeScript, MongoDB (Mongoose), and Better Auth. It exposes a REST API consumed by the MedTrack frontend (Next.js), handling authentication, medicine management, dose scheduling/logging, and the caregiver-patient linking system.

---

## Tech Stack

- **Runtime**: Node.js + Express
- **Language**: TypeScript (via `ts-node-dev` for local development)
- **Database**: MongoDB Atlas, accessed via Mongoose
- **Authentication**: [Better Auth](https://www.better-auth.com/) (email/password), using its own MongoDB-backed session store
- **Scheduling**: `node-cron` for daily dose generation and overdue-dose sweeps

---

## Prerequisites

- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB instance)
- npm

---

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Create a `.env` file in the `backend/` directory:

```dotenv
PORT=5000

# MongoDB connection string (non-SRV format recommended — see note below)
MONGO_URI=mongodb://<username>:<password>@<host1>:27017,<host2>:27017,<host3>:27017/medtrack?ssl=true&replicaSet=<replica-set-name>&authSource=admin&appName=Cluster0

# Better Auth
BETTER_AUTH_SECRET=<a-long-random-string>
BETTER_AUTH_URL=http://localhost:3000
```

> **Note on `MONGO_URI`:** If you experience DNS resolution errors with the `mongodb+srv://` format (common on some Windows/network setups), use the standard `mongodb://` format with explicit shard hostnames and ports instead, as shown above. You can get these from MongoDB Atlas under **Connect → Drivers**, or by running `nslookup -type=SRV _mongodb._tcp.<cluster-address>` to resolve the individual shard hosts.

### 3. Run the development server

```bash
npm run dev
```

This starts the server with `ts-node-dev`, which watches for file changes and auto-restarts (equivalent to nodemon + ts-node). You should see:

```
Initializing MedTrack API...
Server is running on port 5000
Mongoose connected to MongoDB successfully.
```

### 4. Build for production

```bash
npm run build
npm start
```

---

## Project Structure

```
backend/
├── src/
│   ├── env.ts                  # Loads dotenv — MUST be the first import in server.ts
│   ├── server.ts                # Express app entry point, middleware, route mounting, cron jobs
│   ├── config/
│   │   ├── auth.ts              # Better Auth configuration (Mongo adapter, secret, baseURL)
│   │   └── db.ts                # Mongoose connection setup
│   ├── middleware/
│   │   └── auth.ts              # authenticateUser — validates Better Auth sessions on protected routes
│   ├── models/
│   │   ├── User.ts               # Custom user schema (points at Better Auth's `user` collection)
│   │   ├── Medicine.ts
│   │   ├── DoseLog.ts
│   │   └── LinkedAccount.ts      # Caregiver ↔ patient link/invite records
│   ├── controllers/
│   │   ├── medicineController.ts
│   │   ├── doseLogController.ts
│   │   └── linkController.ts
│   ├── routes/
│   │   ├── medicineRoutes.ts
│   │   ├── doseLogRoutes.ts
│   │   └── linkRoutes.ts
│   └── utils/
│       ├── generateDailyDoses.ts    # Cron job + per-medicine dose generation
│       └── markOverdueMissed.ts     # Cron job — flags unactioned doses as "missed"
└── .env
```

---

## Authentication

Authentication is handled entirely by **Better Auth**, backed by MongoDB. Custom fields (like `role`) are added via Better Auth's `additionalFields` config in `config/auth.ts`.

- **Sign up**: `POST /api/auth/sign-up/email`
- **Sign in**: `POST /api/auth/sign-in/email`
- **Sign out**: `POST /api/auth/sign-out`
- **Session check**: handled internally via `auth.api.getSession()` in the `authenticateUser` middleware, which every protected route uses.

> ⚠️ **Important:** Better Auth manages its own `user` collection (singular, lowercase). If you query users via a custom Mongoose model, ensure it's pointed at the same collection:
> ```typescript
> export const User = model<IUser>('User', UserSchema, 'user');
> ```
> Without the third argument, Mongoose defaults to `users` (pluralized), which will silently diverge from Better Auth's actual data.

---

## Core Concepts & Usage

### User roles

Every user has a `role`: either `'patient'` or `'caregiver'`, set at sign-up. This determines which set of routes and frontend dashboards apply to them.

### 1. Medicines (patient-only)

A patient adds medicines they need to track. Each medicine has a name, dosage, frequency per day, and specific scheduled times.

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/medicines` | Create a new medicine. Automatically generates today's doses immediately. |
| `GET` | `/api/medicines` | List all active medicines for the logged-in user. |
| `GET` | `/api/medicines/:id` | Get a single medicine by ID. |
| `PUT` | `/api/medicines/:id` | Update a medicine. Regenerates today's doses if times/frequency changed. |
| `DELETE` | `/api/medicines/:id` | Soft-delete (deactivate) a medicine. |

**Example request body for `POST /api/medicines`:**
```json
{
  "name": "Lisinopril",
  "dosage": "10mg",
  "frequencyPerDay": 2,
  "times": ["08:00", "20:00"],
  "pillsRemaining": 30,
  "pillsPerDose": 1,
  "lowStockThreshold": 5,
  "notes": "Take with food"
}
```

### 2. Dose logs

Each scheduled time for each medicine generates a `DoseLog` entry per day, with a status of `pending`, `taken`, `skipped`, or `missed`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/doses/today` | Get today's doses for the logged-in patient. |
| `PUT` | `/api/doses/:id/status` | Mark a dose as `taken` or `skipped`. |
| `GET` | `/api/doses/adherence` | Aggregated daily adherence stats over a date range (`?startDate=&endDate=`). |
| `GET` | `/api/doses/history` | Detailed list of individual dose logs over a date range. |

**Marking a dose taken — grace window:** A dose can only be marked `taken` starting 30 minutes before its scheduled time (configurable via `EARLY_TAKEN_GRACE_MINUTES` in `doseLogController.ts`). This prevents logging doses hours in advance. Marking a dose `skipped` has no time restriction.

**Automatic housekeeping (via cron, in `server.ts`):**
- **00:05 daily** — `generateDailyDoses()` creates today's `DoseLog` entries for every active medicine.
- **Hourly** — `markOverdueMissed()` sweeps any `pending` dose whose scheduled time has passed (with grace period) and marks it `missed`.

### 3. Caregiver ↔ Patient linking

A caregiver can request to monitor a patient's adherence remotely. This is a mutual, revocable relationship — nothing happens without the patient's consent.

**Flow:**
1. Caregiver sends an invite by the patient's email: `POST /api/links/invite`
2. Patient sees the pending invite on their dashboard and responds: `PUT /api/links/:id/respond` with `{ "action": "accept" }` or `{ "action": "decline" }`
3. Once accepted, the caregiver can view (but not edit) that patient's schedule and adherence.

| Method | Route | Who | Description |
|---|---|---|---|
| `POST` | `/api/links/invite` | Caregiver | Send an invite to a patient by email. |
| `GET` | `/api/links/sent-invites` | Caregiver | List invites sent, still pending. |
| `GET` | `/api/links/invites` | Patient | List incoming pending invites. |
| `PUT` | `/api/links/:id/respond` | Patient | Accept or decline an invite. |
| `GET` | `/api/links/patients` | Caregiver | List linked (accepted) patients, with today's adherence summary. |
| `GET` | `/api/links/caregivers` | Patient | List linked (accepted) caregivers. |
| `DELETE` | `/api/links/:id` | Either | Unlink an accepted connection. |
| `GET` | `/api/links/patients/:patientId/doses` | Caregiver | Get a specific linked patient's today's doses + 30-day adherence history. Requires an accepted link. |

A caregiver **cannot** add, edit, or delete a patient's medicines or dose logs — the role is strictly observational.

---

## Environment & Deployment Notes

- All routes except `/health` and `/api/auth/*` require an authenticated session — the `authenticateUser` middleware runs on every request to `/api/medicines`, `/api/doses`, and `/api/links`.
- CORS is configured for `http://localhost:3000` (the frontend's dev origin) with `credentials: true`, required for cookies to be sent cross-origin. Update this in `server.ts` before deploying.
- **Load order matters:** `env.ts` (which calls `dotenv.config()`) must be the very first import in `server.ts`. Since Better Auth's config reads `process.env` at module-load time, importing it before environment variables are loaded will cause it to silently fall back to defaults (e.g. connecting to `localhost:27017` instead of your Atlas cluster).

---

## Troubleshooting

**"MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017"**
Better Auth's Mongo client is reading `MONGO_URI` as `undefined` and falling back to localhost. Check that `env.ts` is imported before any file that initializes Better Auth.

**"querySrv ECONNREFUSED" on startup**
DNS SRV lookup for `mongodb+srv://` failed. Switch to the standard `mongodb://` connection string format with explicit shard hostnames (see setup step 2 above).

**A user exists in Atlas but queries for them return nothing**
Check that any custom Mongoose `User` model is pointed at the same collection Better Auth uses (`'user'`, singular) via the third argument to `model()`.