import { useState } from "react";
import { useUserRoles, useAddUserRole, useRemoveUserRole } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Trash2, Plus } from "lucide-react";

interface UserManagementProps {
  users: Array<{ id: string; display_name: string | null; }>;
}

export const UserManagement = ({ users }: UserManagementProps) => {
  const { data: roles = [] } = useUserRoles();
  const addRole = useAddUserRole();
  const removeRole = useRemoveUserRole();

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "moderator" | "user">("user");

  const handleAddRole = async () => {
    if (!selectedUser || !selectedRole) return;
    try {
      await addRole.mutateAsync({ userId: selectedUser, role: selectedRole });
      toast.success("Role added successfully");
      setSelectedUser("");
    } catch (error) {
      toast.error("Failed to add role");
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      await removeRole.mutateAsync({ userId, role });
      toast.success("Role removed");
    } catch (error) {
      toast.error("Failed to remove role");
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.display_name || "Unknown User";
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4">Add Role to User</h3>
          <div className="flex gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.display_name || "Unknown"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "moderator" | "user")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddRole} disabled={!selectedUser}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {roles.map((role) => (
          <Card key={role.id} className="bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">{getUserName(role.user_id)}</p>
                  <p className="text-sm text-muted-foreground capitalize">{role.role}</p>
                </div>
              </div>
              <Button variant="destructive" size="icon" onClick={() => handleRemoveRole(role.user_id, role.role)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};