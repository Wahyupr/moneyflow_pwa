export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  fullName: string;
  acceptedTerms: boolean;
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

export function validateLoginInput(input: LoginInput): ValidationResult<LoginInput> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const errors: Record<string, string> = {};

  if (!isValidEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { email, password } };
}

export function validateRegisterInput(input: RegisterInput): ValidationResult<RegisterInput> {
  const login = validateLoginInput(input);
  const errors: Record<string, string> = login.ok ? {} : { ...login.errors };
  const fullName = input.fullName.trim();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  }

  if (!input.acceptedTerms) {
    errors.acceptedTerms = "Accept the terms to create an account.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      fullName,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      acceptedTerms: true
    }
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
