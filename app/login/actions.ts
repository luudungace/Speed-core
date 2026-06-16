"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthState = {
  error?: string;
  success?: string;
} | null;

function mapSignInError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Email hoặc mật khẩu không đúng.";
  }
  if (message.includes("Email not confirmed")) {
    return "Email chưa được xác thực. Vui lòng kiểm tra hộp thư.";
  }
  return "Đăng nhập thất bại. Vui lòng thử lại.";
}

export async function signInAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServer();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapSignInError(error.message) };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const headersList = await headers();
  const origin = getPublicOriginFromHeaders(headersList);
  const supabase = await createSupabaseServer();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
  };
}
