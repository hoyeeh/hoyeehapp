import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, ArrowLeft, Phone } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMobileDevice } from "@/hooks/useMobileDevice";
import { MobileAuth } from "@/components/mobile/MobileAuth";
import { MobileWelcomeScreen } from "@/components/mobile/MobileWelcomeScreen";

interface PinAuthData {
  mobileNumber: string;
  pin: string;
  secretWord: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();
  const { isMobileDevice, isTablet } = useMobileDevice();

  // Render mobile auth for mobile/tablet devices
  if (isMobileDevice || isTablet) {
    return <MobileAuth />;
  }
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pinAuthData, setPinAuthData] = useState<PinAuthData | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });

  const [errors, setErrors] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Check for PIN registration data from sessionStorage
  useEffect(() => {
    const state = location.state as { fromPinRegistration?: boolean } | null;
    if (state?.fromPinRegistration) {
      const storedData = sessionStorage.getItem('pinAuthData');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData) as PinAuthData;
          setPinAuthData(parsed);
          setIsRegistering(true);
        } catch (e) {
          console.error('Failed to parse PIN auth data:', e);
        }
      }
    }
  }, [location.state]);

  const validateForm = () => {
    const newErrors = { email: "", password: "", confirmPassword: "" };
    let isValid = true;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    // Confirm password validation (only for registration)
    if (isRegistering && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      if (isRegistering) {
        const { error } = await signUp(formData.email, formData.password, formData.name);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Please sign in instead.");
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
          return;
        }
        
        // If we have PIN auth data, update the profile with mobile/PIN/secret word
        if (pinAuthData) {
          // Wait a moment for the profile to be created by the trigger
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                mobile_number: pinAuthData.mobileNumber,
                pin_code: pinAuthData.pin,
                secret_word: pinAuthData.secretWord,
              })
              .eq("id", user.id);

            if (updateError) {
              console.error('Failed to update profile with PIN data:', updateError);
              toast.error("Account created but PIN setup failed. You can set it up later.");
            } else {
              toast.success("Account created with PIN authentication enabled!");
            }
            
            // Clear the session storage
            sessionStorage.removeItem('pinAuthData');
          }
        } else {
        toast.success("Account created successfully! Welcome to Hoyeeh.");
        }
        
        // Clear current profile to force profile selection
        localStorage.removeItem("hoyeeh_current_profile");
        setShowWelcome(true);
        setIsLoading(false);
        return;
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(error.message);
          }
        } else {
          // Clear current profile to force profile selection
          localStorage.removeItem("hoyeeh_current_profile");
          toast.success("Welcome back to Hoyeeh!");
          navigate("/profiles");
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showWelcome) {
    return (
      <MobileWelcomeScreen
        userName={formData.name.trim() || "there"}
        onStartExploring={() => navigate("/profiles")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-12 py-6 border-b border-border">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <Logo />
        </button>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-lg p-8 md:p-12 animate-scale-in">
          <h1 className="font-display text-3xl md:text-4xl mb-2">
            {isRegistering ? "Sign Up" : "Sign In"}
          </h1>
          
          {pinAuthData && (
            <div className="mb-6 p-3 bg-brand/10 border border-brand/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-brand">
                <Phone className="h-4 w-4" />
                <span>PIN login enabled: {pinAuthData.mobileNumber}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Complete registration to enable PIN authentication
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {isRegistering && (
              <Input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 bg-secondary border-border"
              />
            )}
            
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`h-12 bg-secondary border-border ${errors.email ? 'border-destructive' : ''}`}
              />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>
            
            <div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`h-12 bg-secondary border-border pr-12 ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
            </div>

            {isRegistering && (
              <div>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`h-12 bg-secondary border-border ${errors.confirmPassword ? 'border-destructive' : ''}`}
                />
                {errors.confirmPassword && <p className="text-destructive text-sm mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full h-12 text-base sm:text-lg font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : isRegistering ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
             </Button>

            {!isRegistering && (
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-2"
              >
                Forgot your password?
              </button>
            )}
          </form>

          <p className="mt-8 text-muted-foreground text-center">
            {isRegistering ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setIsRegistering(false);
                    setPinAuthData(null);
                    sessionStorage.removeItem('pinAuthData');
                  }}
                  className="text-foreground hover:underline font-medium"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                New to Hoyeeh?{" "}
                <button
                  onClick={() => setIsRegistering(true)}
                  className="text-foreground hover:underline font-medium"
                >
                  Sign up now
                </button>
              </>
            )}
          </p>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <button
              onClick={() =>
                navigate("/pin-auth", {
                  state: { initialMode: isRegistering ? "register" : "login" },
                })
              }
              className="text-brand hover:underline font-medium"
            >
              {isRegistering
                ? "Sign up with Mobile Number & PIN"
                : "Sign in with Mobile Number & PIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
