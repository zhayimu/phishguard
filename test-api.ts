import dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/stats");
    console.log(res.status);
    console.log(await res.text());
  } catch (err) {
    console.error(err);
  }
}
test();
