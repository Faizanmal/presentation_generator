"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Phone,
  Clock,
  RefreshCw,
  HelpCircle,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const otpRequestSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
});

const otpVerifySchema = z.object({
  otp: z.string().length(6, "Code must be 6 digits"),
});

type LoginForm = z.infer<typeof loginSchema>;
type OtpRequestForm = z.infer<typeof otpRequestSchema>;
type OtpVerifyForm = z.infer<typeof otpVerifySchema>;

// OTP Input Component with individual digit boxes
function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  disabled?: boolean;
  error?: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    // Auto-submit when all 6 digits are entered
    if (value.length === 6) {
      onComplete();
    }
  }, [value, onComplete]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) { return; }

    const newValue = value.split('');
    newValue[index] = digit.slice(-1);
    const result = newValue.join('').slice(0, 6);
    onChange(result);

    // Move to next input
    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pastedData);

    // Focus appropriate input after paste
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 justify-center">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={cn(
              "w-12 h-14 text-center text-2xl font-mono border rounded-lg",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "transition-all duration-200",
              disabled && "opacity-50 cursor-not-allowed",
              error ? "border-red-500" : "border-slate-300 dark:border-slate-600",
              "bg-white dark:bg-slate-800"
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}

// Countdown Timer Component
function CountdownTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: Date | null;
  onExpired: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) { return; }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = expiresAt.getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));

      setTimeLeft(diff);

      if (diff === 0) {
        onExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (!expiresAt || timeLeft === 0) { return null; }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-slate-500" />
      <span className={cn(
        "font-mono",
        timeLeft < 60 ? "text-orange-600 dark:text-orange-400" : "text-slate-600 dark:text-slate-400"
      )}>
        Code expires in {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

// Email Sent Animation Component
function EmailSentAnimation({ channel }: { channel: "email" | "sms" }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"
      >
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-lg font-semibold text-slate-900 dark:text-white"
      >
        {channel === "email" ? "Email Sent!" : "SMS Sent!"}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-slate-600 dark:text-slate-400"
      >
        Check your {channel === "email" ? "inbox" : "phone"} for the verification code
      </motion.p>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, login, loginWithOtp } = useAuthStore();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Loading & UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showSentAnimation, setShowSentAnimation] = useState(false);
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpChannel, setOtpChannel] = useState<"email" | "sms">("email");
  const [rememberDevice, setRememberDevice] = useState(false);

  // OTP states
  const [otpValue, setOtpValue] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [otpExpired, setOtpExpired] = useState(false);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) { return; }

    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Traditional Login Form
  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    formState: { errors: errorsLogin },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // OTP Request Form
  const {
    register: registerOtpRequest,
    handleSubmit: handleSubmitOtpRequest,
    formState: { errors: errorsOtpRequest },
    setValue: setOtpRequestValue,
  } = useForm<OtpRequestForm>({
    resolver: zodResolver(otpRequestSchema),
  });

  // OTP Verify Form
  const {
    handleSubmit: handleSubmitOtpVerify,
    formState: { errors: errorsOtpVerify },
    setError: setOtpVerifyError,
  } = useForm<OtpVerifyForm>({
    resolver: zodResolver(otpVerifySchema),
  });

  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpRequestSubmit = async (data: OtpRequestForm) => {
    setIsLoading(true);
    try {
      const response = await api.requestOtpLoginMultiChannel(
        data.identifier,
        otpChannel,
        rememberDevice
      );

      if (response.success) {
        setOtpIdentifier(data.identifier);
        setShowSentAnimation(true);

        // Show animation for 2 seconds, then show OTP input
        setTimeout(() => {
          setShowSentAnimation(false);
          setOtpSent(true);
        }, 2000);

        // Set expiry timer
        if (response.expiresInSeconds) {
          setOtpExpiresAt(new Date(Date.now() + response.expiresInSeconds * 1000));
        }

        // Set resend cooldown
        setResendCooldown(response.resendAfterSeconds || 60);
        setOtpExpired(false);
        setOtpValue("");

        toast.success(response.message || "Verification code sent!");
      } else {
        // Check if it's a cooldown response
        if (response.retryAfterSeconds) {
          setResendCooldown(response.retryAfterSeconds);
          toast.error(response.message || "Please wait before requesting a new code");
        } else {
          toast.error(response.message || "Failed to send code");
        }
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; retryAfterSeconds?: number } } };
      if (axiosError.response?.data?.retryAfterSeconds) {
        setResendCooldown(axiosError.response.data.retryAfterSeconds);
      }
      toast.error(axiosError.response?.data?.message || "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpComplete = useCallback(async () => {
    if (otpValue.length !== 6 || isLoading) { return; }

    setIsLoading(true);
    try {
      await loginWithOtp(otpIdentifier, otpValue, rememberDevice);
      toast.success("Logged in successfully!");
      router.push("/dashboard");
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string; remainingAttempts?: number } } };
      const message = axiosError.response?.data?.message || "Invalid code";
      setOtpVerifyError("otp", { message });
      toast.error(message);
      setOtpValue(""); // Clear on error
    } finally {
      setIsLoading(false);
    }
  }, [otpValue, otpIdentifier, rememberDevice, isLoading, router, setOtpVerifyError, loginWithOtp]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) { return; }

    setIsResending(true);
    try {
      const response = await api.requestOtpLoginMultiChannel(
        otpIdentifier,
        otpChannel,
        rememberDevice
      );

      if (response.success) {
        toast.success("New verification code sent!");
        setOtpValue("");
        setOtpExpired(false);

        if (response.expiresInSeconds) {
          setOtpExpiresAt(new Date(Date.now() + response.expiresInSeconds * 1000));
        }
        setResendCooldown(response.resendAfterSeconds || 60);
      } else {
        if (response.retryAfterSeconds) {
          setResendCooldown(response.retryAfterSeconds);
        }
        toast.error(response.message || "Failed to resend code");
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleOtpExpired = useCallback(() => {
    setOtpExpired(true);
    toast.error("Verification code expired. Please request a new one.");
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/google`;
  };

  const resetOtpFlow = () => {
    setOtpSent(false);
    setShowSentAnimation(false);
    setOtpValue("");
    setOtpExpiresAt(null);
    setOtpExpired(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              Presentation Designer
            </span>
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome back
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Sign in to your account to continue
          </p>

          <Tabs defaultValue="password" className="w-full mb-6" onValueChange={() => {
            resetOtpFlow();
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="otp">One-Time Code</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      autoComplete="email"
                      {...registerLogin("email")}
                    />
                  </div>
                  {errorsLogin.email && (
                    <p className="text-sm text-red-500 mt-1">{errorsLogin.email.message}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/password-reset"
                      className="text-sm font-medium text-blue-600 hover:text-blue-500"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                      {...registerLogin("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errorsLogin.password && (
                    <p className="text-sm text-red-500 mt-1">{errorsLogin.password.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp">
              <AnimatePresence mode="wait">
                {showSentAnimation ? (
                  <motion.div
                    key="sent-animation"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmailSentAnimation channel={otpChannel} />
                  </motion.div>
                ) : !otpSent ? (
                  <motion.form
                    key="otp-request"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmitOtpRequest(onOtpRequestSubmit)}
                    className="space-y-4 mt-4"
                  >
                    {/* Channel Selection */}
                    <div>
                      <Label>Receive code via</Label>
                      <Select
                        value={otpChannel}
                        onValueChange={(v) => setOtpChannel(v as "email" | "sms")}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </SelectItem>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              SMS
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="otp-identifier">
                        {otpChannel === "email" ? "Email" : "Phone Number"}
                      </Label>
                      <div className="relative mt-1.5">
                        {otpChannel === "email" ? (
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        ) : (
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        )}
                        <Input
                          id="otp-identifier"
                          type={otpChannel === "email" ? "email" : "tel"}
                          placeholder={otpChannel === "email" ? "you@example.com" : "+1 (555) 000-0000"}
                          className="pl-10"
                          autoComplete={otpChannel === "email" ? "email" : "tel"}
                          {...registerOtpRequest("identifier")}
                          onChange={(e) => {
                            registerOtpRequest("identifier").onChange(e);
                            setOtpRequestValue("identifier", e.target.value);
                          }}
                        />
                      </div>
                      {errorsOtpRequest.identifier && (
                        <p className="text-sm text-red-500 mt-1">{errorsOtpRequest.identifier.message}</p>
                      )}
                    </div>

                    {/* Remember Device Option */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember-device"
                        checked={rememberDevice}
                        onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
                      />
                      <label
                        htmlFor="remember-device"
                        className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer flex items-center gap-1"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Remember this device for 30 days
                      </label>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending Code...
                        </>
                      ) : (
                        <>
                          Send Login Code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="otp-verify"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 mt-4"
                  >
                    {/* Header */}
                    <div className="text-center mb-6">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        We sent a code to <span className="font-semibold">{otpIdentifier}</span>
                      </p>
                      <button
                        type="button"
                        onClick={resetOtpFlow}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        Change {otpChannel === "email" ? "email" : "phone"}
                      </button>
                    </div>

                    {/* Timer */}
                    {!otpExpired && (
                      <CountdownTimer
                        expiresAt={otpExpiresAt}
                        onExpired={handleOtpExpired}
                      />
                    )}

                    {/* Expired Message */}
                    {otpExpired && (
                      <div className="text-center text-orange-600 dark:text-orange-400 text-sm py-2">
                        Code expired. Please request a new one.
                      </div>
                    )}

                    {/* OTP Input */}
                    <form onSubmit={handleSubmitOtpVerify(handleOtpComplete)}>
                      <OtpInput
                        value={otpValue}
                        onChange={setOtpValue}
                        onComplete={handleOtpComplete}
                        disabled={isLoading || otpExpired}
                        error={errorsOtpVerify.otp?.message}
                      />

                      <Button
                        type="submit"
                        className="w-full mt-4"
                        disabled={isLoading || otpValue.length !== 6 || otpExpired}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Verify & Login"
                        )}
                      </Button>
                    </form>

                    {/* Didn't receive code section */}
                    <div className="text-sm text-center mt-6 space-y-2 border-t pt-4 border-slate-200 dark:border-slate-700">
                      <p className="text-slate-600 dark:text-slate-400">
                        Didn&apos;t receive the code?
                      </p>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={resendCooldown > 0 || isResending}
                          className={cn(
                            "flex items-center gap-1 font-medium",
                            resendCooldown > 0 || isResending
                              ? "text-slate-400 cursor-not-allowed"
                              : "text-blue-600 hover:text-blue-500"
                          )}
                        >
                          {isResending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Resend {resendCooldown > 0 && `(${resendCooldown}s)`}
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <Link
                          href="/support"
                          className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        >
                          <HelpCircle className="h-4 w-4" />
                          Contact Support
                        </Link>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Check your spam folder if using email
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-slate-900 px-4 text-slate-500">
                or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-6"
            onClick={handleGoogleLogin}
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>

          <p className="text-center text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Gradient/Image */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-blue-600/20 to-purple-600/20 z-0" />
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 z-0" />
        <div className="max-w-md text-white z-10 p-12 relative">
          <div className="absolute top-0 left-0 -translate-x-12 -translate-y-12 h-64 w-64 bg-blue-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 translate-x-12 translate-y-12 h-64 w-64 bg-purple-500/30 rounded-full blur-3xl" />

          <h2 className="text-5xl font-bold mb-8 relative z-10 leading-tight">
            Design smarter, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">not harder.</span>
          </h2>
          <p className="text-xl text-slate-300 relative z-10 leading-relaxed">
            Experience the future of presentation design with our AI-powered platform. Create, collaborate, and captivate.
          </p>

          <div className="mt-12 flex gap-4">
            <div className="flex -space-x-4">
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700" />
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-600" />
              <div className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-500" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-sm font-bold">10,000+</span>
              <span className="text-xs text-slate-400">presentations created</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
