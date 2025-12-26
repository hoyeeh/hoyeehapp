import { useState, useRef } from "react";
import { ArrowLeft, Plus, Edit2, Trash2, Check, User, Baby, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfileContext, UserProfile } from "@/contexts/ProfileContext";
import { useProfile } from "@/hooks/useDatabase";
import { useHaptics } from "@/hooks/useHaptics";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AVATARS, getRandomAvatar } from "@/lib/avatars";

interface MobileManageProfilesProps {
  onClose: () => void;
}

export function MobileManageProfiles({ onClose }: MobileManageProfilesProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, currentProfile, setCurrentProfile, createProfile, updateProfile, deleteProfile } = useProfileContext();
  const { data: userProfile } = useProfile();
  const { lightTap, successFeedback, selectionTap, mediumTap } = useHaptics();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<UserProfile | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [isKids, setIsKids] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(getRandomAvatar());
  const [isSaving, setIsSaving] = useState(false);

  const handleBack = () => {
    lightTap();
    if (editingProfile || isCreating) {
      setEditingProfile(null);
      setIsCreating(false);
      resetForm();
    } else {
      onClose();
    }
  };

  const resetForm = () => {
    setName("");
    setIsKids(false);
    setSelectedAvatar(getRandomAvatar());
  };

  const handleCreateNew = () => {
    if (profiles.length >= 5) {
      toast.error("Maximum 5 profiles allowed");
      return;
    }
    lightTap();
    // Auto-populate name from user's profile if this is the first profile
    if (profiles.length === 0 && userProfile?.display_name) {
      setName(userProfile.display_name);
    } else {
      setName("");
    }
    setIsKids(false);
    setSelectedAvatar(getRandomAvatar());
    setIsCreating(true);
  };

  const handleEditProfile = (profile: UserProfile) => {
    lightTap();
    setEditingProfile(profile);
    setName(profile.name);
    setIsKids(profile.is_kids);
    setSelectedAvatar(profile.avatar_url || getRandomAvatar());
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    setIsSaving(true);
    lightTap();

    try {
      if (isCreating) {
        await createProfile(name.trim(), isKids, selectedAvatar);
        successFeedback();
        toast.success("Profile created!");
      } else if (editingProfile) {
        await updateProfile(editingProfile.id, {
          name: name.trim(),
          is_kids: isKids,
          avatar_url: selectedAvatar,
        });
        successFeedback();
        toast.success("Profile updated!");
      }
      setEditingProfile(null);
      setIsCreating(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;
    
    mediumTap();
    try {
      await deleteProfile(profileToDelete.id);
      toast.success("Profile deleted");
      setProfileToDelete(null);
    } catch (error) {
      toast.error("Failed to delete profile");
    }
  };

  const handleSwitchProfile = (profile: UserProfile) => {
    selectionTap();
    setCurrentProfile(profile);
    successFeedback();
    toast.success(`Switched to ${profile.name}`);
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/profile-${Date.now()}.${fileExt}`;

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

  // Edit/Create form view
  if (editingProfile || isCreating) {
    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
          <div className="flex items-center justify-between px-4 h-14 pt-safe">
            <button onClick={handleBack} className="text-muted-foreground">
              Cancel
            </button>
            <h1 className="text-lg font-semibold">
              {isCreating ? "New Profile" : "Edit Profile"}
            </h1>
            <button onClick={handleSave} disabled={isSaving} className="text-primary font-medium">
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </header>

        <main className="pt-20 pb-8 px-4">
          {/* Avatar Selection */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-primary/20 mb-4">
                <AvatarImage src={selectedAvatar} className="object-cover" />
                <AvatarFallback>
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <Camera className="w-4 h-4 text-primary-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
            <p className="text-xs text-muted-foreground">Tap camera to upload custom image</p>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-8">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.name}
                onClick={() => {
                  selectionTap();
                  setSelectedAvatar(avatar.src);
                }}
                className={cn(
                  "relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-muted/30 active:scale-95 transition-all mx-auto",
                  selectedAvatar === avatar.src && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                {selectedAvatar === avatar.src && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Name Input */}
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium text-muted-foreground">Profile Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              className="h-12 rounded-xl bg-muted/30 border-border/30"
            />
          </div>

          {/* Kids Profile Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                <Baby className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="font-medium">Kids Profile</p>
                <p className="text-xs text-muted-foreground">Only show G and PG content</p>
              </div>
            </div>
            <Switch checked={isKids} onCheckedChange={setIsKids} />
          </div>

          {/* Delete Button */}
          {editingProfile && profiles.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => setProfileToDelete(editingProfile)}
              className="w-full mt-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Profile
            </Button>
          )}
        </main>
      </motion.div>
    );
  }

  // Profile list view
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/10">
        <div className="flex items-center justify-between px-4 h-14 pt-safe">
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Manage Profiles</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="pt-20 pb-8 px-4">
        <p className="text-sm text-muted-foreground mb-6">
          Tap a profile to switch, or tap edit to modify.
        </p>

        <div className="space-y-3">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center justify-between p-4 rounded-2xl bg-muted/20 active:bg-muted/40 transition-colors",
                currentProfile?.id === profile.id && "ring-2 ring-primary"
              )}
            >
              <button
                onClick={() => handleSwitchProfile(profile)}
                className="flex items-center gap-4 flex-1"
              >
                <Avatar className="w-14 h-14 sm:w-16 sm:h-16">
                  <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="bg-muted">
                    {profile.is_kids ? (
                      <Baby className="w-6 h-6 text-pink-500" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="font-medium">{profile.name}</p>
                  {profile.is_kids && (
                    <span className="text-xs text-pink-500 font-medium">Kids</span>
                  )}
                  {currentProfile?.id === profile.id && (
                    <span className="text-xs text-primary font-medium ml-2">Active</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => handleEditProfile(profile)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50"
              >
                <Edit2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Add Profile Button */}
        {profiles.length < 5 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: profiles.length * 0.05 }}
            onClick={handleCreateNew}
            className="w-full flex items-center justify-center gap-3 p-4 mt-4 border-2 border-dashed border-border/50 rounded-2xl text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add Profile</span>
          </motion.button>
        )}

        <p className="text-xs text-muted-foreground text-center mt-6">
          {profiles.length}/5 profiles
        </p>
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!profileToDelete} onOpenChange={() => setProfileToDelete(null)}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{profileToDelete?.name}" and all its viewing history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
