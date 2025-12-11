import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Camera, 
  Check, 
  ChevronRight, 
  Edit2, 
  LogOut, 
  Bell, 
  Shield, 
  CreditCard, 
  HelpCircle,
  Settings,
  User
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MobileBottomNav } from "./MobileBottomNav";

// Import avatar images
import avatarBasketball from "@/assets/avatars/avatar-basketball.png";
import avatarGold from "@/assets/avatars/avatar-gold.png";
import avatarBlue from "@/assets/avatars/avatar-blue.png";
import avatarPurple from "@/assets/avatars/avatar-purple.png";
import avatarGreen from "@/assets/avatars/avatar-green.png";
import avatarYellow from "@/assets/avatars/avatar-yellow.png";
import avatarRed from "@/assets/avatars/avatar-red.png";
import avatarCowboy from "@/assets/avatars/avatar-cowboy.png";
import avatarUnicorn from "@/assets/avatars/avatar-unicorn.png";

// Avatar options
const AVATARS = [
  { src: avatarBasketball, name: "Basketball" },
  { src: avatarGold, name: "Gold" },
  { src: avatarBlue, name: "Blue" },
  { src: avatarPurple, name: "Purple" },
  { src: avatarGreen, name: "Green" },
  { src: avatarYellow, name: "Yellow" },
  { src: avatarRed, name: "Red" },
  { src: avatarCowboy, name: "Cowboy" },
  { src: avatarUnicorn, name: "Unicorn" },
];

export function MobileProfile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { lightTap, successFeedback, selectionTap } = useHaptics();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setSelectedAvatar(profile.avatar_url);
    }
  }, [profile]);

  const handleBack = () => {
    lightTap();
    navigate(-1);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    lightTap();

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          display_name: displayName,
          avatar_url: selectedAvatar 
        })
        .eq("id", user.id);

      if (error) throw error;

      successFeedback();
      toast.success("Profile updated!");
      setIsEditing(false);
      refetch();
    } catch (error: any) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelect = (avatarSrc: string) => {
    selectionTap();
    setSelectedAvatar(avatarSrc);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setSelectedAvatar(publicUrl);
      successFeedback();
      toast.success("Avatar uploaded!");
    } catch (error) {
      toast.error("Failed to upload avatar");
    }
  };

  const handleSignOut = async () => {
    lightTap();
    await signOut();
    navigate("/auth");
  };

  const menuItems = [
    { icon: Bell, label: "Notifications", path: "/notification-preferences" },
    { icon: Shield, label: "Parental Controls", path: "/profile", hash: "#parental" },
    { icon: CreditCard, label: "Subscription", path: "/subscription" },
    { icon: HelpCircle, label: "Help Center", path: "/help" },
    { icon: Settings, label: "Settings", path: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14 pt-safe">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Profile</h1>
          <button
            onClick={() => {
              lightTap();
              setIsEditing(!isEditing);
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
          >
            <Edit2 className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar className="w-28 h-28 ring-4 ring-primary/20 shadow-2xl">
              <AvatarImage src={selectedAvatar || ""} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-3xl">
                <User className="w-12 h-12 text-primary" />
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <button
                onClick={() => {
                  lightTap();
                  setShowAvatarPicker(true);
                }}
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Camera className="w-5 h-5 text-primary-foreground" />
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="mt-6 w-full max-w-xs">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Display Name"
                className="text-center text-lg bg-muted/50 border-border/30 rounded-xl h-12"
              />
            </div>
          ) : (
            <>
              <h2 className="mt-4 text-2xl font-bold text-foreground">
                {profile?.display_name || "User"}
              </h2>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </>
          )}

          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="mt-4 rounded-full px-8 bg-primary hover:bg-primary/90 active:scale-95 transition-all"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>

        {/* Subscription Status */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-4 mb-6 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold text-foreground">
                {profile?.is_subscribed ? "Premium" : "Free"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                lightTap();
                navigate("/subscription");
              }}
              className="rounded-full border-primary/30 text-primary hover:bg-primary/10 active:scale-95 transition-all"
            >
              {profile?.is_subscribed ? "Manage" : "Upgrade"}
            </Button>
          </div>
          {profile?.subscription_expiry && (
            <p className="text-xs text-muted-foreground mt-2">
              Expires: {new Date(profile.subscription_expiry).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                lightTap();
                navigate(item.path);
              }}
              className="w-full flex items-center justify-between p-4 bg-muted/30 rounded-2xl hover:bg-muted/50 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-foreground" />
                </div>
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-3 p-4 mt-8 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive/20 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </main>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl">
          <div className="flex flex-col h-full pt-safe">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border/10">
              <button
                onClick={() => {
                  lightTap();
                  setShowAvatarPicker(false);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <h2 className="font-semibold text-foreground">Choose Avatar</h2>
              <button
                onClick={() => {
                  lightTap();
                  setShowAvatarPicker(false);
                }}
                className="text-primary font-medium"
              >
                Done
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Upload Option */}
              <button
                onClick={() => {
                  lightTap();
                  fileInputRef.current?.click();
                }}
                className="w-full flex items-center gap-4 p-4 mb-4 bg-muted/30 rounded-2xl hover:bg-muted/50 active:scale-[0.98] transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Upload Photo</p>
                  <p className="text-sm text-muted-foreground">Choose from gallery</p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Preset Avatars */}
              <p className="text-sm text-muted-foreground mb-3 px-1">Or choose an avatar</p>
              <div className="grid grid-cols-3 gap-4">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.name}
                    onClick={() => handleAvatarSelect(avatar.src)}
                    className={cn(
                      "relative aspect-square rounded-2xl overflow-hidden bg-muted/30 active:scale-95 transition-all",
                      selectedAvatar === avatar.src && "ring-4 ring-primary"
                    )}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                    {selectedAvatar === avatar.src && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}
