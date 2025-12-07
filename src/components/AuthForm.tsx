import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface AuthFormProps {
  onSuccess: (user: any) => void;
  onBack: () => void;
  initialEmail?: string;
}

export const AuthForm = ({ onSuccess, onBack, initialEmail = "" }: AuthFormProps) => {
  const [isRegistering, setIsRegistering] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: initialEmail,
    password: "",
    confirmPassword: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate authentication
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockUser = {
      id: "user-1",
      email: formData.email,
      name: formData.name || "User",
      mobileNumber: "+1234567890",
      role: "user" as const,
      country: "US",
      isSubscribed: true,
      myList: [],
      watchHistory: [],
    };
    
    setIsLoading(false);
    onSuccess(mockUser);
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const demoUser = {
      id: "demo-user",
      email: "demo@hoyeeh.com",
      name: "Demo User",
      mobileNumber: "+1234567890",
      role: "user" as const,
      country: "US",
      isSubscribed: true,
      myList: ["1", "3"],
      watchHistory: [],
    };
    
    setIsLoading(false);
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-12 py-6 border-b border-border">
        <button onClick={onBack}>
          <Logo />
        </button>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/80 backdrop-blur-sm rounded-lg p-8 md:p-12 animate-scale-in">
          <h1 className="font-display text-3xl md:text-4xl mb-8">
            {isRegistering ? "Sign Up" : "Sign In"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <Input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 bg-secondary border-border"
              />
            )}
            
            <Input
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-12 bg-secondary border-border"
              required
            />
            
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-12 bg-secondary border-border pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {isRegistering && (
              <Input
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="h-12 bg-secondary border-border"
                required
              />
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full h-12 text-lg font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRegistering ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-sm">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full h-12"
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            Try Demo Account
          </Button>

          <p className="mt-8 text-muted-foreground">
            {isRegistering ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setIsRegistering(false)}
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
        </div>
      </div>
    </div>
  );
};
