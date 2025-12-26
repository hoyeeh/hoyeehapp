import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Camera, User, CreditCard, Shield, Check, Bell, Settings, Crown, Users, Play, MessageSquare, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { ParentalControls } from "@/components/ParentalControls";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileProfile } from "@/components/mobile/MobileProfile";
import { CreatorSection } from "@/components/creator/CreatorSection";

// Import centralized avatars
import { AVATARS, isPresetAvatar } from "@/lib/avatars";

const COUNTRIES = [
  { code: 'CM', name: 'Cameroon' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
];

const Profile = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("CM");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);

  // Return mobile version for mobile devices
  if (isMobile) {
    return <MobileProfile />;
  }

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setCountry(profile.country || "CM");
      setAvatarUrl(profile.avatar_url);
      
      // Find matching preset avatar
      const avatarIndex = AVATARS.findIndex(a => a.src === profile.avatar_url);
      if (avatarIndex >= 0) {
        setSelectedAvatar(avatarIndex);
      }
    }
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setSelectedAvatar(null);
      refetch();
      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSelectPresetAvatar = async (index: number) => {
    if (!user) return;
    
    setUploading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: AVATARS[index].src })
        .eq('id', user.id);

      if (error) throw error;

      setAvatarUrl(AVATARS[index].src);
      setSelectedAvatar(index);
      setAvatarDialogOpen(false);
      refetch();
      toast.success("Avatar updated successfully");
    } catch (error) {
      console.error('Avatar update error:', error);
      toast.error("Failed to update avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          country,
        })
        .eq('id', user.id);

      if (error) throw error;

      refetch();
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Check if current avatar is a preset - using imported function

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo />
          <span className="text-muted-foreground">/ Profile</span>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-8">
        {/* Avatar Section */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Picture
            </CardTitle>
            <CardDescription>Choose an avatar or upload your own picture</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={() => setAvatarDialogOpen(true)}>
                <AvatarImage src={avatarUrl || undefined} alt={displayName} className="object-cover" />
                <AvatarFallback className="text-2xl bg-brand text-primary-foreground">
                  {displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => setAvatarDialogOpen(true)}
                className="absolute bottom-0 right-0 p-1.5 bg-brand rounded-full cursor-pointer hover:bg-brand/90 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                ) : (
                  <Camera className="h-4 w-4 text-primary-foreground" />
                )}
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{displayName || "Set your display name"}</p>
                {profile?.is_subscribed && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold">
                    <Crown className="h-3 w-3" />
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setAvatarDialogOpen(true)}
              >
                Change Avatar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Avatar Selection Dialog */}
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Choose Your Avatar</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Current Avatar Preview */}
              <div className="flex justify-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage 
                    src={selectedAvatar !== null ? AVATARS[selectedAvatar].src : avatarUrl || undefined} 
                    alt="Preview"
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl bg-brand text-primary-foreground">
                    {displayName?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Preset Avatars Grid */}
              <div>
                <Label className="text-sm text-muted-foreground mb-3 block">Choose from presets</Label>
                <div className="grid grid-cols-5 gap-3 justify-items-center">
                  {AVATARS.map((avatar, i) => (
                    <button
                      key={avatar.name}
                      className={cn(
                        "w-14 h-14 rounded-lg overflow-hidden transition-all relative",
                        (selectedAvatar === i || avatarUrl === avatar.src) 
                          ? "ring-2 ring-offset-2 ring-brand scale-110" 
                          : "hover:scale-105 opacity-70 hover:opacity-100"
                      )}
                      onClick={() => handleSelectPresetAvatar(i)}
                      disabled={uploading}
                    >
                      <img 
                        src={avatar.src} 
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                      />
                      {avatarUrl === avatar.src && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Upload */}
              <div className="pt-4 border-t border-border">
                <Label className="text-sm text-muted-foreground mb-3 block">Or upload your own</Label>
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload custom image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAvatarDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Profile Details */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="bg-secondary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="bg-secondary opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-brand hover:bg-brand/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {profile?.is_subscribed ? "Subscribed Member" : "Free Plan"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile?.is_subscribed
                    ? `Expires: ${profile.subscription_expiry ? new Date(profile.subscription_expiry).toLocaleDateString() : 'N/A'}`
                    : "Upgrade for unlimited access to premium content"}
                </p>
              </div>
              <Button
                variant={profile?.is_subscribed ? "secondary" : "default"}
                onClick={() => navigate("/subscription")}
                className={!profile?.is_subscribed ? "bg-brand hover:bg-brand/90" : ""}
              >
                {profile?.is_subscribed ? "Manage" : "Upgrade"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Parental Controls */}
        <ParentalControls />

        {/* Notifications */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PushNotificationToggle />
            <Separator />
            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={() => navigate("/notification-preferences")}
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Detailed Notification Settings
              </span>
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Button>
          </CardContent>
        </Card>

        {/* Watch Party Section */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Watch Party
            </CardTitle>
            <CardDescription>Watch together with friends in real-time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">How to use Watch Party</h4>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <Play className="h-3 w-3 text-brand" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Start a Party</p>
                    <p>Open any video and click the "Watch Party" button to create a party and get a unique code.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <Share2 className="h-3 w-3 text-brand" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Invite Friends</p>
                    <p>Share the party code with friends. They can join by entering the code on the same video page.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-3 w-3 text-brand" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Chat & Sync</p>
                    <p>Everyone's video stays in sync automatically. Use the chat to discuss what you're watching!</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> The party host controls playback. When they play, pause, or seek, everyone's video syncs automatically within 2 seconds.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Creator Section */}
        <CreatorSection />

        {/* Account Actions */}
        <Card className="bg-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Member since: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="border-t border-border pt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Legal & Support</h3>
          <div className="flex flex-wrap gap-4">
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Use
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact Us
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link to="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Support
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link to="/copyright" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Copyright
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            © {new Date().getFullYear()} Hoyeeh. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Profile;
