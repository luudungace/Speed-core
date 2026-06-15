const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcWZqa21ka2hlYmRnc3Nwd25yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY5MTE0OSwiZXhwIjoyMDk1MjY3MTQ5fQ.ouFdasLKvG5GnACI5YrWy07MzaQUPATm6MOm_A5Ygkc";
const SUPABASE_URL = "https://foqfjkmdkhebdgsspwnr.supabase.co";
const EMAIL = "admin@speedcore.vn";
const PASSWORD = "SpeedCore@2026!";

async function createAdmin() {
  console.log(`\n🔐 Đang tạo tài khoản admin: ${EMAIL} ...`);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // bỏ qua bước xác thực email
    }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log(`\n✅ Tạo tài khoản thành công!`);
    console.log(`   Email   : ${data.email}`);
    console.log(`   ID      : ${data.id}`);
    console.log(`   Role    : ${data.role}`);
    console.log(`\n🔑 Thông tin đăng nhập:`);
    console.log(`   Email   : ${EMAIL}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`\n👉 Truy cập: http://localhost:3000/login`);
  } else {
    // Nếu email đã tồn tại, thử reset password
    if (data.message?.includes("already") || data.code === "email_exists") {
      console.log(`\n⚠️  Email đã tồn tại. Đang cập nhật mật khẩu...`);
      // List users để tìm ID
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
      });
      const listData = await listRes.json();
      const user = (listData.users || []).find(u => u.email === EMAIL);
      if (user) {
        const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: "PUT",
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
        });
        if (updateRes.ok) {
          console.log(`\n✅ Đã cập nhật mật khẩu thành công!`);
          console.log(`   Email   : ${EMAIL}`);
          console.log(`   Password: ${PASSWORD}`);
          console.log(`\n👉 Truy cập: http://localhost:3000/login`);
        } else {
          const errData = await updateRes.json();
          console.error("❌ Cập nhật thất bại:", errData);
        }
      }
    } else {
      console.error("\n❌ Lỗi:", JSON.stringify(data, null, 2));
    }
  }
}

createAdmin();
