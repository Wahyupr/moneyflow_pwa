import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <AuthCard
      footer={
        <p>
          Already have an account?{" "}
          <Link className="font-bold text-primary hover:underline" href="/login">
            Log In
          </Link>
        </p>
      }
      subtitle="Create your account for private, review-first finance tracking."
      title="Create account"
    >
      <AuthForm mode="register" />
    </AuthCard>
  );
}
