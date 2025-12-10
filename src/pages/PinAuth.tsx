import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Phone, Key, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type AuthMode = "login" | "register" | "reset-pin";

const PinAuth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    mobileNumber: "",
    pin: "",
    confirmPin: "",
    secretWord: "",
    name: "",
    email: "",
    password: "",
  });

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Find user by mobile number
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("mobile_number", formData.mobileNumber)
        .maybeSingle();

      if (profileError || !profiles) {
        toast.error("Mobile number not registered");
        setIsLoading(false);
        return;
      }

      // Check if account is locked
      if (profiles.pin_locked_until && new Date(profiles.pin_locked_until) > new Date()) {
        toast.error("Account is locked. Please try again later.");
        setIsLoading(false);
        return;
      }

      // Verify PIN
      if (profiles.pin_code !== formData.pin) {
        const attempts = (profiles.pin_attempts || 0) + 1;
        
        if (attempts >= 5) {
          // Lock account for 30 minutes
          await supabase
            .from("profiles")
            .update({ 
              pin_attempts: attempts,
              pin_locked_until: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            })
            .eq("id", profiles.id);
          toast.error("Too many failed attempts. Account locked for 30 minutes.");
        } else {
          await supabase
            .from("profiles")
            .update({ pin_attempts: attempts })
            .eq("id", profiles.id);
          toast.error(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
        }
        setIsLoading(false);
        return;
      }

      // Reset attempts on successful login
      await supabase
        .from("profiles")
        .update({ pin_attempts: 0, pin_locked_until: null })
        .eq("id", profiles.id);

      // Sign in with email/password (stored during registration)
      // For PIN login, we use a special flow - redirect to main auth with stored credentials
      toast.success("PIN verified! Please complete sign in.");
      navigate("/auth", { state: { fromPin: true, mobileNumber: formData.mobileNumber } });
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (step === 1) {
      // Validate mobile number
      if (!/^\+?[0-9]{10,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))) {
        toast.error("Please enter a valid mobile number");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      // Validate PIN
      if (formData.pin.length !== 6) {
        toast.error("PIN must be 6 digits");
        return;
      }
      if (formData.pin !== formData.confirmPin) {
        toast.error("PINs do not match");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      // Validate secret word
      if (formData.secretWord.length < 4) {
        toast.error("Secret word must be at least 4 characters");
        return;
      }
      setStep(4);
      return;
    }

    // Final step - create account
    setIsLoading(true);
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: formData.name,
          },
        },
      });

      if (authError) {
        toast.error(authError.message);
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        // Update profile with mobile number, PIN, and secret word
        await supabase
          .from("profiles")
          .update({
            mobile_number: formData.mobileNumber,
            pin_code: formData.pin,
            secret_word: formData.secretWord.toLowerCase(),
          })
          .eq("id", authData.user.id);

        toast.success("Account created successfully!");
        navigate("/");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (step === 1) {
      setIsLoading(true);
      try {
        // Find user by mobile number
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, secret_word")
          .eq("mobile_number", formData.mobileNumber)
          .maybeSingle();

        if (error || !profile) {
          toast.error("Mobile number not found");
          setIsLoading(false);
          return;
        }

        setStep(2);
      } catch (error) {
        toast.error("An error occurred");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (step === 2) {
      setIsLoading(true);
      try {
        // Verify secret word
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, secret_word")
          .eq("mobile_number", formData.mobileNumber)
          .maybeSingle();

        if (!profile || profile.secret_word !== formData.secretWord.toLowerCase()) {
          toast.error("Incorrect secret word");
          setIsLoading(false);
          return;
        }

        setStep(3);
      } catch (error) {
        toast.error("An error occurred");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Final step - update PIN
    if (formData.pin.length !== 6) {
      toast.error("PIN must be 6 digits");
      return;
    }
    if (formData.pin !== formData.confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          pin_code: formData.pin,
          pin_attempts: 0,
          pin_locked_until: null
        })
        .eq("mobile_number", formData.mobileNumber);

      if (error) {
        toast.error("Failed to reset PIN");
        return;
      }

      toast.success("PIN reset successfully!");
      setMode("login");
      setStep(1);
      setFormData({ ...formData, pin: "", confirmPin: "", secretWord: "" });
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") handleLogin();
    else if (mode === "register") handleRegister();
    else handleResetPin();
  };

  const renderLoginForm = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Mobile Number</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="tel"
            placeholder="+237 6XX XXX XXX"
            value={formData.mobileNumber}
            onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
            className="h-12 pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">Enter your 6-digit PIN</label>
        <div className="flex justify-center">
          <InputOTP
            value={formData.pin}
            onChange={(value) => setFormData({ ...formData, pin: value })}
            maxLength={6}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-12 w-12 bg-secondary" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      </div>

      <Button
        type="submit"
        variant="brand"
        size="lg"
        className="w-full h-12"
        disabled={isLoading || formData.pin.length !== 6}
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In with PIN"}
      </Button>

      <button
        type="button"
        onClick={() => { setMode("reset-pin"); setStep(1); }}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Forgot your PIN?
      </button>
    </div>
  );

  const renderRegisterForm = () => (
    <div className="space-y-6">
      {step === 1 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                className="h-12 pl-10 bg-secondary border-border"
              />
            </div>
          </div>
          <Button type="submit" variant="brand" size="lg" className="w-full h-12">
            Continue
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Create a 6-digit PIN</label>
            <div className="flex justify-center">
              <InputOTP
                value={formData.pin}
                onChange={(value) => setFormData({ ...formData, pin: value })}
                maxLength={6}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 bg-secondary" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Confirm PIN</label>
            <div className="flex justify-center">
              <InputOTP
                value={formData.confirmPin}
                onChange={(value) => setFormData({ ...formData, confirmPin: value })}
                maxLength={6}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 bg-secondary" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button type="submit" variant="brand" size="lg" className="w-full h-12">
            Continue
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Create a Secret Word</label>
            <p className="text-xs text-muted-foreground">This will be used to reset your PIN if you forget it.</p>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter your secret word"
                value={formData.secretWord}
                onChange={(e) => setFormData({ ...formData, secretWord: e.target.value })}
                className="h-12 pl-10 bg-secondary border-border"
              />
            </div>
          </div>
          <Button type="submit" variant="brand" size="lg" className="w-full h-12">
            Continue
          </Button>
        </>
      )}

      {step === 4 && (
        <>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 bg-secondary border-border"
            />
            <Input
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12 bg-secondary border-border"
            />
            <Input
              type="password"
              placeholder="Password (for account recovery)"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="h-12 bg-secondary border-border"
            />
          </div>
          <Button type="submit" variant="brand" size="lg" className="w-full h-12" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
          </Button>
        </>
      )}

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full ${s === step ? "bg-brand" : "bg-muted"}`}
          />
        ))}
      </div>
    </div>
  );

  const renderResetPinForm = () => (
    <div className="space-y-6">
      {step === 1 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                className="h-12 pl-10 bg-secondary border-border"
              />
            </div>
          </div>
          <Button type="submit" variant="brand" size="lg" className="w-full h-12" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Enter your Secret Word</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Your secret word"
                value={formData.secretWord}
                onChange={(e) => setFormData({ ...formData, secretWord: e.target.value })}
                className="h-12 pl-10 bg-secondary border-border"
              />
            </div>
          </div>
          <Button type="submit" variant="brand" size="lg" className="w-full h-12" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify"}
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Create a new 6-digit PIN</label>
            <div className="flex justify-center">
              <InputOTP
                value={formData.pin}
                onChange={(value) => setFormData({ ...formData, pin: value })}
                maxLength={6}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 bg-secondary" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Confirm new PIN</label>
            <div className="flex justify-center">
              <InputOTP
                value={formData.confirmPin}
                onChange={(value) => setFormData({ ...formData, confirmPin: value })}
                maxLength={6}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 bg-secondary" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button type="submit" variant="brand" size="lg" className="w-full h-12" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Reset PIN"}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex justify-between items-center px-6 md:px-12 py-6 border-b border-border">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <Logo />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-lg p-8 md:p-12 animate-scale-in">
          <div className="flex items-center gap-3 mb-8">
            <Key className="h-8 w-8 text-brand" />
            <h1 className="font-display text-3xl md:text-4xl">
              {mode === "login" ? "PIN Login" : mode === "register" ? "Create Account" : "Reset PIN"}
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "login" && renderLoginForm()}
            {mode === "register" && renderRegisterForm()}
            {mode === "reset-pin" && renderResetPinForm()}
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            {mode === "login" ? (
              <div className="space-y-3">
                <button
                  onClick={() => { setMode("register"); setStep(1); }}
                  className="w-full text-center text-foreground hover:underline"
                >
                  Create a new account
                </button>
                <button
                  onClick={() => navigate("/auth")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign in with email instead
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setMode("login"); setStep(1); }}
                className="w-full text-center text-foreground hover:underline"
              >
                Back to PIN login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinAuth;