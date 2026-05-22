import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { PHISHING_TEMPLATES } from "./src/constants";

dotenv.config();

const app = express();
const PORT = 3000;

// FIX: Trust proxy so req.ip returns the real client IP behind load balancers
app.set("trust proxy", 1);

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());

app.get("/api/debug-host", (req, res) => {
  res.json({
    host: req.get("host"),
    hostname: req.hostname,
    protocol: req.protocol,
    originalUrl: req.originalUrl,
    xForwardedHost: req.headers["x-forwarded-host"],
    xForwardedProto: req.headers["x-forwarded-proto"],
    base: process.env.APP_URL || ""
  });
});

// FIX: Simple in-memory rate limiter for /api/send
const sendRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function sendRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = sendRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    sendRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many requests. Please wait before sending again." });
    return;
  }
  entry.count++;
  next();
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-do-not-use-in-prod";
const APP_PASSWORD = process.env.APP_PASSWORD || "admin123";

app.post("/api/login", (req: Request, res: Response) => {
  const { password } = req.body;
  // FIX: separate res.status().json() and return
  if (!password || password !== APP_PASSWORD) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
  res.json({ token });
});

// FIX: token auth middleware — protects all /api routes except login
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/login" || req.path === "/debug-host" || req.path === "/location") {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing or invalid token" });
    return;
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: token expired or invalid" });
  }
}

app.use("/api", requireAuth);

