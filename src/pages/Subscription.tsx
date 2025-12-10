import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, Check, ArrowLeft, Crown } from "lucide-react";

const MONTHLY_PRICE = "2,500 XAF";

const Subscription = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
      const txRef = searchParams.get("tx_ref");

      if (success === "true") {
        toast.success("Payment successful! Welcome to Hoyeeh Premium!");
        refetchProfile();
        navigate("/subscription", { replace: true });
      } else if (canceled === "true") {
        toast.error("Payment was canceled");
        navigate("/subscription", { replace: true });
      } else if (txRef) {
        // Verify Flutterwave payment
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
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("stripe-payment", {
        body: { action: "create-checkout" },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

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

  const handleFlutterwavePayment = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("flutterwave-payment", {
        body: { action: "initialize" },
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

  const isSubscribed = profile?.is_subscribed;

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
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Your subscription is active until{" "}
                <span className="text-foreground font-medium">
                  {profile.subscription_expiry
                    ? new Date(profile.subscription_expiry).toLocaleDateString()
                    : "forever"}
                </span>
              </p>
              <Button onClick={() => navigate("/")} className="mt-4">
                Continue Watching
              </Button>
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

            {/* Pricing Card */}
            <Card className="bg-card border-primary/20 mb-8">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-3xl">{MONTHLY_PRICE}</CardTitle>
                <CardDescription>per month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-muted-foreground text-sm">
                  Cancel anytime. No hidden fees.
                </p>

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
                    Pay with Card (Stripe)
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
                  Secure payment powered by Stripe and Flutterwave
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