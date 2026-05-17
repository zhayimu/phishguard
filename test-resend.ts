import dotenv from "dotenv";
import { Resend } from "resend";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  const { data, error } = await resend.emails.send({
    from: "\"IT Support\" <onboarding@resend.dev>",
    to: "zaimzaidi04@gmail.com",
    subject: "Test",
    html: "<p>Test</p>",
  });
  console.log(error || data);
}
test();
