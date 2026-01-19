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
  User,
  Download,
  Smartphone,
  Info,
  Star,
  Users,
  MessageCircle,
  Wifi,
  PlayCircle,
  HardDrive,
  Globe,
  Palette,
  Clock,
  Lock,
  BellRing,
  Store,
  Brush,
  ShoppingBag,
  RefreshCw
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
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { MobileManageProfiles } from "./MobileManageProfiles";
import { MobileParentalControls } from "./MobileParentalControls";
import { MobileLanguageSettings } from "./MobileLanguageSettings";
import { MobileStorageSettings } from "./MobileStorageSettings";
import { MobilePlaybackSettings } from "./MobilePlaybackSettings";
import { MobileAppearanceSettings } from "./MobileAppearanceSettings";
import { MobileSwipeWrapper } from "./MobileSwipeWrapper";
import { MobileWatchHistory } from "./MobileWatchHistory";
import { MobileAccountSecurity } from "./MobileAccountSecurity";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { useIsCreator } from "@/hooks/useCreator";
import { useIsAdmin } from "@/hooks/useAdmin";
import { SupportChat } from "@/components/SupportChat";
import { MobileSupportChat } from "./MobileSupportChat";
import { useProfileContext } from "@/contexts/ProfileContext";

// Import centralized avatars
import { AVATARS } from "@/lib/avatars";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";

interface MenuSection {
  title: string;
  items: {
    icon: React.ElementType;
    label: string;
    path?: string;
    value?: string;
    toggle?: boolean;
    toggleKey?: string;
    action?: () => void;
    modalKey?: string;
    destructive?: boolean;
  }[];
}

