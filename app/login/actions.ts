"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthState = {
  error?: string;
  success?: string;
} | null;

export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createSupabaseServer();

  const { error } = await supabase.auth
    .signInWithPassword({ email, password })
    .catch((authError) => ({
      data: { user: null, session: null },
      error: authError,
    }));

  if (error) {
    return { error: error.message || "Không thể kết nối Supabase. Vui lòng thử lại." };
  }

  redirect("/");
}

export async function signUpAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const headersList = await headers();
  const origin = headersList.get("origin");
  const supabase = await createSupabaseServer();

  const { error } = await supabase.auth
    .signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    .catch((authError) => ({
      data: { user: null, session: null },
      error: authError,
    }));

  if (error) {
    return { error: error.message || "Không thể kết nối Supabase. Vui lòng thử lại." };
  }

  return {
    success:
      "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
  };
}
