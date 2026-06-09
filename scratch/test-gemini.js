const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) return;
      const eq = clean.indexOf('=');
      if (eq > 0) {
        let v = clean.substring(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[clean.substring(0, eq).trim()] = v;
      }
    });
  }
}
loadEnv();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Using Gemini API Key:', apiKey);

  const prompt = 'Hello, reply with "Success" if you read this.';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testGemini();
