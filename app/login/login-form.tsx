"use client";

import { ArrowRight, Loader2, Lock, Mail, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { signUpAction } from "./actions";

type Tab = "login" | "register";

function translateUrlError(error?: string): string | undefined {
  switch (error) {
    case "email_verification_failed":
      return "Xác thực email thất bại. Vui lòng thử lại.";
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Email chưa được xác thực. Vui lòng kiểm tra hộp thư.";
    case "auth_failed":
      return "Đăng nhập thất bại. Vui lòng thử lại.";
    default:
      return undefined;
  }
}

export function LoginForm({ error }: { error?: string }) {
  const urlError = translateUrlError(error);

  const [tab, setTab] = useState<Tab>("login");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, null);

  const isPending = tab === "login" ? loginSubmitting : signUpPending;

  const [urlMessage, setUrlMessage] = useState<{ type: "error"; text: string } | null>(
    urlError ? { type: "error", text: urlError } : null,
  );

  useEffect(() => {
    if (urlError) {
      setUrlMessage({ type: "error", text: urlError });
    }
  }, [urlError]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setUrlMessage(null);
    setLoginSubmitting(false);
  };

  const displayMessage =
    tab === "register" && signUpState?.error
      ? { type: "error" as const, text: translateError(signUpState.error) }
      : tab === "register" && signUpState?.success
        ? { type: "success" as const, text: signUpState.success }
        : urlMessage;

  return (
    <div className="login-card relative w-full max-w-[640px] rounded-[20px] border border-[#2a3a55] bg-gradient-to-b from-panel/85 to-[#0a0f1c]/85 p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)] backdrop-blur-[18px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-white">
            {tab === "login" ? "Truy cập hệ thống" : "Tạo tài khoản mới"}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {tab === "login"
              ? "Đăng nhập để tiếp tục quản lý chiến dịch backlink."
              : "Dành cho nhân viên SEO và Team Leader."}
          </p>
        </div>
        <span className="login-status-chip shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">
          SECURE
        </span>
      </div>

      <div className="relative mb-5 grid grid-cols-2 rounded-[10px] border border-border bg-background/60 p-1">
        <span
          className="pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-[7px] border border-primary/35 bg-gradient-to-br from-primary/20 to-cyan-400/20 transition-transform duration-300 ease-[cubic-bezier(0.6,0.2,0.2,1)]"
          style={{ transform: tab === "register" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
        />
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`relative z-[2] rounded-[7px] py-2 text-center text-[13px] font-medium transition-colors ${
            tab === "login" ? "text-white" : "text-muted hover:text-white"
          }`}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`relative z-[2] rounded-[7px] py-2 text-center text-[13px] font-medium transition-colors ${
            tab === "register" ? "text-white" : "text-muted hover:text-white"
          }`}
        >
          Tạo tài khoản
        </button>
      </div>

      {tab === "login" ? (
        <form
          action="/auth/login"
          method="post"
          className="login-panel-in space-y-3.5"
          onSubmit={() => setLoginSubmitting(true)}
        >
          <Field label="Email">
            <Mail className="login-input-icon" size={16} strokeWidth={2} />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ban@congty.com"
              className="login-input"
            />
          </Field>

          <Field label="Mật khẩu">
            <Lock className="login-input-icon" size={16} strokeWidth={2} />
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              minLength={6}
              className="login-input"
            />
          </Field>

          <div className="flex items-center justify-between text-xs text-muted">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-primary" />
              Ghi nhớ phiên
            </label>
            <span className="font-mono text-[10px] uppercase tracking-wide">2FA · OPTIONAL</span>
          </div>

          {displayMessage && (
            <div
              className={`rounded-lg px-3 py-2.5 text-sm ${
                displayMessage.type === "error"
                  ? "border border-red-900/50 bg-red-950/40 text-red-300"
                  : "border border-primary/30 bg-primary/10 text-emerald-200"
              }`}
            >
              {displayMessage.text}
            </div>
          )}

          <SubmitButton isPending={isPending} tab="login" />
        </form>
      ) : (
        <form key="register" action={signUpFormAction} className="login-panel-in space-y-3.5">
          <Field label="Email" hint="required">
            <Mail className="login-input-icon" size={16} strokeWidth={2} />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ban@congty.com"
              className="login-input"
            />
          </Field>

          <Field label="Mật khẩu" hint="≥ 6 ký tự">
            <Lock className="login-input-icon" size={16} strokeWidth={2} />
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
              className="login-input"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" required className="accent-primary" />
            Tôi đồng ý điều khoản nội bộ
          </label>

          {displayMessage && (
            <div
              className={`rounded-lg px-3 py-2.5 text-sm ${
                displayMessage.type === "error"
                  ? "border border-red-900/50 bg-red-950/40 text-red-300"
                  : "border border-primary/30 bg-primary/10 text-emerald-200"
              }`}
            >
              {displayMessage.text}
            </div>
          )}

          <SubmitButton isPending={isPending} tab="register" />
        </form>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        {tab === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={() => switchTab("register")}
              className="font-medium text-cyan-400 hover:underline"
            >
              Tạo tài khoản mới
            </button>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() => switchTab("login")}
              className="font-medium text-cyan-400 hover:underline"
            >
              Đăng nhập
            </button>
            <span className="mt-2 block text-[11px]">
              Sau khi đăng ký, kiểm tra email để xác thực tài khoản.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function SubmitButton({ isPending, tab }: { isPending: boolean; tab: Tab }) {
  return (
    <button type="submit" disabled={isPending} className="login-btn group mt-1">
      {isPending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Đang xử lý...
        </>
      ) : tab === "login" ? (
        <>
          Vào Dashboard
          <ArrowRight size={16} strokeWidth={2.2} />
        </>
      ) : (
        <>
          Tạo tài khoản &amp; Kích hoạt
          <Plus size={16} strokeWidth={2.2} />
        </>
      )}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal text-primary">{hint}</span>}
      </label>
      <div className="group relative">{children}</div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Email hoặc mật khẩu không đúng.";
  if (msg.includes("Email not confirmed"))
    return "Email chưa được xác thực. Vui lòng kiểm tra hộp thư.";
  if (msg.includes("User already registered")) return "Email này đã được đăng ký.";
  if (msg.includes("Password should be at least")) return "Mật khẩu phải có ít nhất 6 ký tự.";
  if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit"))
    return "Quá nhiều yêu cầu. Vui lòng thử lại sau.";
  return msg;
}
