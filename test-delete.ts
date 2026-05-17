async function test() {
  const res = await fetch("http://localhost:3000/api/simulations/sim_1778828487790", { method: "DELETE" });
  console.log(res.status);
  console.log(await res.text());
}
test();
