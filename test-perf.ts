import dotenv from "dotenv";
dotenv.config();

async function test() {
  const start = Date.now();
  await fetch("http://localhost:3000/api/stats");
  console.log("Time (ms):", Date.now() - start);
}
test();
