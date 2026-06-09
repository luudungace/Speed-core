const fs = require('fs');
const path = require('path');

// Basic env parser
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value.trim();
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Thiếu biến môi trường Supabase trong tệp .env!");
  process.exit(1);
}

async function resetAll() {
  try {
    console.log("♻️ Đang kết nối tới Supabase để giải phóng tài nguyên...");
    
    // 1. Reset emails
    const emailRes = await fetch(`${supabaseUrl}/rest/v1/emails?id=not.is.null`, {
      method: "PATCH",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        status: "available",
        locked_at: null
      })
    });
    
    if (emailRes.ok) {
      console.log("✅ Đã hoàn trả trạng thái tất cả Email về 'available' thành công!");
    } else {
      const errorBody = await emailRes.text();
      console.error(`❌ Thất bại khi giải phóng Email: Status ${emailRes.status} - ${errorBody}`);
    }

    // 2. Reset proxies
    const proxyRes = await fetch(`${supabaseUrl}/rest/v1/proxies?id=not.is.null`, {
      method: "PATCH",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        status: "available",
        locked_at: null
      })
    });

    if (proxyRes.ok) {
      console.log("✅ Đã hoàn trả trạng thái tất cả Proxy về 'available' thành công!");
    } else {
      const errorBody = await proxyRes.text();
      console.error(`❌ Thất bại khi giải phóng Proxy: Status ${proxyRes.status} - ${errorBody}`);
    }

  } catch (err) {
    console.error("❌ Lỗi trong quá trình reset:", err.message);
  }
}

resetAll();
