import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Phone, Key, Shield, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { MobileWelcomeScreen } from "@/components/mobile/MobileWelcomeScreen";

type AuthMode = "login" | "register" | "reset-pin";

const PinAuth = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [formData, setFormData] = useState({
    mobileNumber: "",
    pin: "",
    confirmPin: "",
    secretWord: "",
    name: "",
  });

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pin-login', {
        body: {
          mobileNumber: formData.mobileNumber,
          pin: formData.pin,
        },
      });

      if (error || !data?.success || !data?.token_hash) {
        const msg = (data as any)?.error || "Invalid mobile number or PIN";
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      // Exchange the magiclink token_hash for a real Supabase session
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: data.token_hash,
      });

      if (verifyError) {
        console.error('verifyOtp error:', verifyError);
        toast.error("Could not establish session. Please try again.");
        setIsLoading(false);
        return;
      }

      toast.success("Signed in successfully");
      navigate("/");
    } catch (error) {
      console.error('PIN login error:', error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (step === 1) {
      if (!/^\+?[0-9]{10,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))) {
        toast.error("Please enter a valid mobile number");
        return;
      }
      
      // Check if mobile already exists
      const { data: exists } = await supabase.rpc('check_mobile_exists', {
        check_mobile: formData.mobileNumber
      });
      
      if (exists) {
        toast.error("This mobile number is already registered");
        return;
      }
      
      setStep(2);
      return;
    }

    if (step === 2) {
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
      if (formData.secretWord.length < 4) {
        toast.error("Secret word must be at least 4 characters");
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      if (formData.name.trim().length < 2) {
        toast.error("Please enter your name");
        return;
      }
      
      setIsLoading(true);
      try {
        // Create account with a deterministic temp email tied to mobile (use .app - valid TLD)
        const cleanMobile = formData.mobileNumber.replace(/[^0-9]/g, '');
        const tempEmail = `pin_${cleanMobile}@hoyeeh.app`;
        const tempPassword = `Pin_${cleanMobile}_${Math.random().toString(36).slice(2, 10)}!A9`;
        
        // Sign up directly so we get the returned session/user immediately
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: tempEmail,
          password: tempPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: formData.name.trim() },
          },
        });
        
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already') || signUpError.message.toLowerCase().includes('registered')) {
            toast.error("This mobile number is already registered. Please sign in.");
          } else {
            console.error('signUp error:', signUpError);
            toast.error(signUpError.message || "Failed to create account. Please try again.");
          }
          setIsLoading(false);
          return;
        }
        
        // Ensure an active session exists (auto_confirm should provide one; fallback to signIn)
        let session = signUpData.session;
        if (!session) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: tempEmail,
            password: tempPassword,
          });
          if (signInError || !signInData.session) {
            console.error('post-signup sign-in error:', signInError);
            toast.error("Account created but sign-in failed. Please try again.");
            setIsLoading(false);
            return;
          }
          session = signInData.session;
        }
        
        // Call secure edge function to register PIN data (hashed server-side)
        const { data, error: registerError } = await supabase.functions.invoke('register-pin', {
          body: {
            mobileNumber: formData.mobileNumber,
            pin: formData.pin,
            secretWord: formData.secretWord,
            displayName: formData.name.trim(),
          }
        });

        if (registerError || (data && data.error)) {
          const errMsg = (data && data.error) || registerError?.message || "Failed to complete registration.";
          console.error('PIN registration error:', registerError || data?.error);
          toast.error(errMsg);
          setIsLoading(false);
          return;
        }
        
        toast.success("Account created successfully!");
        setShowWelcome(true);
      } catch (error) {
        console.error('Registration error:', error);
        toast.error("An error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleResetPin = async () => {
    if (step === 1) {
      if (!/^\+?[0-9]{10,15}$/.test(formData.mobileNumber.replace(/\s/g, ""))) {
        toast.error("Please enter a valid mobile number");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (formData.secretWord.length < 4) {
        toast.error("Secret word must be at least 4 characters");
        return;
      }
      setStep(3);
      return;
    }

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
      const { data, error } = await supabase.functions.invoke('reset-pin', {
        body: {
          mobileNumber: formData.mobileNumber,
          secretWord: formData.secretWord,
          newPin: formData.pin
        }
      });

      if (error) {
        toast.error("Failed to reset PIN. Please try again.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
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

  // Show welcome screen after successful registration
  if (showWelcome) {
    return (
      <MobileWelcomeScreen
        userName={formData.name.trim()}
        onStartExploring={() => navigate("/")}
      />
    );
  }

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
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">What's your name?</label>
            <p className="text-xs text-muted-foreground">This will be displayed on your profile.</p>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 pl-10 bg-secondary border-border"
                autoFocus
              />
            </div>
          </div>
          <Button 
            type="submit" 
            variant="brand" 
            size="lg" 
            className="w-full h-12"
            disabled={isLoading}
          >
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
