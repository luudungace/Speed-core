import fs from "fs";
import path from "path";

export class GoogleSheetsService {
  /**
   * Automatically pushes successful backlink credentials and thread URLs
   * to an external Google Sheet to satisfy Task 4.2 of the PRD.
   */
  async syncBacklinkToGoogleSheet(data: {
    forumUrl: string;
    postedUrl: string;
    username: string;
    emailUsed: string;
  }): Promise<boolean> {
    const logPrefix = "[Google Sheets Sync]";
    console.log(`${logPrefix} Bắt đầu đồng bộ backlink mới: ${data.postedUrl}`);

    try {
      // Look for Google Sheets Service Account credentials file in workspace root
      const credsPath = path.join(process.cwd(), "google-credentials.json");
      
      if (!fs.existsSync(credsPath)) {
        console.warn(
          `${logPrefix} ⚠️ Không tìm thấy file 'google-credentials.json' trong thư mục gốc.`
        );
        console.warn(
          `${logPrefix} Bỏ qua đồng bộ Google Sheets trực tiếp. (Dữ liệu đã được lưu trữ an toàn trong Supabase và sẵn sàng để tải xuống dưới dạng file XLSX).`
        );
        return false;
      }

      // If credentials file exists, we can dynamically load googleapis to execute sheet operations
      // We check if googleapis package is installed, otherwise log instruction.
      try {
        const { google } = require("googleapis");
        const credentials = JSON.parse(fs.readFileSync(credsPath, "utf8"));
        
        const auth = new google.auth.JWT(
          credentials.client_email,
          null,
          credentials.private_key,
          ["https://www.googleapis.com/auth/spreadsheets"]
        );

        const sheets = google.sheets({ version: "v4", auth });
        
        // Read Spreadsheet ID from environment or fallback
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        if (!spreadsheetId) {
          console.warn(`${logPrefix} ⚠️ Thiếu biến môi trường GOOGLE_SPREADSHEET_ID trong file .env.`);
          return false;
        }

        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Sheet1!A:E",
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                new Date().toLocaleString("vi-VN"),
                data.forumUrl,
                data.postedUrl,
                data.username,
                data.emailUsed,
              ],
            ],
          },
        });

        console.log(`${logPrefix} ✅ Đồng bộ Google Sheet thành công!`);
        return true;
      } catch (innerErr) {
        console.error(`${logPrefix} Gặp lỗi khi giao tiếp với Google Sheets API:`, innerErr);
        return false;
      }
    } catch (err) {
      console.error(`${logPrefix} Lỗi đọc cấu hình đồng bộ:`, err);
      return false;
    }
  }
}
