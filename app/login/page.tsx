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
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(1200px 600px at 85% -10%, rgba(34,211,238,.1), transparent 60%),
            radial-gradient(900px 500px at 0% 100%, rgba(99,102,241,.12), transparent 60%),
            radial-gradient(700px 400px at 50% 50%, rgba(0,209,125,.06), transparent 60%),
            #080d15
          `,
        }}
      />

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
