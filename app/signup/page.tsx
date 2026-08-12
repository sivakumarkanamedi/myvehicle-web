"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabase";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const passwordScore = Object.values(passwordChecks).filter(Boolean).length;

  const passwordStrength =
    password.length === 0
      ? ""
      : passwordScore <= 2
        ? "Weak"
        : passwordScore <= 4
          ? "Medium"
          : "Strong";

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  function getStrengthBarClass(index: number) {
    if (index >= passwordScore) {
      return "bg-slate-200";
    }

    if (passwordStrength === "Weak") {
      return "bg-red-500";
    }

    if (passwordStrength === "Medium") {
      return "bg-amber-500";
    }

    return "bg-green-500";
  }

  function validateMobileNumber() {
    const digits = mobileNumber.replace(/\D/g, "");
    return /^[6-9]\d{9}$/.test(digits);
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Enter your full name.");
      return;
    }

    if (!validateMobileNumber()) {
      setErrorMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (passwordScore < 5) {
      setErrorMessage(
        "Use at least 8 characters with uppercase, lowercase, number and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!acceptTerms) {
      setErrorMessage("Please accept the Terms and Conditions.");
      return;
    }

    if (!acceptPrivacy) {
      setErrorMessage("Please accept the Privacy Policy.");
      return;
    }

    setLoading(true);

    const formattedPhone = `+91${mobileNumber.replace(/\D/g, "")}`;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          mobile_number: formattedPhone,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setSuccessMessage(
      "🎉 Account created successfully. Check your email and confirm your account."
    );
    setLoading(false);
  }

  async function handleGoogleSignup() {
    setErrorMessage("");
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setGoogleLoading(false);
    }
  }

  async function handlePhoneOtp() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!validateMobileNumber()) {
      setErrorMessage("Enter a valid mobile number before requesting OTP.");
      return;
    }

    setOtpLoading(true);

    const phone = `+91${mobileNumber.replace(/\D/g, "")}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      setErrorMessage(error.message);
      setOtpLoading(false);
      return;
    }

    setSuccessMessage("OTP sent successfully to your mobile number.");
    setOtpLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-white shadow-xl lg:grid-cols-2">
        <section className="hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">
              My Vehicle
            </p>

            <h1 className="mt-5 text-5xl font-bold leading-tight">
              Begin your smarter vehicle journey
            </h1>

            <p className="mt-5 text-lg text-white/80">
              Keep vehicles, documents, reminders, services and assistance
              together in one secure account.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur">
            <p className="font-semibold">Powered by Mira AI</p>

            <p className="mt-1 text-sm text-white/70">
              Proactive vehicle support whenever you need it.
            </p>
          </div>
        </section>

        <section className="p-7 sm:p-12">
          <div className="mx-auto max-w-md">
            <div className="text-5xl">🚗</div>

            <h2 className="mt-5 text-3xl font-bold text-slate-900">
              Create your account
            </h2>

            <p className="mt-2 text-slate-500">
              Start managing your vehicles securely.
            </p>

            {errorMessage && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mt-6 animate-pulse rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Full name
                </span>

                <input
                  type="text"
                  value={fullName}
                  disabled={loading}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mobile number
                </span>

                <div className="flex">
                  <span className="flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-100 px-4 font-semibold text-slate-700">
                    +91
                  </span>

                  <input
                    type="tel"
                    value={mobileNumber}
                    disabled={loading}
                    maxLength={10}
                    onChange={(event) =>
                      setMobileNumber(
                        event.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    className="w-full rounded-r-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Email address
                </span>

                <input
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </span>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      disabled={loading}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-blue-600"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                {password && (
                  <div className="mt-3">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className={`h-2 flex-1 rounded-full ${getStrengthBarClass(
                            index
                          )}`}
                        />
                      ))}
                    </div>

                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Password strength: {passwordStrength}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <p
                        className={
                          passwordChecks.length
                            ? "text-green-600"
                            : "text-slate-500"
                        }
                      >
                        {passwordChecks.length ? "✓" : "○"} 8 characters
                      </p>

                      <p
                        className={
                          passwordChecks.uppercase
                            ? "text-green-600"
                            : "text-slate-500"
                        }
                      >
                        {passwordChecks.uppercase ? "✓" : "○"} Uppercase
                      </p>

                      <p
                        className={
                          passwordChecks.lowercase
                            ? "text-green-600"
                            : "text-slate-500"
                        }
                      >
                        {passwordChecks.lowercase ? "✓" : "○"} Lowercase
                      </p>

                      <p
                        className={
                          passwordChecks.number
                            ? "text-green-600"
                            : "text-slate-500"
                        }
                      >
                        {passwordChecks.number ? "✓" : "○"} Number
                      </p>

                      <p
                        className={
                          passwordChecks.special
                            ? "text-green-600"
                            : "text-slate-500"
                        }
                      >
                        {passwordChecks.special ? "✓" : "○"} Special character
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">
                    Confirm password
                  </span>

                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    disabled={loading}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Enter password again"
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                {confirmPassword && (
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      passwordsMatch ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {passwordsMatch
                      ? "✓ Passwords match"
                      : "✕ Passwords do not match"}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />

                <span>
                  I accept the{" "}
                  <Link
                    href="/terms"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Terms and Conditions
                  </Link>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptPrivacy}
                  onChange={(event) => setAcceptPrivacy(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />

                <span>
                  I accept the{" "}
                  <Link
                    href="/privacy"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading && (
                  <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}

                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-sm text-slate-400">OR</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleSignup}
                className="w-full rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {googleLoading
                  ? "Connecting to Google..."
                  : "🌐 Continue with Google"}
              </button>

              <button
                type="button"
                disabled={otpLoading}
                onClick={handlePhoneOtp}
                className="w-full rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {otpLoading ? "Sending OTP..." : "📱 Continue with Phone OTP"}
              </button>
            </div>

            <p className="mt-7 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-blue-600 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}