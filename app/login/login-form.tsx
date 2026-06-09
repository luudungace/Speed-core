"use client";

import { ArrowRight, Loader2, Lock, Mail, Plus, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { loginAction, signUpAction, type AuthState } from "./actions";

type Tab = "login" | "register";

export function LoginForm({ error }: { error?: string }) {
  const urlError =
    error === "email_verification_failed"
      ? "Xác thực email thất bại. Vui lòng thử lại."
      : undefined;

  const [tab, setTab] = useState<Tab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, null);

  const state: AuthState = tab === "login" ? loginState : signUpState;
  const isPending = tab === "login" ? loginPending : signUpPending;
  const formAction = tab === "login" ? loginFormAction : signUpFormAction;

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
    setShowPassword(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
  };

  const displayMessage = state?.error
    ? { type: "error" as const, text: translateError(state.error) }
    : state?.success
      ? { type: "success" as const, text: state.success }
      : urlMessage;

  return (
    <div className="login-card-3d relative w-full max-w-[480px]">
      {/* Outer glow ring */}
      <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-[#00F0FF]/20 via-[#6366f1]/10 to-transparent opacity-60 blur-[1px]" />
      
      <div
        onMouseMove={handleMouseMove}
        className="login-card relative w-full rounded-3xl border border-white/[0.08] bg-[#080d1a]/85 p-8 lg:p-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur-2xl"
      >
        {/* Glow layer following the cursor */}
        <div className="login-card-glow-layer" />

        {/* Cybernetic Corner Bracket Accents (Expert Designer Touch) */}
        <div className="absolute top-4 left-4 w-2 h-2 border-t-2 border-l-2 border-[#00F0FF]/25 rounded-tl-sm pointer-events-none z-10" />
        <div className="absolute top-4 right-4 w-2 h-2 border-t-2 border-r-2 border-[#00F0FF]/25 rounded-tr-sm pointer-events-none z-10" />
        <div className="absolute bottom-4 left-4 w-2 h-2 border-b-2 border-l-2 border-[#00F0FF]/25 rounded-bl-sm pointer-events-none z-10" />
        <div className="absolute bottom-4 right-4 w-2 h-2 border-b-2 border-r-2 border-[#00F0FF]/25 rounded-br-sm pointer-events-none z-10" />

        {/* Internal ambient lights */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-[#00F0FF]/[0.03] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-[#6366f1]/[0.04] blur-3xl" />

        {/* Header */}
        <div className="relative z-10 mb-8 login-form-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-black tracking-tight text-white lg:text-[26px]">
                {tab === "login" ? "Truy cập hệ thống" : "Tạo tài khoản mới"}
              </h2>
              <p className="mt-2 text-[13px] font-medium text-slate-400 leading-relaxed">
                {tab === "login"
                  ? "Đăng nhập để quản lý chiến dịch backlink."
                  : "Dành cho nhân viên SEO và Team Leader."}
              </p>
            </div>
            <span className="shrink-0 rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/[0.05] px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-wider text-[#00F0FF]/80 flex items-center gap-1.5 backdrop-blur-sm">
              <ShieldCheck size={11} />
              SECURE
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="relative z-10 mb-7 login-form-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="relative grid grid-cols-2 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-1">
            <span
              className="pointer-events-none absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r from-[#00F0FF]/10 via-[#1a4894]/15 to-[#6366f1]/10 border border-[#00F0FF]/15 transition-transform duration-400 ease-[cubic-bezier(0.6,0.2,0.2,1)] shadow-[0_0_20px_rgba(0,240,255,.05)]"
              style={{ transform: tab === "register" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
            />
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`relative z-[2] rounded-xl py-2.5 text-center text-[12px] font-bold transition-all duration-300 ${
                tab === "login" ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchTab("register")}
              className={`relative z-[2] rounded-xl py-2.5 text-center text-[12px] font-bold transition-all duration-300 ${
                tab === "register" ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Tạo tài khoản
            </button>
          </div>
        </div>

        {/* Form */}
        <form key={tab} action={formAction} className="login-panel-in relative z-10 space-y-5">
          <div className="login-form-fade-in" style={{ animationDelay: "0.3s" }}>
            <Field label="Email" hint={tab === "register" ? "required" : undefined}>
              <Mail className="login-input-icon" size={15} strokeWidth={2} />
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ban@congty.com"
                className="login-input"
              />
            </Field>
          </div>

          <div className="login-form-fade-in" style={{ animationDelay: "0.4s" }}>
            <Field label="Mật khẩu" hint={tab === "register" ? "≥ 6 ký tự" : undefined}>
              <Lock className="login-input-icon" size={15} strokeWidth={2} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                minLength={6}
                className="login-input pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#00F0FF] transition-colors duration-200"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </Field>
          </div>

          <div className="login-form-fade-in" style={{ animationDelay: "0.5s" }}>
            {tab === "login" && (
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <label className="inline-flex cursor-pointer items-center gap-2 hover:text-slate-300 transition-colors">
                  <input type="checkbox" defaultChecked className="accent-[#00F0FF] rounded" />
                  Ghi nhớ phiên
                </label>
                <span className="font-mono text-[9px] font-black uppercase tracking-wide text-slate-600">2FA · OPTIONAL</span>
              </div>
            )}

            {tab === "register" && (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
                <input type="checkbox" required className="accent-[#00F0FF] rounded" />
                Tôi đồng ý điều khoản nội bộ
              </label>
            )}
          </div>

          {displayMessage && (
            <div className="login-form-fade-in" style={{ animationDelay: "0s" }}>
              <div
                className={`rounded-xl px-4 py-3 text-[13px] font-bold ${
                  displayMessage.type === "error"
                    ? "border border-red-500/20 bg-red-500/[0.06] text-red-400"
                    : "border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                }`}
              >
                {displayMessage.text}
              </div>
            </div>
          )}

          <div className="login-form-fade-in" style={{ animationDelay: "0.6s" }}>
            <SubmitButton isPending={isPending} tab={tab} />
          </div>
        </form>

        {/* Footer links */}
        <div className="login-form-fade-in" style={{ animationDelay: "0.7s" }}>
          <p className="relative z-10 mt-6 text-center text-[12px] font-bold text-slate-500">
            {tab === "login" ? (
              <>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => switchTab("register")}
                  className="font-black text-[#00F0FF] hover:underline hover:text-[#00F0FF]/80 transition-colors"
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
                  className="font-black text-[#00F0FF] hover:underline hover:text-[#00F0FF]/80 transition-colors"
                >
                  Đăng nhập
                </button>
                <span className="mt-2 block text-[10px] font-semibold text-slate-600">
                  Sau khi đăng ký, kiểm tra email để xác thực tài khoản.
                </span>
              </>
            )}
          </p>

          {/* Cybernetic Telemetry Footer Accent */}
          <div className="relative z-10 mt-6 pt-4 border-t border-white/[0.04] flex items-center justify-between font-mono text-[8px] font-bold text-slate-500/50 uppercase tracking-[0.15em] select-none">
            <span>ENC: AES-256</span>
            <span className="flex items-center gap-1.5 text-[#00F0FF]/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
              CORE: SYNC
            </span>
            <span>TEMP: 34°C</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ isPending, tab }: { isPending: boolean; tab: Tab }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      className="login-btn group mt-1 w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#1a4894] via-[#1f8ecd] to-[#00C9FF] py-4 text-[13px] font-black uppercase tracking-wider text-white shadow-[0_0_30px_rgba(0,240,255,.15)] transition-all duration-300 hover:shadow-[0_0_50px_rgba(0,240,255,.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {isPending ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          Đang xử lý...
        </>
      ) : tab === "login" ? (
        <>
          Vào Dashboard
          <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-300 group-hover:translate-x-1" />
        </>
      ) : (
        <>
          Tạo tài khoản &amp; Kích hoạt
          <Plus size={15} strokeWidth={2.5} />
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
      <label className="mb-2 flex items-center justify-between font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal text-[#00F0FF]/70 text-[10px]">{hint}</span>}
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
