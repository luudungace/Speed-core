// Using global fetch

async function test() {
  const payload = {
    forumUrl: "https://forum.ftcommunity.de/viewtopic.php?f=4&t=9732",
    postedUrl: "https://forum.ftcommunity.de/viewtopic.php?f=4&t=9732/./index.php/threads/hello-world-451",
    status: "success",
    details: {
      username: "onghyr",
      emailUsed: "mama0874160121@gmail.com"
    }
  };

  try {
    const res = await fetch("http://localhost:3001/api/posted-backlinks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Response JSON:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
test();
