/**
 * SPEED-CORE REAL-TIME EMAIL AUTO-IMPORTER
 * 
 * This daemon script runs in the background. It continuously monitors your Supabase database.
 * The instant it detects that you have run the migration and created the 'emails' table,
 * it will automatically insert 'mama0874160121@gmail.com' with password 'Google123@' into the pool!
 * 
 * Run using: node add_mail.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env keys directly from the local .env
const envContent = fs.readFileSync('.env', 'utf8');
const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceRole = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !serviceRole) {
  console.error("Thiếu tham số kết nối Supabase trong file .env");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function autoImport() {
  const emailInput = 'mama0874160121@gmail.com';
  const passwordInput = 'Google123@';
  
  console.log(`\x1b[36m[Auto-Importer] Trình lắng nghe cơ sở dữ liệu đã bắt đầu! Đang chờ bạn tạo bảng...\x1b[0m`);
  
  while (true) {
    try {
      // Check if table 'emails' exists by attempting a basic select
      const { data, error } = await supabase
        .from('emails')
        .select('id')
        .limit(1);

      if (error) {
        // Table doesn't exist yet, we wait and repeat
        if (error.message.includes("relation") && error.message.includes("does not exist")) {
          // Table not created yet, safe to sleep and poll again
          process.stdout.write(".");
        } else {
          console.error(`\n[Auto-Importer] Lỗi kết nối khác: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // If we reach here, the table exists! Let's insert the email immediately!
      console.log(`\n\x1b[32m[Auto-Importer] 🎉 Phát hiện bảng 'emails' đã được kích hoạt thành công!\x1b[0m`);
      console.log(`[Auto-Importer] Đang tiến hành nạp email [${emailInput}]...`);

      const { data: insertData, error: insertError } = await supabase
        .from('emails')
        .insert([
          {
            email: emailInput,
            password: passwordInput,
            imap_host: 'imap.gmail.com',
            imap_port: 993,
            status: 'available'
          }
        ])
        .select();

      if (insertError) {
        if (insertError.message.includes("already exists")) {
          console.log(`\x1b[33m[Auto-Importer] ⚠️ Email [${emailInput}] đã tồn tại sẵn trong hệ thống của bạn.\x1b[0m`);
        } else {
          console.error(`\x1b[31m[Auto-Importer] Lỗi khi nạp email: ${insertError.message}\x1b[0m`);
        }
      } else {
        console.log(`\x1b[32m[Auto-Importer] ✅ NẠP EMAIL THÀNH CÔNG! [${emailInput}] đã có trong kho dữ liệu của bạn và sẵn sàng đi link!\x1b[0m`);
      }
      
      break; // Stop the daemon
      
    } catch (err) {
      // Fail-safe catch
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

autoImport();
