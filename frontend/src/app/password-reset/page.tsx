"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles, Loader2, Mail, Lock, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

// Schema for Step 1: Request Reset
const requestResetSchema = z.object({
    email: z.string().email("Please enter a valid email"),
});

// Schema for Step 2: Set New Password
const resetPasswordSchema = z
    .object({
        otp: z.string().length(6, "Code must be 6 digits"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    });

type RequestResetForm = z.infer<typeof requestResetSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function PasswordResetPage() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuthStore();

    // If already authenticated, go to dashboard
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.push('/dashboard');
        }
    }, [authLoading, isAuthenticated, router]);

    const [step, setStep] = useState<1 | 2>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const {
        register: registerRequest,
        handleSubmit: handleSubmitRequest,
        formState: { errors: errorsRequest },
    } = useForm<RequestResetForm>({
        resolver: zodResolver(requestResetSchema),
    });

    const {
        register: registerReset,
        handleSubmit: handleSubmitReset,
        formState: { errors: errorsReset },
    } = useForm<ResetPasswordForm>({
        resolver: zodResolver(resetPasswordSchema),
    });

    const onRequestSubmit = async (data: RequestResetForm) => {
        setIsLoading(true);
        try {
            const response = await api.requestPasswordReset(data.email);
            if (response.success) {
                setEmail(data.email);
                setStep(2);
                toast.success(response.message || "Reset code sent to your email");
            } else {
                toast.error(response.message || "Failed to send reset code");
            }
        } catch (error: unknown) {
            const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to send reset code";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const onResetSubmit = async (data: ResetPasswordForm) => {
        setIsLoading(true);
        try {
            const response = await api.resetPassword(email, data.otp, data.newPassword);
            if (response.success) {
                toast.success("Password reset successfully! Please login.");
                router.push("/login");
            } else {
                toast.error(response.message || "Failed to reset password");
            }
        } catch (error: unknown) {
            const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to reset password";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8">
                <div className="flex justify-center mb-8">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">
                            Presentation Designer
                        </span>
                    </Link>
                </div>

                {step === 1 ? (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                            Forgot Password?
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center text-sm">
                            Enter your email address and we'll send you a code to reset your password.
                        </p>

                        <form onSubmit={handleSubmitRequest(onRequestSubmit)} className="space-y-4">
                            <div>
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative mt-1.5">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        className="pl-10"
                                        {...registerRequest("email")}
                                    />
                                </div>
                                {errorsRequest.email && (
                                    <p className="text-sm text-red-500 mt-1">{errorsRequest.email.message}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    "Send Reset Code"
                                )}
                            </Button>
                        </form>
                    </div>
                ) : (
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">
                            Reset Password
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400 mb-8 text-center text-sm">
                            Enter the 6-digit code sent to <span className="font-semibold">{email}</span> and your new password.
                        </p>

                        <form onSubmit={handleSubmitReset(onResetSubmit)} className="space-y-4">
                            <div>
                                <Label htmlFor="otp">Verification Code</Label>
                                <div className="relative mt-1.5">
                                    <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="otp"
                                        type="text"
                                        placeholder="123456"
                                        className="pl-10 tracking-widest font-mono text-center text-lg"
                                        maxLength={6}
                                        {...registerReset("otp")}
                                    />
                                </div>
                                {errorsReset.otp && (
                                    <p className="text-sm text-red-500 mt-1">{errorsReset.otp.message}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="newPassword">New Password</Label>
                                <div className="relative mt-1.5">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="At least 8 characters"
                                        className="pl-10"
                                        {...registerReset("newPassword")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                {errorsReset.newPassword && (
                                    <p className="text-sm text-red-500 mt-1">{errorsReset.newPassword.message}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <div className="relative mt-1.5">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Confirm password"
                                        className="pl-10"
                                        {...registerReset("confirmPassword")}
                                    />
                                </div>
                                {errorsReset.confirmPassword && (
                                    <p className="text-sm text-red-500 mt-1">{errorsReset.confirmPassword.message}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting Password...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>
                        </form>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 font-medium transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
