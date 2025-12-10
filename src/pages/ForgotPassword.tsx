import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
      toast.success("Password reset email sent!");
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-4 sm:px-6 md:px-12 py-4 sm:py-6 border-b border-border">
        <button 
          onClick={() => navigate("/auth")} 
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <Logo className="hidden sm:block" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-lg p-6 sm:p-8 md:p-12 animate-scale-in">
          {emailSent ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-brand" />
              </div>
              <h1 className="font-display text-2xl sm:text-3xl">Check Your Email</h1>
              <p className="text-muted-foreground">
                We've sent a password reset link to <strong>{email}</strong>. 
                Click the link in the email to reset your password.
              </p>
              <div className="space-y-3">
                <Button
                  variant="brand"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Back to Sign In
                </Button>
                <button
                  onClick={() => setEmailSent(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Didn't receive the email? Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <Mail className="h-12 w-12 text-brand mx-auto mb-4" />
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl mb-2">
                  Forgot Password?
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-secondary border-border"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="w-full h-12 text-lg font-semibold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <p className="mt-8 text-center text-muted-foreground">
                Remember your password?{" "}
                <button
                  onClick={() => navigate("/auth")}
                  className="text-foreground hover:underline font-medium"
                >
                  Sign In
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;