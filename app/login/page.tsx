import { LoginBackground } from "@/components/login/login-background";
import { LoginHero } from "@/components/login/login-hero";
import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập – Speed Core" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white">
      <LoginBackground />
      <div className="relative z-[2] grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <LoginHero />

        <section className="relative z-[2] flex items-center justify-center px-6 py-10 lg:px-14">
          <LoginForm error={params.error} />
        </section>
      </div>
    </div>
  );
}
