export interface Simulation {
  id: string;
  name: string;
  total_sent: number;
  created_at: string;
  clicks?: number;
  ctr?: number;
}

export interface TrackingLog {
  id: string;
  employee_email: string;
  simulation_id: string;
  user_agent: string;
  ip: string;
  clicked_at: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  senderName: string;
  content: string;
}
