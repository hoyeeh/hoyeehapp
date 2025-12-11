import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Gift, Calendar, Clock, User } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";

export const AdminSubscriptionCredits = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState("");
  const [creditType, setCreditType] = useState<"days" | "weeks" | "months">("days");
  const [creditAmount, setCreditAmount] = useState("");
  const [reason, setReason] = useState("");

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, is_subscribed, subscription_expiry")
        .order("display_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent credits
  const { data: recentCredits } = useQuery({
    queryKey: ["recent-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_credits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Grant credit mutation
  const grantCredit = useMutation({
    mutationFn: async () => {
      if (!selectedUser || !creditAmount || !user?.id) {
        throw new Error("Missing required fields");
      }

      const amount = parseInt(creditAmount);
      let creditDays = amount;
      
      if (creditType === "weeks") {
        creditDays = amount * 7;
      } else if (creditType === "months") {
        creditDays = amount * 30;
      }

      // Get current user's subscription expiry
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("subscription_expiry, is_subscribed")
        .eq("id", selectedUser)
        .single();

      if (profileError) throw profileError;

      // Calculate new expiry date
      const currentExpiry = profile?.subscription_expiry 
        ? new Date(profile.subscription_expiry) 
        : new Date();
      
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      let newExpiry: Date;

      if (creditType === "days") {
        newExpiry = addDays(baseDate, amount);
      } else if (creditType === "weeks") {
        newExpiry = addWeeks(baseDate, amount);
      } else {
        newExpiry = addMonths(baseDate, amount);
      }

      // Insert credit record
      const { error: creditError } = await supabase
        .from("subscription_credits")
        .insert({
          user_id: selectedUser,
          credit_days: creditDays,
          reason: reason || null,
          granted_by: user.id,
        });

      if (creditError) throw creditError;

      // Update user's subscription
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          is_subscribed: true,
          subscription_expiry: newExpiry.toISOString(),
        })
        .eq("id", selectedUser);

      if (updateError) throw updateError;

      return { creditDays, newExpiry };
    },
    onSuccess: (data) => {
      toast.success(`Granted ${data.creditDays} days. New expiry: ${format(data.newExpiry, "PPP")}`);
      queryClient.invalidateQueries({ queryKey: ["all-users-credits"] });
      queryClient.invalidateQueries({ queryKey: ["recent-credits"] });
      setSelectedUser("");
      setCreditAmount("");
      setReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to grant credit");
    },
  });

  const selectedUserData = users?.find(u => u.id === selectedUser);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-brand" />
            Grant Subscription Credit
          </CardTitle>
          <CardDescription>
            Add free subscription time to user accounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{u.display_name || "Unknown User"}</span>
                      {u.is_subscribed && (
                        <span className="text-xs text-green-500">(Active)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUserData && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p>
                <strong>Current Status:</strong>{" "}
                {selectedUserData.is_subscribed ? "Subscribed" : "Not Subscribed"}
              </p>
              {selectedUserData.subscription_expiry && (
                <p>
                  <strong>Expires:</strong>{" "}
                  {format(new Date(selectedUserData.subscription_expiry), "PPP")}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credit Type</Label>
              <Select value={creditType} onValueChange={(v) => setCreditType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder={`Number of ${creditType}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer support resolution, promotional offer..."
              rows={2}
            />
          </div>

          <Button
            onClick={() => grantCredit.mutate()}
            disabled={!selectedUser || !creditAmount || grantCredit.isPending}
            className="w-full"
          >
            {grantCredit.isPending ? "Granting..." : "Grant Credit"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCredits && recentCredits.length > 0 ? (
            <div className="space-y-2">
              {recentCredits.map((credit) => {
                const creditUser = users?.find(u => u.id === credit.user_id);
                return (
                  <div
                    key={credit.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {creditUser?.display_name || "Unknown User"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {credit.reason || "No reason provided"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-brand">+{credit.credit_days} days</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(credit.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No credits granted yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
