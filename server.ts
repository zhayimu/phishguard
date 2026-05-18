import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import dotenv from "dotenv";
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

// FIX: API key auth middleware — protects all /api routes
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return next(); // skip auth if API_KEY not configured
  const provided = req.headers["x-api-key"];
  if (provided !== apiKey) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }
  next();
}

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
      supabase.from("tracking_logs").select("*")
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

    const atRisk = logs
      ?.reduce((acc: any[], log: any) => {
        if (!acc.find((i) => i.employee_email === log.employee_email)) {
          acc.push({
            email: log.employee_email,
            clicks: logs.filter((l: any) => l.employee_email === log.employee_email).length,
          });
        }
        return acc;
      }, [])
      .sort((a: any, b: any) => b.clicks - a.clicks);

    res.json({ simulations: stats, atRisk });
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

    await supabase.from("tracking_logs").insert({
      employee_email: employeeEmail,
      simulation_id: simulationId,
      user_agent: req.headers["user-agent"],
      ip: req.ip,
      clicked_at: new Date().toISOString(),
    });

    let baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/['"]+/g, '').replace(/\/$/, '') : "";
    if (!baseUrl) {
      let host = req.get("host") || "";
      if (host.startsWith("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      baseUrl = proto + "://" + host;
    }
    res.redirect(`${baseUrl}/education?simId=${simulationId}`);
  } catch (err) {
    console.error("Tracking error:", err);
    res.redirect("/education?error=tracking_failed");
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

async function startServer() {
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
