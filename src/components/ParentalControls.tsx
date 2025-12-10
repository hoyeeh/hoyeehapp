import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

const CONTENT_RATINGS = [
  { value: "G", label: "G - General Audiences", description: "Suitable for all ages" },
  { value: "PG", label: "PG - Parental Guidance", description: "Some material may not be suitable for children" },
  { value: "PG-13", label: "PG-13 - Parents Strongly Cautioned", description: "May be inappropriate for children under 13" },
  { value: "R", label: "R - Restricted", description: "Under 17 requires parent or guardian" },
  { value: "NC-17", label: "NC-17 - Adults Only", description: "No one 17 and under admitted" },
];

export const ParentalControls = () => {
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  
  const [enabled, setEnabled] = useState(false);
  const [ratingLimit, setRatingLimit] = useState("R");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setEnabled((profile as any).parental_controls_enabled || false);
      setRatingLimit((profile as any).parental_rating_limit || "R");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    if (enabled && pin && pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    if (enabled && pin && (pin.length < 4 || pin.length > 6)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }

    if (enabled && pin && !/^\d+$/.test(pin)) {
      toast.error("PIN must contain only numbers");
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        parental_controls_enabled: enabled,
        parental_rating_limit: ratingLimit,
      };

      if (pin) {
        updates.parental_pin = pin;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      refetch();
      setPin("");
      setConfirmPin("");
      toast.success("Parental controls updated");
    } catch (error) {
      console.error("Error saving parental controls:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const hasExistingPin = !!(profile as any)?.parental_pin;

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand" />
          Parental Controls
        </CardTitle>
        <CardDescription>
          Restrict content based on ratings and protect with a PIN
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="parental-toggle" className="text-base font-medium">
              Enable Parental Controls
            </Label>
            <p className="text-sm text-muted-foreground">
              Restrict content above your selected rating
            </p>
          </div>
          <Switch
            id="parental-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {enabled && (
          <>
            {/* Rating Limit */}
            <div className="space-y-2">
              <Label>Maximum Content Rating</Label>
              <Select value={ratingLimit} onValueChange={setRatingLimit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_RATINGS.map((rating) => (
                    <SelectItem key={rating.value} value={rating.value}>
                      <div>
                        <div className="font-medium">{rating.label}</div>
                        <div className="text-xs text-muted-foreground">{rating.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Content rated above this level will require PIN to view
              </p>
            </div>

            {/* PIN Setup */}
            <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-brand" />
                <Label className="text-base font-medium">
                  {hasExistingPin ? "Change PIN" : "Set PIN"}
                </Label>
              </div>
              
              {hasExistingPin && (
                <p className="text-sm text-muted-foreground">
                  A PIN is already set. Enter a new PIN to change it.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pin">
                    {hasExistingPin ? "New PIN" : "PIN"} (4-6 digits)
                  </Label>
                  <div className="relative">
                    <Input
                      id="pin"
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirm PIN</Label>
                  <Input
                    id="confirmPin"
                    type={showPin ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
};