// List Simulations
app.get("/api/simulations", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("simulations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stats for Dashboard
app.get("/api/stats", async (req: Request, res: Response) => {
  try {
    const [
      { data: sims, error: simErr },
      { data: logs, error: logErr }
    ] = await Promise.all([
      supabase.from("simulations").select("id, name, total_sent").order('created_at', { ascending: false }),
      supabase.from("tracking_logs").select("*").order('clicked_at', { ascending: false })
    ]);

    if (simErr) throw simErr;
    if (logErr) throw logErr;

    const stats = sims?.map((sim) => {
      const clicks = logs?.filter((log) => log.simulation_id === sim.id).length || 0;
      return {
        ...sim,
        clicks,
        ctr: sim.total_sent > 0 ? (clicks / sim.total_sent) * 100 : 0,
      };
    });

    const atRiskMap = new Map<string, number>();
    logs?.forEach((log: any) => {
      atRiskMap.set(log.employee_email, (atRiskMap.get(log.employee_email) || 0) + 1);
    });
    const atRisk = Array.from(atRiskMap.entries())
      .map(([email, clicks]) => ({ email, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    res.json({ simulations: stats, atRisk, recentLogs: logs || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tracking Route — no auth (accessed by email recipients)
app.get("/track/:trackingId", async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  try {
    const decoded = Buffer.from(trackingId, "base64").toString("utf-8");
    const [employeeEmail, simulationId] = decoded.split(":");

    // FIX: separate res call and return to avoid TypeScript void/Response conflict
    if (!employeeEmail || !simulationId) {
      res.status(400).send("Invalid Tracking Link");
      return;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    let clientIp = req.ip || "";
    if (forwardedFor) {
      clientIp = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : forwardedFor[0];
    } else if (realIp) {
      clientIp = typeof realIp === 'string' ? realIp : realIp[0];
    }

    let userAgent = req.headers["user-agent"] || "";

    // Try to get geolocation from IP
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon`);
      const geoData = await geoRes.json();
      if (geoData && geoData.status === 'success') {
        userAgent += ` | Location: ${geoData.lat},${geoData.lon}`;
      }
    } catch (e) {
      console.error("IP Geolocation failed:", e);
    }

    const { data: insertedData } = await supabase.from("tracking_logs").insert({
      employee_email: employeeEmail,
      simulation_id: simulationId,
      user_agent: userAgent,
      ip: clientIp,
      clicked_at: new Date().toISOString(),
    }).select("id").single();

    let baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/['"]+/g, '').replace(/\/$/, '') : "";
    if (!baseUrl) {
      let host = req.get("host") || "";
      if (host.startsWith("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      baseUrl = proto + "://" + host;
    }
    const logIdParams = insertedData ? `&logId=${insertedData.id}` : "";
    res.redirect(`${baseUrl}/education?simId=${simulationId}${logIdParams}`);
  } catch (err) {
    console.error("Tracking error:", err);
    res.redirect("/education?error=tracking_failed");
  }
});

// Endpoint to store exact client location
app.post("/api/location", async (req: Request, res: Response) => {
  try {
    const { logId, lat, lon } = req.body;
    console.log("Received location:", { logId, lat, lon });
    if (!logId || !lat || !lon) {
      res.status(400).json({ error: "Missing parameters" });
      return;
    }
    const { data: existing } = await supabase.from("tracking_logs").select("user_agent").eq("id", logId).single();
    if (existing) {
      let baseUserAgent = existing.user_agent || '';
      if (baseUserAgent.includes('| Location:')) {
        baseUserAgent = baseUserAgent.split('| Location:')[0].trim();
      }
      const newUserAgent = `${baseUserAgent} | Location: ${lat},${lon}`;
      await supabase.from("tracking_logs").update({ user_agent: newUserAgent }).eq("id", logId);
      console.log("Updated log with location successfully");
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Location update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Send Phishing Email
app.post("/api/send", sendRateLimiter, async (req: Request, res: Response) => {
  const { simulationId, targetEmails, templateIdx, name } = req.body;

  // FIX: Fetch template locally on server side rather than taking object from client
  let template = req.body.template; // fallback to body
  if (templateIdx !== undefined && PHISHING_TEMPLATES && PHISHING_TEMPLATES[templateIdx]) {
    template = PHISHING_TEMPLATES[templateIdx];
  }

  // FIX: validate required fields with separate return
  if (!simulationId || !targetEmails || !template) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // FIX: ensure targetEmails is actually an array, not a string
  if (!Array.isArray(targetEmails)) {
    res.status(400).json({ error: "targetEmails must be an array of email addresses" });
    return;
  }

  try {
    const { error: insertError } = await supabase.from("simulations").insert({
      id: simulationId,
      name: name || simulationId,
      total_sent: 0,
    });
    if (insertError) throw insertError;

    let baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/['"]+/g, '').replace(/\/$/, '') : "";
    if (!baseUrl) {
      let host = req.get("host") || "";
      if (host.startsWith("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      baseUrl = proto + "://" + host;
    }

    const results = await Promise.all(
      targetEmails.map(async (email) => {
        try {
          const trackingId = Buffer.from(`${email}:${simulationId}`).toString("base64");
          const trackingUrl = `${baseUrl}/track/${trackingId}`;
          const html = template.content.replace(/\{\{TRACKING_LINK\}\}/g, trackingUrl);

          let fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
          if (!fromEmail.includes("@")) {
            fromEmail = "onboarding@resend.dev";
          }
          
          let fromStr = fromEmail;
          if (fromEmail !== "onboarding@resend.dev") {
            const senderName = template.senderName ? template.senderName.replace(/[<>"]/g, '').trim() : '';
            fromStr = senderName ? `"${senderName}" <${fromEmail}>` : fromEmail;
          }

          const { error } = await resend.emails.send({
            from: fromStr,
            to: email,
            subject: template.subject,
            html: html,
            text: `Please view this email in an HTML-compatible client. Link: ${trackingUrl}`,
          });

          if (error) {
            throw new Error(error.message);
          }

          return { email, status: "sent" };
        } catch (err: any) {
          return { email, status: "failed", error: err.message };
        }
      })
    );

    const sentCount = results.filter((r) => r.status === "sent").length;
    await supabase
      .from("simulations")
      .update({ total_sent: sentCount })
      .eq("id", simulationId);

    res.json({ results });
  } catch (err: any) {
    console.error("Failed to send simulation:", err);
    res.status(500).json({ error: err?.message || err?.details || JSON.stringify(err) });
  }
});

// Delete simulation
app.delete("/api/simulations/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("simulations").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete simulation:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;

async function startServer() {
  // Skip starting the server if running in Vercel (Vercel uses the exported app as a serverless function)
  if (process.env.VERCEL) return;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PhishGuardian Server running on http://localhost:${PORT}`);
  });
}

startServer();