export function MobileProfile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile, refetch } = useProfile();
  const { data: isCreator } = useIsCreator();
  const { data: isAdmin } = useIsAdmin();
  const { setCurrentProfile } = useProfileContext();
  const { lightTap, successFeedback, selectionTap, mediumTap } = useHaptics();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchProfile = () => {
    lightTap();
    setCurrentProfile(null);
    navigate("/profiles");
  };

  const [displayName, setDisplayName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  
  // Avatar crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  
  // Modal states
  const [showManageProfiles, setShowManageProfiles] = useState(false);
  const [showParentalControls, setShowParentalControls] = useState(false);
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [showPlaybackSettings, setShowPlaybackSettings] = useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);
  const [showWatchHistory, setShowWatchHistory] = useState(false);
  const [showAccountSecurity, setShowAccountSecurity] = useState(false);
  const [showWatchPartyGuide, setShowWatchPartyGuide] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  
  // Settings toggles
  const [wifiOnly, setWifiOnly] = useState(() => {
    return localStorage.getItem("wifiOnlyDownloads") === "true";
  });
  const [autoPlay, setAutoPlay] = useState(() => {
    return localStorage.getItem("autoPlayPreviews") !== "false";
  });

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create a URL for the selected image and open crop dialog
    const imageUrl = URL.createObjectURL(file);
    setImageToCrop(imageUrl);
    setCropDialogOpen(true);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;
    
    setCropDialogOpen(false);
    
    const filePath = `${user.id}/avatar-${Date.now()}.png`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true, contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setSelectedAvatar(publicUrl);
      successFeedback();
      toast.success("Avatar uploaded!");
    } catch (error) {
      toast.error("Failed to upload avatar");
    } finally {
      if (imageToCrop) {
        URL.revokeObjectURL(imageToCrop);
        setImageToCrop(null);
      }
    }
  };

  const handleSignOut = async () => {
    mediumTap();
    await signOut();
    navigate("/auth");
  };

  const handleWifiToggle = (checked: boolean) => {
    selectionTap();
    setWifiOnly(checked);
    localStorage.setItem("wifiOnlyDownloads", String(checked));
    toast.success(checked ? "WiFi-only downloads enabled" : "WiFi-only downloads disabled");
  };

  const handleAutoPlayToggle = (checked: boolean) => {
    selectionTap();
    setAutoPlay(checked);
    localStorage.setItem("autoPlayPreviews", String(checked));
    toast.success(checked ? "Auto-play enabled" : "Auto-play disabled");
  };

  // Get saved language
  const savedLanguage = localStorage.getItem("hoyeeh_language") || "en";
  const languageNames: Record<string, string> = {
    en: "English", fr: "French", es: "Spanish", pt: "Portuguese",
    de: "German", it: "Italian", ar: "Arabic", zh: "Chinese",
    ja: "Japanese", ko: "Korean", hi: "Hindi", sw: "Swahili"
  };

  const menuSections: MenuSection[] = [
    {
      title: "Account",
      items: [
        { icon: RefreshCw, label: "Switch Profile", action: handleSwitchProfile },
        { icon: Users, label: "Manage Profiles", modalKey: "profiles" },
        { icon: CreditCard, label: "Subscription", path: "/subscription", value: profile?.is_subscribed ? "Premium" : "Free" },
        { icon: ShoppingBag, label: "My Purchases", path: "/my-purchases" },
        { icon: Lock, label: "Account Security", modalKey: "security" },
        { icon: Shield, label: "Parental Controls", path: "/parental" },
      ],
    },
    {
      title: "Explore",
      items: [
        { icon: Store, label: "Hoyeeh Studio", path: "/creator-store" },
        ...(isCreator ? [{ icon: Brush, label: "Creator Dashboard", path: "/creator-dashboard" }] : []),
        ...(isAdmin ? [{ icon: Shield, label: "Admin Panel", path: "/admin" }] : []),
      ],
    },
    {
      title: "Watch Together",
      items: [
        { icon: Users, label: "Watch Party Guide", modalKey: "watchParty" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { icon: BellRing, label: "Push Notifications", toggleKey: "push" },
        { icon: Bell, label: "Notification Preferences", path: "/notification-preferences" },
      ],
    },
    {
      title: "Playback & Display",
      items: [
        { icon: PlayCircle, label: "Playback Quality", modalKey: "playback" },
        { icon: Palette, label: "App Appearance", modalKey: "appearance" },
        { icon: PlayCircle, label: "Auto-Play Previews", toggle: true, toggleKey: "autoPlay" },
      ],
    },
    {
      title: "Downloads & Storage",
      items: [
        { icon: Wifi, label: "WiFi-Only Downloads", toggle: true, toggleKey: "wifiOnly" },
        { icon: HardDrive, label: "Storage Management", modalKey: "storage" },
        { icon: Clock, label: "Watch History", modalKey: "watchHistory" },
      ],
    },
    {
      title: "Language & Region",
      items: [
        { icon: Globe, label: "App Language", modalKey: "language", value: languageNames[savedLanguage] || "English" },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: MessageCircle, label: "Contact Support", modalKey: "supportChat" },
        { icon: HelpCircle, label: "Help Center", path: "/help" },
        { icon: Star, label: "Rate Hoyeeh", action: () => toast.info("Thank you for your support!") },
      ],
    },
    {
      title: "About",
      items: [
        { icon: Info, label: "About Hoyeeh", path: "/about" },
        { icon: Settings, label: "Privacy Policy", path: "/privacy" },
        { icon: Settings, label: "Terms of Use", path: "/terms" },
      ],
    },
  ].filter(section => section.items.length > 0);

  const renderMenuItem = (item: MenuSection["items"][0]) => {
    // Special case for push notifications toggle
    if (item.toggleKey === "push") {
      return (
        <div key={item.label} className="p-1">
          <PushNotificationToggle />
        </div>
      );
    }

    if (item.toggle) {
      const isChecked = item.toggleKey === "wifiOnly" ? wifiOnly : autoPlay;
      const handleToggle = item.toggleKey === "wifiOnly" ? handleWifiToggle : handleAutoPlayToggle;
      
      return (
        <div
          key={item.label}
          className="flex items-center justify-between p-4 bg-muted/20 rounded-xl active:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="font-medium text-foreground text-sm">{item.label}</span>
          </div>
          <Switch
            checked={isChecked}
            onCheckedChange={handleToggle}
          />
        </div>
      );
    }

    const handleClick = () => {
      lightTap();
      if (item.modalKey === "profiles") setShowManageProfiles(true);
      else if (item.modalKey === "parental") setShowParentalControls(true);
      else if (item.modalKey === "language") setShowLanguageSettings(true);
      else if (item.modalKey === "storage") setShowStorageSettings(true);
      else if (item.modalKey === "playback") setShowPlaybackSettings(true);
      else if (item.modalKey === "appearance") setShowAppearanceSettings(true);
      else if (item.modalKey === "watchHistory") setShowWatchHistory(true);
      else if (item.modalKey === "security") setShowAccountSecurity(true);
      else if (item.modalKey === "watchParty") setShowWatchPartyGuide(true);
      else if (item.modalKey === "supportChat") setShowSupportChat(true);
      else if (item.action) item.action();
      else if (item.path) navigate(item.path);
    };

    return (
      <button
        key={item.label}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center justify-between p-4 bg-muted/20 rounded-xl active:bg-muted/40 active:scale-[0.98] transition-all",
          item.destructive && "bg-destructive/10"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            item.destructive ? "bg-destructive/20" : "bg-muted/50"
          )}>
            <item.icon className={cn(
              "w-4 h-4",
              item.destructive ? "text-destructive" : "text-muted-foreground"
            )} />
          </div>
          <span className={cn(
            "font-medium text-sm",
            item.destructive ? "text-destructive" : "text-foreground"
          )}>{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {item.value && (
            <span className="text-xs text-muted-foreground">{item.value}</span>
          )}
          <ChevronRight className={cn(
            "w-4 h-4",
            item.destructive ? "text-destructive/60" : "text-muted-foreground/60"
          )} />
        </div>
      </button>
    );
  };

  return (
    <MobileSwipeWrapper>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">My Hoyeeh</h1>
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
      <main className="pb-28 px-4" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 20px))' }}>
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-3xl p-6 mb-6 border border-border/10"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-6 h-6 ring-2 ring-primary/20 shadow-md">
                <AvatarImage src={selectedAvatar || ""} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-[10px]">
                  <User className="w-3 h-3 text-primary" />
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <button
                  onClick={() => {
                    lightTap();
                    setShowAvatarPicker(true);
                  }}
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"
                >
                  <Camera className="w-2 h-2 text-primary-foreground" />
                </button>
              )}
            </div>

            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="text-lg bg-muted/50 border-border/30 rounded-xl h-11"
                />
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground">
                    {profile?.display_name || "User"}
                  </h2>
                  <p className="text-muted-foreground text-sm truncate">{user?.email}</p>
                </>
              )}
            </div>
          </div>

          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </motion.div>

        {/* Subscription Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5 rounded-2xl p-4 mb-6 border border-primary/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {profile?.is_subscribed ? "Premium Member" : "Free Plan"}
                </p>
                {profile?.subscription_expiry && (
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(profile.subscription_expiry).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => {
                lightTap();
                navigate("/subscription");
              }}
              className="rounded-full bg-primary/90 hover:bg-primary active:scale-95 transition-all text-xs px-4"
            >
              {profile?.is_subscribed ? "Manage" : "Upgrade"}
            </Button>
          </div>
        </motion.div>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <motion.div 
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + sectionIndex * 0.05 }}
            className="mb-6"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.items.map(renderMenuItem)}
            </div>
          </motion.div>
        ))}

        {/* Sign Out Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-3 p-4 mt-4 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive/20 active:scale-[0.98] transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </motion.button>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          Hoyeeh v1.0.0
        </p>
      </main>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background"
          >
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
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
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
                </motion.button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                {/* Preset Avatars */}
                <p className="text-sm text-muted-foreground mb-3 px-1">Or choose an avatar</p>
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {AVATARS.map((avatar, index) => (
                    <motion.button
                      key={avatar.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleAvatarSelect(avatar.src)}
                      className={cn(
                        "relative w-8 h-8 sm:w-7 sm:h-7 rounded-lg overflow-hidden bg-muted/30 active:scale-95 transition-all mx-auto",
                        selectedAvatar === avatar.src && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      )}
                    >
                      <img
                        src={avatar.src}
                        alt={avatar.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedAvatar === avatar.src && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2 h-2 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Components */}
      <AnimatePresence>
        {showManageProfiles && (
          <MobileManageProfiles onClose={() => setShowManageProfiles(false)} />
        )}
        {showParentalControls && (
          <MobileParentalControls onClose={() => setShowParentalControls(false)} />
        )}
        {showLanguageSettings && (
          <MobileLanguageSettings onClose={() => setShowLanguageSettings(false)} />
        )}
        {showStorageSettings && (
          <MobileStorageSettings onClose={() => setShowStorageSettings(false)} />
        )}
      </AnimatePresence>
      
      <MobilePlaybackSettings 
        open={showPlaybackSettings} 
        onClose={() => setShowPlaybackSettings(false)} 
      />
      <MobileAppearanceSettings 
        open={showAppearanceSettings} 
        onClose={() => setShowAppearanceSettings(false)} 
      />
      <MobileWatchHistory 
        open={showWatchHistory} 
        onClose={() => setShowWatchHistory(false)} 
      />
      <MobileAccountSecurity 
        open={showAccountSecurity} 
        onClose={() => setShowAccountSecurity(false)} 
      />

      {/* Watch Party Guide Modal */}
      <AnimatePresence>
        {showWatchPartyGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <header className="flex items-center justify-between px-4 py-3 border-b border-border/10">
                <button
                  onClick={() => {
                    lightTap();
                    setShowWatchPartyGuide(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-semibold">Watch Party Guide</h1>
                <div className="w-10" />
              </header>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold">Watch Together</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Enjoy videos with friends in real-time
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-muted/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">1</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">Start a Party</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Open any video and tap the "Watch Party" button to create a party. You'll get a unique code to share.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">2</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">Invite Friends</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Share the party code with friends. They can join by entering the code on the same video page.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-bold">3</span>
                      </div>
                      <div>
                        <h3 className="font-semibold">Watch in Sync</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Everyone's video stays synchronized automatically. When the host plays, pauses, or seeks, everyone follows.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-xl p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Chat Together</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Use the built-in chat to discuss what you're watching with your friends in real-time!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-6">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Pro Tip:</strong> The party host controls playback. Sync happens automatically within 2 seconds for the best viewing experience.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Support Chat */}
      <MobileSupportChat 
        open={showSupportChat} 
        onClose={() => setShowSupportChat(false)} 
      />

      {/* Avatar Crop Dialog */}
      {imageToCrop && (
        <AvatarCropDialog
          imageSrc={imageToCrop}
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            if (imageToCrop) {
              URL.revokeObjectURL(imageToCrop);
              setImageToCrop(null);
            }
          }}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Bottom Nav */}
      <MobileBottomNav />
    </div>
    </MobileSwipeWrapper>
  );
}