# PhishGuardian Security

PhishGuardian Security is a comprehensive phishing simulation and awareness training platform. It allows administrators to launch simulated phishing campaigns to user (employee) emails, track their interactions, and provide engaging, real-time educational content when users fall for the simulated attacks.

## Features

- **Dashboard:** An intuitive admin interface to view overall simulation statistics, click-through rates, and "at-risk" users who frequently interact with simulated phishing emails.
- **Campaign Launcher:** Launch targeted phishing campaigns with customizable templates to a list of target emails.
- **Real-time Tracking:** Accurately track link clicks utilizing unique base64 encoded tracking identifiers for each target, associating the interaction with the specific employee and simulation.
- **Educational Landing Pages:** Automatically redirect users who click on a simulated phishing link to an educational training page, detailing red flags and improving their security awareness.
- **Full-Stack Architecture:** Built on a robust Vite/React frontend and Express backend, utilizing Supabase as the underlying database.

## Technologies Used

- **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion (for animations), Recharts (for dashboard analytics), Lucide-React (icons).
- **Backend:** Node.js, Express, `nodemailer` (for sending SMTP emails).
- **Database:** Supabase (PostgreSQL) + Supabase JS Client for logging and analytics.
- **Authentication/APIs:** Node-based REST API to manage sending and database insertions.

## Getting Started

### Prerequisites

You will need the following accounts/tools:
- Node.js (v18+)
- A [Supabase](https://supabase.com/) account and project.
- An SMTP provider to send out simulated phishing emails (e.g., Gmail App Passwords, SendGrid, Mailgun).

### 1. Database Setup (Supabase)

Create the following tables in your Supabase project (you can run this in the SQL Editor):

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the simulations table
CREATE TABLE IF NOT EXISTS simulations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the tracking_logs table
CREATE TABLE IF NOT EXISTS tracking_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id TEXT REFERENCES simulations(id) ON DELETE CASCADE,
    employee_email TEXT NOT NULL,
    user_agent TEXT,
    ip TEXT,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Environment Variables

Create a `.env` file in the root of your project based on the `.env.example` file.

```env
# Node Environment
NODE_ENV="development"
APP_URL="http://localhost:3000"

# Supabase
VITE_SUPABASE_URL="https://YOUR_SUPABASE_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_URL="https://YOUR_SUPABASE_ID.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Email Configuration (SMTP)
SMTP_HOST="smtp.gmail.com" # Example for Gmail
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASS="your-app-specific-password"
SMTP_FROM_NAME="PhishGuardian Security"
```

### 3. Installation

Run the following command to install dependencies:

```bash
npm install
```

### 4. Running the Development Server

Start the full-stack development server (Express + Vite):

```bash
npm run dev
```

Visit `http://localhost:3000` to view the running application!

### 5. Production Build

To build the application for production deployment:

```bash
npm run build
npm run start
```
