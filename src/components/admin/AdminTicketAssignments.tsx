import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserCog, Plus, Trash2, Film, Tv, HelpCircle } from "lucide-react";

interface Assignment {
  id: string;
  admin_id: string;
  ticket_type: string;
  is_active: boolean;
  created_at: string;
}

interface Admin {
  id: string;
  display_name: string | null;
}

export const AdminTicketAssignments = () => {
  const queryClient = useQueryClient();
  const [selectedAdmin, setSelectedAdmin] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("general");

  // Fetch admin users
  const { data: admins } = useQuery({
    queryKey: ["admin-users-for-assignment"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin"]);
      
      if (rolesError) throw rolesError;

      const adminIds = roles?.map(r => r.user_id) || [];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", adminIds);
      
      if (profilesError) throw profilesError;
      return profiles as Admin[];
    },
  });

  // Fetch current assignments
  const { data: assignments } = useQuery({
    queryKey: ["ticket-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_ticket_assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Assignment[];
    },
  });

  // Add assignment
  const addAssignment = useMutation({
    mutationFn: async () => {
      if (!selectedAdmin || !selectedType) {
        throw new Error("Please select admin and ticket type");
      }

      const { error } = await supabase
        .from("admin_ticket_assignments")
        .insert({
          admin_id: selectedAdmin,
          ticket_type: selectedType,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment added");
      setSelectedAdmin("");
      queryClient.invalidateQueries({ queryKey: ["ticket-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add assignment");
    },
  });

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("admin_ticket_assignments")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update");
    },
  });

  // Delete assignment
  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_ticket_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment removed");
      queryClient.invalidateQueries({ queryKey: ["ticket-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove");
    },
  });

  const getAdminName = (adminId: string) => {
    return admins?.find(a => a.id === adminId)?.display_name || "Unknown";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "movie_request":
        return <Film className="h-4 w-4 text-blue-500" />;
      case "show_request":
        return <Tv className="h-4 w-4 text-purple-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "movie_request":
        return "Movie Requests";
      case "show_request":
        return "Show Requests";
      default:
        return "General Support";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-brand" />
          Ticket Auto-Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new assignment */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Admin</label>
            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
              <SelectTrigger>
                <SelectValue placeholder="Select admin" />
              </SelectTrigger>
              <SelectContent>
                {admins?.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.display_name || "Unnamed Admin"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-muted-foreground mb-1 block">Ticket Type</label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Support</SelectItem>
                <SelectItem value="movie_request">Movie Requests</SelectItem>
                <SelectItem value="show_request">Show Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => addAssignment.mutate()}
            disabled={!selectedAdmin || addAssignment.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>

        {/* Current assignments */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Active Assignments</h4>
          {assignments?.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No assignments configured. New tickets will be unassigned.
            </p>
          )}
          {assignments?.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getTypeIcon(assignment.ticket_type)}
                <div>
                  <p className="font-medium">{getAdminName(assignment.admin_id)}</p>
                  <p className="text-sm text-muted-foreground">
                    {getTypeLabel(assignment.ticket_type)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={assignment.is_active}
                    onCheckedChange={(checked) =>
                      toggleActive.mutate({ id: assignment.id, isActive: checked })
                    }
                  />
                  <Badge variant={assignment.is_active ? "default" : "secondary"}>
                    {assignment.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAssignment.mutate(assignment.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Tickets are automatically assigned to active admins based on type. If multiple admins are assigned to the same type, one is randomly selected.
        </p>
      </CardContent>
    </Card>
  );
};
