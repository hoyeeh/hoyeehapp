import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Shield, 
  Crown, 
  UserX, 
  Trash2, 
  Settings,
  DollarSign,
  Users,
  AlertTriangle
} from "lucide-react";
import {
  useIsSuperAdmin,
  usePromoteToAdmin,
  usePromoteToSuperAdmin,
  useDemoteFromRole,
  useDeleteUser,
  useSystemSettings,
  useUpdateSubscriptionSettings,
} from "@/hooks/useSuperAdmin";
import { useAllUsers, useUserRoles } from "@/hooks/useAdmin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const SuperAdminDashboard = () => {
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { data: users = [] } = useAllUsers();
  const { data: userRoles = [] } = useUserRoles();
  const { data: settings = [] } = useSystemSettings();
  
  const promoteToAdmin = usePromoteToAdmin();
  const promoteToSuperAdmin = usePromoteToSuperAdmin();
  const demoteFromRole = useDemoteFromRole();
  const deleteUser = useDeleteUser();
  const updateSettings = useUpdateSubscriptionSettings();

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">Super Admin privileges required</p>
      </div>
    );
  }

  const getUserRoles = (userId: string) => {
    return userRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  };

  const handlePromote = async () => {
    if (!selectedUser || !selectedRole) return;
    
    try {
      if (selectedRole === "admin") {
        await promoteToAdmin.mutateAsync({ userId: selectedUser });
      } else if (selectedRole === "super_admin") {
        await promoteToSuperAdmin.mutateAsync({ userId: selectedUser });
      }
      toast.success(`User promoted to ${selectedRole}`);
      setSelectedUser("");
      setSelectedRole("");
    } catch (error) {
      toast.error("Failed to promote user");
    }
  };

  const handleDemote = async (userId: string, role: "admin" | "moderator" | "user" | "super_admin") => {
    try {
      await demoteFromRole.mutateAsync({ userId, role });
      toast.success("Role removed");
    } catch (error) {
      toast.error("Failed to remove role");
    }
  };

  const handleDeleteUser = async (userId: string, displayName: string) => {
    try {
      await deleteUser.mutateAsync({ userId });
      toast.success(`User "${displayName}" deleted`);
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleUpdatePrice = async (settingId: string) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      toast.error("Invalid price");
      return;
    }

    try {
      await updateSettings.mutateAsync({ id: settingId, base_price: price });
      toast.success("Price updated");
      setEditingPrice(null);
      setNewPrice("");
    } catch (error) {
      toast.error("Failed to update price");
    }
  };

  const admins = users.filter((u) => getUserRoles(u.id).includes("admin"));
  const superAdmins = users.filter((u) => getUserRoles(u.id).includes("super_admin" as any));

  return (
    <div className="space-y-6">
      {/* Super Admin Header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg border border-amber-500/30">
        <Crown className="h-8 w-8 text-amber-500" />
        <div>
          <h2 className="text-xl font-bold">Super Admin Control Panel</h2>
          <p className="text-sm text-muted-foreground">Full platform management access</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Role Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Management
            </CardTitle>
            <CardDescription>Promote or demote user roles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handlePromote} disabled={!selectedUser || !selectedRole}>
                Promote
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Current Admins</h4>
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-2 bg-secondary rounded">
                  <div className="flex items-center gap-2">
                    <span>{admin.display_name}</span>
                    <Badge variant="outline">Admin</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDemote(admin.id, "admin")}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {admins.length === 0 && (
                <p className="text-sm text-muted-foreground">No admins</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Super Admins</h4>
              {superAdmins.map((sa) => (
                <div key={sa.id} className="flex items-center justify-between p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span>{sa.display_name}</span>
                    <Badge className="bg-amber-500">Super Admin</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Subscription Settings
            </CardTitle>
            <CardDescription>Configure pricing and plans</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.map((setting) => (
              <div key={setting.id} className="p-3 bg-secondary rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{setting.plan_type} Plan</span>
                  <Badge variant={setting.is_active ? "default" : "secondary"}>
                    {setting.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {editingPrice === setting.id ? (
                    <>
                      <Input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-32"
                        placeholder="New price"
                      />
                      <Button size="sm" onClick={() => handleUpdatePrice(setting.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPrice(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">
                        {setting.currency} {setting.base_price}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPrice(setting.id);
                          setNewPrice(setting.base_price.toString());
                        }}
                      >
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* User Deletion - Danger Zone */}
        <Card className="md:col-span-2 border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Destructive actions - use with caution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h4 className="font-medium">Delete Users</h4>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-secondary rounded">
                    <div>
                      <span className="font-medium">{user.display_name || "Unknown"}</span>
                      {user.mobile_number_masked && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({user.mobile_number_masked})
                        </span>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{user.display_name}"? This action cannot be undone and will remove all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => handleDeleteUser(user.id, user.display_name || "Unknown")}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
