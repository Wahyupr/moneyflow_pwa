import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { InstallPromptCard } from "@/components/install-prompt-card";

export default function LoginPage() {
  return (
    <AuthCard
      below={<InstallPromptCard />}
      footer={
        <p>
          Don&apos;t have an account?{" "}
          <Link className="font-bold text-primary hover:underline" href="/register">
            Register
          </Link>
        </p>
      }
      subtitle="Welcome back to clarity and control."
      title="Sign in"
    >
      <AuthForm mode="login" />
    </AuthCard>
  );
}
