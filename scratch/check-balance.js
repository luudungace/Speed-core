async function checkBalance() {
  const apiKey = "bc02c00d165d46544bf7a7fafa05c960";
  console.log("Checking 2Captcha balance...");
  try {
    const res = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=getbalance&json=1`);
    const data = await res.json();
    console.log("2Captcha response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("2Captcha check failed:", e.message);
  }

  console.log("\nChecking CapSolver balance...");
  try {
    const res = await fetch("https://api.capsolver.com/getBalance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientKey: apiKey })
    });
    const data = await res.json();
    console.log("CapSolver response:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("CapSolver check failed:", e.message);
  }
}

checkBalance();
