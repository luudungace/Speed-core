const imapSimple = require("imap-simple");
const { simpleParser } = require("mailparser");

async function checkFolders() {
  const config = {
    imap: {
      user: "mama0874160121@gmail.com",
      password: "usthgnegwcpchsoa",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    console.log("Connecting to IMAP...");
    const connection = await imapSimple.connect(config);
    console.log("Connected successfully!");

    // Helper to search and print emails in a box
    async function inspectBox(boxName) {
      try {
        console.log(`\n--- Inspecting ${boxName} ---`);
        await connection.openBox(boxName);
        const messages = await connection.search(["ALL"], { bodies: ["HEADER", ""], struct: true });
        console.log(`Found ${messages.length} messages in ${boxName}.`);
        
        const recent = messages.slice(-10);
        for (const msg of recent.reverse()) {
          const allPart = msg.parts.find(p => p.which === "");
          if (allPart) {
            const parsed = await simpleParser(allPart.body);
            console.log(`  Subject: "${parsed.subject}" | From: "${parsed.from?.text}" | Date: ${parsed.date}`);
          } else {
            const headerPart = msg.parts.find(p => p.which === "HEADER");
            console.log(`  Header body keys: ${Object.keys(headerPart.body || {})}`);
          }
        }
      } catch (e) {
        console.log(`Failed to inspect ${boxName}: ${e.message}`);
      }
    }

    // Inspect INBOX
    await inspectBox("INBOX");

    // Inspect Spam (Thai: [Gmail]/จดหมายขยะ)
    await inspectBox("[Gmail]/จดหมายขยะ");

    // Inspect All Mail (Thai: [Gmail]/อีเมลทั้งหมด)
    await inspectBox("[Gmail]/อีเมลทั้งหมด");

    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkFolders();
