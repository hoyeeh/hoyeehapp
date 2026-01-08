import { useState } from "react";
import { useProfileContext, UserProfile } from "@/contexts/ProfileContext";
import { Plus, Edit2, Trash2, Check, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileBackgroundBanner } from "./ProfileBackgroundBanner";
import { 
  AVATARS, 
  AVATAR_RINGS,
  getRandomAvatar, 
  getRandomRing,
  isPresetAvatar,
  getAvatarsForProfile,
  getRingById,
  resolveAvatarSrc,
  getAvatarUrlPath
} from "@/lib/avatars";

interface ProfilePickerProps {
  onProfileSelected: (profile: UserProfile) => void;
}

export const ProfilePicker = ({ onProfileSelected }: ProfilePickerProps) => {
  const { profiles, createProfile, updateProfile, deleteProfile, loading } = useProfileContext();
  const [isManaging, setIsManaging] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [isKids, setIsKids] = useState(false);
  const [selectedAvatarSrc, setSelectedAvatarSrc] = useState("");
  const [selectedRing, setSelectedRing] = useState("none");
  const [transitioningProfile, setTransitioningProfile] = useState<string | null>(null);

  const handleProfileClick = async (profile: UserProfile) => {
    if (isManaging) return;
    
    // Start transition animation
    setTransitioningProfile(profile.id);
    
    // Wait for animation to complete
    setTimeout(() => {
      onProfileSelected(profile);
    }, 400);
  };

  const handleCreateOrUpdate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    try {
      // Convert display src to URL path for database storage
      const avatarUrlPath = getAvatarUrlPath(selectedAvatarSrc);
      const avatarData = selectedRing !== "none" 
        ? `${avatarUrlPath}?ring=${selectedRing}` 
        : avatarUrlPath;

      if (editingProfile) {
        await updateProfile(editingProfile.id, {
          name: name.trim(),
          is_kids: isKids,
          avatar_url: avatarData,
        });
        toast.success("Profile updated");
      } else {
        await createProfile(name.trim(), isKids, avatarData);
        toast.success("Profile created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
    }
  };

  const handleDelete = async (profile: UserProfile) => {
    if (profiles.length === 1) {
      toast.error("You must have at least one profile");
      return;
    }
    
    try {
      await deleteProfile(profile.id);
      toast.success("Profile deleted");
    } catch (error) {
      toast.error("Failed to delete profile");
    }
  };

  const openEdit = (profile: UserProfile) => {
    setEditingProfile(profile);
    setName(profile.name);
    setIsKids(profile.is_kids);
    
    // Parse avatar URL and ring, resolve to display src
    const avatarUrl = profile.avatar_url || "";
    const [baseSrc, params] = avatarUrl.split("?");
    const displaySrc = resolveAvatarSrc(baseSrc);
    
    // Find matching avatar in our list or use the resolved src
    const avatars = getAvatarsForProfile(profile.is_kids);
    const matchingAvatar = avatars.find(a => a.src === displaySrc || a.urlPath === baseSrc);
    setSelectedAvatarSrc(matchingAvatar ? matchingAvatar.src : displaySrc || avatars[0].src);
    
    if (params) {
      const ringMatch = params.match(/ring=([^&]+)/);
      setSelectedRing(ringMatch ? ringMatch[1] : "none");
    } else {
      setSelectedRing("none");
    }
    
    setDialogOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProfile(null);
    setName("");
    setIsKids(false);
    // Use ES6 import src for display, not URL path
    const avatars = getAvatarsForProfile(false);
    const randomIndex = Math.floor(Math.random() * avatars.length);
    setSelectedAvatarSrc(avatars[randomIndex].src);
    setSelectedRing(getRandomRing());
  };

  // Parse avatar data for display
  const parseAvatarData = (avatarUrl: string | null) => {
    if (!avatarUrl) return { src: "", ring: "none" };
    const [baseSrc, params] = avatarUrl.split("?");
    let ring = "none";
    if (params) {
      const ringMatch = params.match(/ring=([^&]+)/);
      ring = ringMatch ? ringMatch[1] : "none";
    }
    // Resolve URL path to displayable src
    return { src: resolveAvatarSrc(baseSrc), ring };
  };

  // Get avatar for display
  const getAvatarDisplay = (profile: UserProfile) => {
    const { src, ring } = parseAvatarData(profile.avatar_url);
    const ringData = getRingById(ring);
    
    if (isPresetAvatar(src) || (src && (src.startsWith('http') || src.startsWith('/')))) {
      return (
        <div className="relative w-full h-full">
          {ringData.gradient && (
            <div 
              className="absolute inset-0 rounded-lg"
              style={{ 
                background: ringData.gradient,
                padding: "4px",
              }}
            >
              <div className="w-full h-full bg-background rounded-lg overflow-hidden">
                <img 
                  src={src} 
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
          {!ringData.gradient && (
            <img 
              src={src} 
              alt={profile.name}
              className={cn(
                "w-full h-full object-cover rounded-lg",
                ringData.className
              )}
            />
          )}
        </div>
      );
    }
    
    // Fallback
    return (
      <div className={cn(
        "w-full h-full rounded-lg flex items-center justify-center text-4xl md:text-5xl font-bold text-white bg-brand",
        ringData.className
      )}>
        {profile.is_kids ? (
          <Baby className="w-12 h-12 md:w-16 md:h-16" />
        ) : (
          profile.name.charAt(0).toUpperCase()
        )}
      </div>
    );
  };

  // Get current avatars based on isKids toggle
  const currentAvatars = getAvatarsForProfile(isKids);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="animate-pulse text-brand text-2xl"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <ProfileBackgroundBanner variant="desktop">
      <motion.h1 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="font-display text-3xl md:text-4xl mb-2"
      >
        Who's watching?
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-muted-foreground mb-8"
      >
        Select your profile
      </motion.p>

      <div className="flex flex-wrap justify-center gap-4 sm:gap-6 max-w-3xl mb-8">
        <AnimatePresence mode="popLayout">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              layout
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ 
                opacity: transitioningProfile === profile.id ? 0 : 1, 
                scale: transitioningProfile === profile.id ? 1.2 : 1, 
                y: 0 
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                duration: 0.4, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 300,
                damping: 25
              }}
              className={cn(
                "relative group cursor-pointer",
                isManaging && "pointer-events-auto"
              )}
              onClick={() => handleProfileClick(profile)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className={cn(
                "w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-lg overflow-hidden shadow-lg transition-all duration-300",
                isManaging && "opacity-50"
              )}>
                {getAvatarDisplay(profile)}
              </div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={cn(
                  "text-center mt-2 font-medium text-sm sm:text-base",
                  profile.is_kids && "text-cyan-400"
                )}
              >
                {profile.name}
              </motion.p>
              
              {profile.is_kids && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-center block text-cyan-400"
                >
                  Kids
                </motion.span>
              )}

              <AnimatePresence>
                {isManaging && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center gap-2"
                  >
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(profile);
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {profiles.length > 1 && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(profile);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {profiles.length < 5 && !isManaging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: profiles.length * 0.1 }}
              whileHover={{ scale: 1.05, borderColor: "hsl(var(--brand))" }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:bg-brand/5 transition-colors"
              onClick={openCreate}
            >
              <Plus className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          variant={isManaging ? "default" : "outline"}
          onClick={() => setIsManaging(!isManaging)}
          className="gap-2"
        >
          {isManaging ? (
            <>
              <Check className="h-4 w-4" />
              Done
            </>
          ) : (
            <>
              <Edit2 className="h-4 w-4" />
              Manage Profiles
            </>
          )}
        </Button>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Edit Profile" : "Add Profile"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Selected Avatar Preview with Ring */}
            <motion.div 
              className="flex justify-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="relative">
                {getRingById(selectedRing).gradient ? (
                  <div 
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg"
                    style={{ 
                      background: getRingById(selectedRing).gradient,
                      padding: "4px",
                    }}
                  >
                    <div className="w-full h-full bg-background rounded-lg overflow-hidden">
                      <img 
                        src={selectedAvatarSrc} 
                        alt="Selected avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden shadow-lg",
                    getRingById(selectedRing).className
                  )}>
                    <img 
                      src={selectedAvatarSrc} 
                      alt="Selected avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Avatar Selection Grid */}
            <div>
              <Label className="text-sm text-muted-foreground mb-3 block">
                {isKids ? "Kids Avatars" : "Choose Avatar"}
              </Label>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {currentAvatars.map((avatar, i) => (
                  <motion.button
                    key={avatar.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden transition-all",
                      selectedAvatarSrc === avatar.src 
                        ? "ring-2 ring-offset-2 ring-brand scale-110" 
                        : "opacity-70 hover:opacity-100"
                    )}
                    onClick={() => setSelectedAvatarSrc(avatar.src)}
                  >
                    <img 
                      src={avatar.src} 
                      alt={avatar.name}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Ring/Frame Selection */}
            <div>
              <Label className="text-sm text-muted-foreground mb-3 block">Choose Frame</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVATAR_RINGS.map((ring) => (
                  <motion.button
                    key={ring.id}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "w-10 h-10 rounded-lg transition-all flex items-center justify-center",
                      selectedRing === ring.id 
                        ? "ring-2 ring-offset-2 ring-brand" 
                        : "opacity-70 hover:opacity-100"
                    )}
                    style={ring.gradient ? { background: ring.gradient } : undefined}
                    onClick={() => setSelectedRing(ring.id)}
                  >
                    {ring.id === "none" ? (
                      <span className="text-xs text-muted-foreground">None</span>
                    ) : !ring.gradient ? (
                      <div className={cn("w-8 h-8 rounded-lg bg-muted", ring.className)} />
                    ) : null}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter profile name"
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="kids">Kids Profile</Label>
                <p className="text-xs text-muted-foreground">
                  Show only kid-friendly content (G & PG ratings)
                </p>
              </div>
              <Switch
                id="kids"
                checked={isKids}
                onCheckedChange={(checked) => {
                  setIsKids(checked);
                  // Switch to appropriate avatar set
                  setSelectedAvatarSrc(getRandomAvatar(checked));
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate}>
              {editingProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProfileBackgroundBanner>
  );
};
