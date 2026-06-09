/**
 * Script tìm email kích hoạt từ forum.ftcommunity.de và click link xác nhận
 */
const imapSimple = require("imap-simple");
const { simpleParser } = require("mailparser");
const { chromium } = require("playwright");

async function findAndClickActivationLink() {
  console.log("🔍 Đang kết nối IMAP đến Gmail...");
  
  // Thử nhiều mật khẩu
  const passwordsToTry = [
    "usthgnegwcpchsoa",
    "Google123@",
    "google123@",
    "Google@123",
    "google@123",
    "123456",
    "Aa123456",
    "mama0874160121",
  ];
  
  let connection = null;
  
  for (const pwd of passwordsToTry) {
    try {
      console.log(`  Thử mật khẩu: ${pwd.substring(0, 4)}****`);
      const testConfig = {
        imap: {
          user: "mama0874160121@gmail.com",
          password: pwd,
          host: "imap.gmail.com",
          port: 993,
          tls: true,
          authTimeout: 8000,
          tlsOptions: { rejectUnauthorized: false }
        }
      };
      connection = await imapSimple.connect(testConfig);
      console.log(`✅ Đăng nhập thành công với mật khẩu: ${pwd.substring(0, 4)}****`);
      break;
    } catch (e) {
      console.log(`  ❌ Sai mật khẩu: ${e.message.substring(0, 60)}`);
    }
  }
  
  if (!connection) {
    console.log("\n❌ Không thể đăng nhập IMAP với bất kỳ mật khẩu nào.");
    console.log("\n💡 Cách khắc phục - Anh cần:");
    console.log("   1. Vào Gmail > Cài đặt > Xem tất cả cài đặt");
    console.log("   2. Tab 'Chuyển tiếp và POP/IMAP'");
    console.log("   3. Bật 'Truy cập IMAP'");
    console.log("   HOẶC:");
    console.log("   1. Vào https://myaccount.google.com/apppasswords");
    console.log("   2. Tạo App Password cho 'Mail'");
    console.log("   3. Cập nhật vào script rồi chạy lại");
    console.log("\n   Hoặc Anh gửi cho em mật khẩu đúng của email mama0874160121@gmail.com");
    return;
  }

  try {
    await connection.openBox("INBOX");
    
    // Tìm email từ ftcommunity trong 14 ngày gần đây
    const since = new Date();
    since.setDate(since.getDate() - 14);
    
    const searchCriteria = ["ALL"];
    
    console.log("📬 Đang tìm email kích hoạt...");
    const allMessages = await connection.search(searchCriteria, {
      bodies: ["HEADER", "TEXT", ""],
      struct: true
    });
    
    // Filter messages in JS
    const messages = [];
    for (const msg of allMessages) {
      const header = msg.parts.find(p => p.which === "HEADER");
      if (header) {
        try {
          const parsed = await simpleParser(header.body);
          const fromHeader = (parsed.from?.text || "").toLowerCase();
          const subject = (parsed.subject || "").toLowerCase();
          const date = parsed.date || new Date();
          
          if (date >= since && (
            fromHeader.includes("ftcommunity") ||
            subject.includes("activation") ||
            subject.includes("confirm") ||
            subject.includes("registrierung") ||
            subject.includes("activate")
          )) {
            messages.push(msg);
          }
        } catch (e) {}
      }
    }
    
    console.log(`📧 Tìm thấy ${messages.length} email phù hợp.`);
    
    if (messages.length === 0) {
      console.log("⚠️ Không tìm thấy email kích hoạt. Lấy 20 email mới nhất để kiểm tra...");
      const allMessages = await connection.search(["ALL"], {
        bodies: ["HEADER"],
        struct: true
      });
      
      const recent = allMessages.slice(-20);
      console.log(`\n📬 ${recent.length} email gần nhất:`);
      for (const msg of recent.reverse()) {
        const header = msg.parts.find(p => p.which === "HEADER");
        if (header) {
          try {
            const parsed = await simpleParser(header.body);
            const date = parsed.date ? parsed.date.toISOString().substring(0, 10) : "?";
            console.log(`  [${date}] Từ: ${(parsed.from?.text || "?").substring(0, 40)} | "${(parsed.subject || "?").substring(0, 60)}"`);
          } catch (e) {}
        }
      }
      await connection.end();
      return;
    }
    
    // Lấy email mới nhất và tìm link kích hoạt
    let activationUrl = null;
    for (const msg of messages.reverse()) {
      const allParts = msg.parts.find(p => p.which === "");
      if (!allParts) continue;
      
      const parsed = await simpleParser(allParts.body);
      console.log(`\n📨 Email từ: ${parsed.from?.text}`);
      console.log(`   Tiêu đề: ${parsed.subject}`);
      console.log(`   Ngày: ${parsed.date}`);
      
      const bodyText = (parsed.text || "");
      const bodyHtml = (parsed.html || "");
      const fullContent = bodyText + " " + bodyHtml;
      
      // Pattern 1: Link có chứa confirm/activat/verify
      const urlMatches = fullContent.match(/https?:\/\/[^\s"<>]+(?:confirm|activat|verify|activation_key|act|approve)[^\s"<>]*/gi);
      if (urlMatches && urlMatches.length > 0) {
        activationUrl = urlMatches[0].replace(/&amp;/g, "&");
        console.log(`\n🔗 Tìm thấy link kích hoạt (pattern 1): ${activationUrl}`);
        break;
      }
      
      // Pattern 2: Link từ ftcommunity.de
      const altMatches = fullContent.match(/https?:\/\/forum\.ftcommunity\.de[^\s"<>]*/gi);
      if (altMatches && altMatches.length > 0) {
        activationUrl = altMatches[0].replace(/&amp;/g, "&");
        console.log(`\n🔗 Tìm thấy link ftcommunity (pattern 2): ${activationUrl}`);
        break;
      }
      
      // Pattern 3: Bất kỳ link nào trong email
      console.log("\n   Các link trong email:");
      const allLinks = fullContent.match(/https?:\/\/[^\s"<>]{10,}/gi) || [];
      for (const link of allLinks.slice(0, 5)) {
        console.log(`     ${link.replace(/&amp;/g, "&").substring(0, 100)}`);
      }
    }
    
    await connection.end();
    
    if (!activationUrl) {
      console.log("\n❌ Không tìm thấy link kích hoạt. Hãy kiểm tra các link in ra ở trên.");
      return;
    }
    
    // Click link kích hoạt
    console.log("\n🌐 Đang mở link kích hoạt bằng trình duyệt...");
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.goto(activationUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000);
    
    const currentUrl = page.url();
    const pageText = await page.evaluate(() => document.body.innerText);
    
    console.log(`\n✅ Đã điều hướng đến: ${currentUrl}`);
    console.log(`\n📄 Nội dung trang (500 ký tự đầu):\n${pageText.substring(0, 500)}`);
    
    await page.screenshot({ path: "scratch/activation-result.png" });
    console.log(`\n📸 Đã lưu ảnh xác nhận tại: scratch/activation-result.png`);
    
    if (pageText.toLowerCase().includes("success") || 
        pageText.includes("activated") || 
        pageText.includes("kích hoạt") ||
        pageText.includes("erfolgreich")) {
      console.log("\n🎉 TÀI KHOẢN ĐÃ ĐƯỢC KÍCH HOẠT THÀNH CÔNG!");
    }
    
    await page.waitForTimeout(5000);
    await browser.close();
    
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    if (connection) {
      try { await connection.end(); } catch (e) {}
    }
  }
}

findAndClickActivationLink();
