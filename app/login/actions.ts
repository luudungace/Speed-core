"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { getPublicOriginFromHeaders } from "@/lib/http/public-origin";
import { headers } from "next/headers";

export type AuthState = {
  error?: string;
  success?: string;
} | null;

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
