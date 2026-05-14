-- PhishGuardian Supabase Schema

-- 1. Simulations Table
CREATE TABLE simulations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_sent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tracking Logs Table
CREATE TABLE tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id TEXT REFERENCES simulations(id) ON DELETE CASCADE,
  employee_email TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip TEXT
);

-- 3. Function to increment total_sent
CREATE OR REPLACE FUNCTION increment_total_sent(sim_id TEXT, count INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE simulations
  SET total_sent = total_sent + count
  WHERE id = sim_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS (Row Level Security) - Simplified for demo
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated service-role operations
CREATE POLICY "Service Role Full Access" ON simulations FOR ALL TO service_role USING (true);
CREATE POLICY "Service Role Full Access" ON tracking_logs FOR ALL TO service_role USING (true);
