import { useState } from "react";
import { useProfileContext, UserProfile } from "@/contexts/ProfileContext";
import { Plus, Edit2, Trash2, Check, Baby, User } from "lucide-react";
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

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-cyan-500",
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
  const [selectedColor, setSelectedColor] = useState(0);

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
          avatar_url: AVATAR_COLORS[selectedColor],
        });
        toast.success("Profile updated");
      } else {
        await createProfile(name.trim(), isKids, AVATAR_COLORS[selectedColor]);
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
    setSelectedColor(AVATAR_COLORS.indexOf(profile.avatar_url || "") || 0);
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
    setSelectedColor(Math.floor(Math.random() * AVATAR_COLORS.length));
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
            <div
              className={cn(
                "w-24 h-24 md:w-32 md:h-32 rounded-lg flex items-center justify-center text-4xl md:text-5xl font-bold text-white shadow-lg",
                profile.avatar_url || "bg-brand",
                isManaging && "opacity-50"
              )}
            >
              {profile.is_kids ? (
                <Baby className="w-12 h-12 md:w-16 md:h-16" />
              ) : (
                profile.name.charAt(0).toUpperCase()
              )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? "Edit Profile" : "Add Profile"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              <div
                className={cn(
                  "w-24 h-24 rounded-lg flex items-center justify-center text-4xl font-bold text-white",
                  AVATAR_COLORS[selectedColor]
                )}
              >
                {isKids ? (
                  <Baby className="w-12 h-12" />
                ) : (
                  name.charAt(0).toUpperCase() || <User className="w-12 h-12" />
                )}
              </div>
            </div>

            <div className="flex justify-center gap-2">
              {AVATAR_COLORS.map((color, i) => (
                <button
                  key={color}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    color,
                    selectedColor === i && "ring-2 ring-offset-2 ring-foreground scale-110"
                  )}
                  onClick={() => setSelectedColor(i)}
                />
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
