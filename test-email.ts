import { PHISHING_TEMPLATES } from "./src/constants";
const template = PHISHING_TEMPLATES[0];
const baseUrl = "http://localhost:3000";
const email = "user@test.com";
const simulationId = "sim123";
const trackingId = Buffer.from(`${email}:${simulationId}`).toString("base64");
const trackingUrl = `${baseUrl}/track/${trackingId}`;
const html = template.content.replace(/\{\{TRACKING_LINK\}\}/g, trackingUrl);
console.log(html);
