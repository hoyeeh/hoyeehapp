import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { supabase } from "@/integrations/supabase/client";
import { useSEO } from "@/hooks/useSEO";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, Check, ArrowLeft, Crown, Star, Sparkles, Settings, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Currency conversion rates (approximate)
const CURRENCY_RATES = {
  XAF: 1,
  USD: 0.0016,
  NGN: 2.5,
  GHS: 0.02,
  ZAR: 0.03,
  KES: 0.22,
};

const formatCurrency = (amountXAF: number, currency: keyof typeof CURRENCY_RATES) => {
  const converted = amountXAF * CURRENCY_RATES[currency];
  const symbols: Record<string, string> = {
    XAF: "XAF",
    USD: "$",
    NGN: "₦",
    GHS: "GH₵",
    ZAR: "R",
    KES: "KSh",
  };
  
  if (currency === "XAF") {
    return `${converted.toLocaleString()} ${symbols[currency]}`;
  }
  return `${symbols[currency]}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Subscription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");

  // SEO meta tags
  useSEO({
    title: 'Subscribe to Hoyeeh Premium',
    description: 'Get unlimited access to African movies, TV shows, and exclusive content with Hoyeeh Premium. Stream in HD & 4K, download for offline viewing, and enjoy ad-free entertainment.',
    url: 'https://hoyeeh.com/subscription',
    keywords: [
      'Hoyeeh subscription',
      'premium streaming',
      'African movies',
      'TV shows',
      'HD streaming',
      '4K content',
      'ad-free',
      'offline downloads',
    ],
  });

  // Fetch subscription settings from database
  const { data: subscriptionSettings } = useQuery({
    queryKey: ["subscription-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_settings")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const monthlyPlan = subscriptionSettings?.find(s => s.plan_type === "monthly");
  const yearlyPlan = subscriptionSettings?.find(s => s.plan_type === "yearly");

  const monthlyPrice = monthlyPlan?.base_price || 2500;
  const yearlyPrice = yearlyPlan?.base_price || 20000;
  const yearlySavings = (monthlyPrice * 12) - yearlyPrice;
  const savingsPercent = Math.round((yearlySavings / (monthlyPrice * 12)) * 100);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Handle payment callbacks
  useEffect(() => {
    const handlePaymentCallback = async () => {
      const success = searchParams.get("success");
      const canceled = searchParams.get("canceled");
      const sessionId = searchParams.get("session_id");
      const txRef = searchParams.get("tx_ref");

      if (success === "true" && sessionId) {
        setVerifying(true);
        try {
          const { data: session } = await supabase.auth.getSession();
          const response = await supabase.functions.invoke("stripe-payment", {
            body: { action: "verify-payment", sessionId },
            headers: {
              Authorization: `Bearer ${session.session?.access_token}`,
            },
          });

          if (response.data?.success) {
            toast.success("Payment successful! Welcome to Hoyeeh Premium!");
            refetchProfile();
          } else {
            toast.info("Payment is being processed. Please refresh in a moment.");
          }
        } catch (error) {
          console.error("Verification error:", error);
          toast.error("Failed to verify payment");
        } finally {
          setVerifying(false);
          navigate("/subscription", { replace: true });
        }
      } else if (success === "true") {
        toast.success("Payment successful! Welcome to Hoyeeh Premium!");
        refetchProfile();
        navigate("/subscription", { replace: true });
      } else if (canceled === "true") {
        toast.error("Payment was canceled");
        navigate("/subscription", { replace: true });
      } else if (txRef) {
        setVerifying(true);
        try {
          const { data: session } = await supabase.auth.getSession();
          const response = await supabase.functions.invoke("flutterwave-payment", {
            body: { action: "verify", tx_ref: txRef },
            headers: {
              Authorization: `Bearer ${session.session?.access_token}`,
            },
          });

          if (response.data?.success) {
            toast.success("Payment verified! Welcome to Hoyeeh Premium!");
            refetchProfile();
          } else {
            toast.error("Payment verification failed");
          }
        } catch (error) {
          console.error("Verification error:", error);
          toast.error("Failed to verify payment");
        } finally {
          setVerifying(false);
          navigate("/subscription", { replace: true });
        }
      }
    };

    handlePaymentCallback();
  }, [searchParams, refetchProfile, navigate]);

  const handleStripePayment = async () => {
    if (!user) {
      toast.error("Please sign in first");
      navigate("/auth");
      return;
    }
    
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session?.access_token) {
        toast.error("Session expired. Please sign in again.");
        navigate("/auth");
        return;
      }
      
      const response = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create-checkout", plan_type: selectedPlan },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create checkout session");
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error(response.data?.error || "Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Stripe payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to open customer portal");
      }

      if (response.data?.url) {
        window.open(response.data.url, "_blank");
      } else {
        throw new Error(response.data?.error || "Failed to open customer portal");
      }
    } catch (error: any) {
      console.error("Customer portal error:", error);
      toast.error(error.message || "Failed to open subscription management");
    } finally {
      setLoading(false);
    }
  };

  const handleFlutterwavePayment = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("flutterwave-payment", {
        body: { action: "initialize", plan_type: selectedPlan },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (response.data?.link) {
        window.location.href = response.data.link;
      } else {
        throw new Error(response.data?.error || "Failed to initialize payment");
      }
    } catch (error: any) {
      console.error("Flutterwave payment error:", error);
      toast.error(error.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const { hasFullAccess, isAdminUser, isImpersonating } = useSubscriptionAccess();
  // Treat as subscribed only if flag is set AND (no expiry OR expiry in the future)
  const subActive = profile?.is_subscribed && (!profile?.subscription_expiry || new Date(profile.subscription_expiry) > new Date());
  const isSubscribed = subActive || hasFullAccess;
  const currentPrice = selectedPlan === "yearly" ? yearlyPrice : monthlyPrice;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="p-4 md:p-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Logo />
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-8">
        {isSubscribed ? (
          <Card className="bg-card border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're a Premium Member!</CardTitle>
              <CardDescription>
                Enjoy unlimited access to all our content
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-muted-foreground">
                Your subscription is active until{" "}
                <span className="text-foreground font-medium">
                  {profile.subscription_expiry
                    ? new Date(profile.subscription_expiry).toLocaleDateString()
                    : "forever"}
                </span>
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate("/")} className="gap-2">
                  Continue Watching
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4" />
                  )}
                  Manage Subscription
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Change payment method, view invoices, or cancel your subscription
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="font-display text-4xl md:text-5xl mb-4">
                Upgrade to <span className="text-gradient">Premium</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Get unlimited access to all movies, TV shows, and exclusive content
              </p>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                "Unlimited streaming",
                "HD & 4K quality",
                "No ads",
                "Download to watch offline",
                "Early access to new releases",
                "Exclusive content",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 p-3 rounded-lg bg-card"
                >
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* Plan Selection */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {/* Monthly Plan */}
              <Card 
                className={`cursor-pointer transition-all ${
                  selectedPlan === "monthly" 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-muted-foreground"
                }`}
                onClick={() => setSelectedPlan("monthly")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center justify-between">
                    Monthly
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === "monthly" ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selectedPlan === "monthly" && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(monthlyPrice, "XAF")}
                  </p>
                  <p className="text-sm text-muted-foreground">per month</p>
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p>≈ {formatCurrency(monthlyPrice, "USD")} • {formatCurrency(monthlyPrice, "NGN")}</p>
                    <p>≈ {formatCurrency(monthlyPrice, "GHS")} • {formatCurrency(monthlyPrice, "ZAR")} • {formatCurrency(monthlyPrice, "KES")}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Yearly Plan - Recommended */}
              <Card 
                className={`cursor-pointer transition-all relative overflow-hidden ${
                  selectedPlan === "yearly" 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-border hover:border-muted-foreground"
                }`}
                onClick={() => setSelectedPlan("yearly")}
              >
                {/* Recommended Badge */}
                <div className="absolute top-0 right-0">
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    BEST VALUE
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      Yearly
                      <Star className="h-4 w-4 text-primary fill-primary" />
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === "yearly" ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selectedPlan === "yearly" && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(yearlyPrice, "XAF")}
                  </p>
                  <p className="text-sm text-muted-foreground">per year</p>
                  <div className="mt-2 inline-flex items-center gap-1 bg-green-500/20 text-green-400 text-xs font-medium px-2 py-1 rounded">
                    Save {savingsPercent}% ({formatCurrency(yearlySavings, "XAF")})
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p>≈ {formatCurrency(yearlyPrice, "USD")} • {formatCurrency(yearlyPrice, "NGN")}</p>
                    <p>≈ {formatCurrency(yearlyPrice, "GHS")} • {formatCurrency(yearlyPrice, "ZAR")} • {formatCurrency(yearlyPrice, "KES")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Methods */}
            <Card className="bg-card border-primary/20 mb-8">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">
                  {selectedPlan === "yearly" ? "Yearly" : "Monthly"} Plan: {formatCurrency(currentPrice, "XAF")}
                </CardTitle>
                <CardDescription>
                  {selectedPlan === "yearly" 
                    ? `That's only ${formatCurrency(Math.round(yearlyPrice / 12), "XAF")}/month!`
                    : "Flexible monthly billing"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Recommended Payment Notice */}
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-sm text-primary font-medium flex items-center justify-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Card payment recommended for faster processing
                  </p>
                </div>

                <div className="grid gap-3">
                  <Button
                    size="lg"
                    onClick={handleStripePayment}
                    disabled={loading}
                    className="w-full gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Pay with Card (Recommended)
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={handleFlutterwavePayment}
                    disabled={loading}
                    className="w-full gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    Pay with Mobile Money
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Secure payment powered by Stripe and Flutterwave. Cancel anytime.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Subscription;
