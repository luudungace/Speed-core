/**
 * Kiểm tra URL có phải bài viết forum/blog thực sự không
 * Loại bỏ: trang chủ, danh mục, trang định nghĩa, URL không có slug...
 */
export function isForumPost(url: string): boolean {
  console.log(`[FILTER CHECK] ${url}`);

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check if pathname is empty or just "/" (homepage/domain-only URLs)
    if (pathname === "/" || pathname === "") {
      console.log(`[FILTERED OUT] ${url} (Only domain/homepage)`);
      return false;
    }

    // Check if it's just a common landing/index page like /index.php, /forum.php, etc.
    const cleanPath = pathname.replace(/^\/+|\/+$/g, "");
    const homepageFiles = [
      "index.php",
      "index.html",
      "index.htm",
      "portal.php",
      "forum.php",
      "home.php",
      "index"
    ];
    if (homepageFiles.includes(cleanPath)) {
      console.log(`[FILTERED OUT] ${url} (Homepage index file)`);
      return false;
    }
  } catch (e) {
    console.log(`[FILTERED OUT] ${url} (Invalid URL format)`);
    return false;
  }

  const lower = url.toLowerCase();

  // Các pattern KHÔNG phải bài viết (loại bỏ)
  const excludePatterns = [
    // ===== TRANG ĐĂNG NHẬP / ĐĂNG KÝ =====
    /\/(login|register|signup|signin|account|auth|logout)\b/,

    // ===== TRANG USER / PROFILE =====
    /\/(members?|users?|profile|author)\//,

    // ===== DANH MỤC / INDEX =====
    /\/forums?\/?$/,
    /\/forums?\/[^/]+\/?$/,
    /\/categories?\/?$/,
    /\/tags?\/?$/,

    // ===== TRANG TÌM KIẾM / HỆ THỐNG =====
    /\/(search|find-new|sitemap|feed|rss|atom)\b/,
    /\/(help|rules|faq|tos|privacy|terms|about|contact)\b/,
    /\/(admin|wp-admin|dashboard|settings)\b/,

    // ===== PAGINATION =====
    /\/page-\d+\/?$/,
    /\/page\/\d+\/?$/,

    // ===== URL KẾT THÚC BẰNG TỪ CHUNG KHÔNG CÓ SLUG =====
    // /thread, /threads (không có slug đằng sau)
    /\/threads?\/?(\?.*)?$/,
    /\/[^/]+\/threads?\/?$/,

    // /forum, /forums
    /\/forums?\/?(\?.*)?$/,
    /\/[^/]+\/forums?\/?$/,

    // /blog, /blogs
    /\/blogs?\/?(\?.*)?$/,
    /\/[^/]+\/blogs?\/?$/,

    // /post, /posts
    /\/posts?\/?(\?.*)?$/,
    /\/[^/]+\/posts?\/?$/,

    // /article, /articles
    /\/articles?\/?(\?.*)?$/,
    /\/[^/]+\/articles?\/?$/,

    // /topic, /topics
    /\/topics?\/?(\?.*)?$/,
    /\/[^/]+\/topics?\/?$/,

    // /discussion, /discussions
    /\/discussions?\/?(\?.*)?$/,
    /\/[^/]+\/discussions?\/?$/,

    // /comment, /comments
    /\/comments?\/?(\?.*)?$/,
    /\/[^/]+\/comments?\/?$/,

    // /community, /communities
    /\/communit(y|ies)\/?(\?.*)?$/,
    /\/[^/]+\/communit(y|ies)\/?$/,

    // /board, /boards
    /\/boards?\/?(\?.*)?$/,
    /\/[^/]+\/boards?\/?$/,

    // /message, /messages
    /\/messages?\/?(\?.*)?$/,
    /\/[^/]+\/messages?\/?$/,

    // /news
    /\/news\/?(\?.*)?$/,
    /\/[^/]+\/news\/?$/,

    // /review, /reviews
    /\/reviews?\/?(\?.*)?$/,
    /\/[^/]+\/reviews?\/?$/,

    // /guide, /guides
    /\/guides?\/?(\?.*)?$/,
    /\/[^/]+\/guides?\/?$/,

    // /tutorial, /tutorials
    /\/tutorials?\/?(\?.*)?$/,
    /\/[^/]+\/tutorials?\/?$/,

    // /wiki
    /\/wiki\/?(\?.*)?$/,
    /\/[^/]+\/wiki\/?$/,

    // /question, /questions
    /\/questions?\/?(\?.*)?$/,
    /\/[^/]+\/questions?\/?$/,

    // /answer, /answers
    /\/answers?\/?(\?.*)?$/,
    /\/[^/]+\/answers?\/?$/,

    // /chat
    /\/chat\/?(\?.*)?$/,
    /\/[^/]+\/chat\/?$/,

    // /newsletter
    /\/newsletters?\/?(\?.*)?$/,

    // /archive, /archives
    /\/archives?\/?(\?.*)?$/,

    // ===== TRANG CHỈ LÀ DOMAIN / HOMEPAGE =====
    /^https?:\/\/[^/]+\/?$/,

    // ===== DICTIONARY / DEFINITION PAGES =====
    /\/(dictionary|definition|meaning|wiki)\/[^/]+\/?$/,

    // ===== FILE KHÔNG PHẢI HTML =====
    /\.(pdf|jpg|jpeg|png|gif|svg|mp4|mp3|zip|rar|doc|docx|xls|xlsx)\/?$/,
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(lower)) {
      console.log(`[FILTERED OUT] ${url}`);
      return false;
    }
  }

  // Các pattern LÀ bài viết (chắc chắn cho qua)
  const includePatterns = [
    // XenForo: /threads/tieu-de.12345/
    /\/threads\/[^/]+\.\d+/,
    // vBulletin: /showthread.php?t=12345
    /\/showthread\.php/,
    // phpBB: /viewtopic.php?t=12345
    /\/viewtopic\.php/,
    // IPB/Invision: /topic/12345-slug
    /\/topic\/\d+-/,
    // MyBB: /thread-12345.html
    /\/thread-\d+/,
    // Discourse: /t/slug/12345
    /\/t\/[^/]+\/\d+/,
    // WordPress: /2024/01/slug
    /\/\d{4}\/\d{2}\/[^/]+/,
    // WordPress: /slug-bai-viet/ (có dấu -)
    /\/[^/]+-[^/]+-[^/]+/,
    // Blog có slug rõ ràng: /blog/slug-bai-viet
    /\/blogs?\/[^/]+-[^/]+/,
    // News có slug: /news/slug-bai-viet
    /\/news\/[^/]+-[^/]+/,
    // Article có slug: /article/slug hoặc /articles/slug
    /\/articles?\/[^/]+-[^/]+/,
    // Post có slug hoặc ID
    /\/posts?\/[^/]+-[^/]+/,
    /\/posts?\/\d+/,
    // Generic: URL có số ID dài (4+ chữ số)
    /\/\d{4,}/,
    // URL có .html/.htm cuối (thường là bài viết)
    /\/[^/]+-[^/]+\.html?$/,
    // Discussion có slug
    /\/discussions?\/[^/]+-[^/]+/,
    // Guide có slug
    /\/guides?\/[^/]+-[^/]+/,
    // Review có slug
    /\/reviews?\/[^/]+-[^/]+/,
  ];

  for (const pattern of includePatterns) {
    if (pattern.test(lower)) return true;
  }

  // Mặc định: cho qua nếu URL có ít nhất 3 segment path
  const path = lower.replace(/^https?:\/\/[^/]+/, "");
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2) return true;

  console.log(`[FILTERED OUT] ${url}`);
  return false;
}

/**
 * Kiểm tra nội dung có phải trang yêu cầu đăng nhập không
 */
export function isLoginGatedContent(content: string): boolean {
  const lower = content.toLowerCase();

  const loginIndicators = [
    "you must be logged in",
    "please log in",
    "đăng nhập để xem",
    "bạn cần đăng nhập",
    "you must register",
    "vui lòng đăng nhập",
    "register to see",
    "login to view",
    "bạn phải đăng nhập",
    "you need to login",
    "sign in to continue",
    "log in to continue",
    "please login to view",
    "you must be a member",
    "members only",
    "registered members only",
    "bạn chưa đăng nhập",
    "hãy đăng nhập",
    "yêu cầu đăng nhập",
  ];

  // Nếu nội dung quá ngắn + chứa từ khóa đăng nhập → bị gate
  if (content.length < 500) {
    for (const indicator of loginIndicators) {
      if (lower.includes(indicator)) return true;
    }
  }

  return false;
}