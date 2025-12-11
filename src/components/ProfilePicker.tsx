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
import { Logo } from "./Logo";

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

const PROFILE_AVATARS = [
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
  const [selectedAvatar, setSelectedAvatar] = useState(0);

  const handleCreateOrUpdate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    try {
      if (editingProfile) {
        await updateProfile(editingProfile.id, {
          name: name.trim(),
          is_kids: isKids,
          avatar_url: PROFILE_AVATARS[selectedAvatar].src,
        });
        toast.success("Profile updated");
      } else {
        await createProfile(name.trim(), isKids, PROFILE_AVATARS[selectedAvatar].src);
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
    // Find matching avatar or default to first
    const avatarIndex = PROFILE_AVATARS.findIndex(a => a.src === profile.avatar_url);
    setSelectedAvatar(avatarIndex >= 0 ? avatarIndex : 0);
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
    setSelectedAvatar(Math.floor(Math.random() * PROFILE_AVATARS.length));
  };

  // Get avatar for display - check if it's an old color class or new image URL
  const getAvatarDisplay = (profile: UserProfile) => {
    const avatarUrl = profile.avatar_url;
    
    // Check if it's one of the new avatar images
    const matchingAvatar = PROFILE_AVATARS.find(a => a.src === avatarUrl);
    if (matchingAvatar) {
      return (
        <img 
          src={matchingAvatar.src} 
          alt={profile.name}
          className="w-full h-full object-cover rounded-lg"
        />
      );
    }
    
    // Fallback for old color-based avatars or no avatar
    return (
      <div className={cn(
        "w-full h-full rounded-lg flex items-center justify-center text-4xl md:text-5xl font-bold text-white",
        avatarUrl?.startsWith("bg-") ? avatarUrl : "bg-brand"
      )}>
        {profile.is_kids ? (
          <Baby className="w-12 h-12 md:w-16 md:h-16" />
        ) : (
          profile.name.charAt(0).toUpperCase()
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-brand text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <Logo className="mb-8" />
      
      <h1 className="font-display text-3xl md:text-4xl mb-2">Who's watching?</h1>
      <p className="text-muted-foreground mb-8">Select your profile</p>

      <div className="flex flex-wrap justify-center gap-6 max-w-3xl mb-8">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={cn(
              "relative group cursor-pointer transition-transform hover:scale-105",
              isManaging && "pointer-events-auto"
            )}
            onClick={() => !isManaging && onProfileSelected(profile)}
          >
            <div className={cn(
              "w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden shadow-lg",
              isManaging && "opacity-50"
            )}>
              {getAvatarDisplay(profile)}
            </div>
            
            <p className={cn(
              "text-center mt-2 font-medium",
              profile.is_kids && "text-cyan-400"
            )}>
              {profile.name}
            </p>
            
            {profile.is_kids && (
              <span className="text-xs text-center block text-cyan-400">Kids</span>
            )}

            {isManaging && (
              <div className="absolute inset-0 flex items-center justify-center gap-2">
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
              </div>
            )}
          </div>
        ))}

        {profiles.length < 5 && !isManaging && (
          <div
            className="w-24 h-24 md:w-32 md:h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
            onClick={openCreate}
          >
            <Plus className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
      </div>

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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Edit Profile" : "Add Profile"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Selected Avatar Preview */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-lg overflow-hidden shadow-lg">
                <img 
                  src={PROFILE_AVATARS[selectedAvatar].src} 
                  alt="Selected avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Avatar Selection Grid */}
            <div className="grid grid-cols-5 gap-3 justify-items-center">
              {PROFILE_AVATARS.map((avatar, i) => (
                <button
                  key={avatar.name}
                  className={cn(
                    "w-12 h-12 rounded-lg overflow-hidden transition-all",
                    selectedAvatar === i 
                      ? "ring-2 ring-offset-2 ring-brand scale-110" 
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  )}
                  onClick={() => setSelectedAvatar(i)}
                >
                  <img 
                    src={avatar.src} 
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
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
                onCheckedChange={setIsKids}
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
    </div>
  );
};
