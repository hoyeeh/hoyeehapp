import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings, Edit, DollarSign, Percent, Loader2 } from "lucide-react";

interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  amount: number;
  currency: string;
  status: string;
  discount_percent: number;
  discount_reason: string | null;
  admin_notes: string | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string | null;
}

interface SubscriptionSettings {
  id: string;
  plan_type: string;
  base_price: number;
  currency: string;
  description: string | null;
  is_active: boolean;
}

interface User {
  id: string;
  display_name: string | null;
}

interface SubscriptionManagementProps {
  users: User[];
  subscriptions: Subscription[];
}

export const SubscriptionManagement = ({ users, subscriptions }: SubscriptionManagementProps) => {
  const queryClient = useQueryClient();
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [planActive, setPlanActive] = useState(true);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

  // Fetch subscription settings (all plans)
  const { data: settingsList = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["subscription-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_settings")
        .select("*")
        .order("plan_type", { ascending: true });
      
      if (error) throw error;
      return data as SubscriptionSettings[];
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async ({ id, base_price, description, is_active }: { 
      id: string; 
      base_price: number; 
      description: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from("subscription_settings")
        .update({ base_price, description, is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-settings"] });
      toast.success("Pricing updated successfully");
      setEditingSettings(false);
      setEditingPlanId(null);
    },
    onError: () => {
      toast.error("Failed to update pricing");
    },
  });

  // Update subscription mutation
  const updateSubscription = useMutation({
    mutationFn: async (data: {
      id: string;
      discount_percent?: number;
      discount_reason?: string;
      admin_notes?: string;
      status?: string;
    }) => {
      const { id, ...updates } = data;
      const { error } = await supabase
        .from("subscriptions")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      toast.success("Subscription updated successfully");
      setEditingSub(null);
    },
    onError: () => {
      toast.error("Failed to update subscription");
    },
  });

  const handleSaveSettings = () => {
    if (!editingPlanId) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    updateSettings.mutate({ 
      id: editingPlanId, 
      base_price: price, 
      description: newDescription,
      is_active: planActive,
    });
  };

  const handleOpenEditSettings = (plan: SubscriptionSettings) => {
    setEditingPlanId(plan.id);
    setNewPrice(plan.base_price.toString());
    setNewDescription(plan.description || "");
    setPlanActive(plan.is_active);
    setEditingSettings(true);
  };

  const handleOpenEditSub = (sub: Subscription) => {
    setEditingSub(sub);
    setDiscountPercent((sub.discount_percent || 0).toString());
    setDiscountReason(sub.discount_reason || "");
    setAdminNotes(sub.admin_notes || "");
    setNewStatus(sub.status);
  };

  const handleSaveSubscription = () => {
    if (!editingSub) return;
    
    const discount = parseFloat(discountPercent);
    if (isNaN(discount) || discount < 0 || discount > 100) {
      toast.error("Discount must be between 0 and 100");
      return;
    }

    updateSubscription.mutate({
      id: editingSub.id,
      discount_percent: discount,
      discount_reason: discountReason || null,
      admin_notes: adminNotes || null,
      status: newStatus,
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.display_name || "Unknown User";
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pricing Settings */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Subscription Plans
          </CardTitle>
          <CardDescription>Configure subscription pricing for all plans</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsList.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-brand">
                    {plan.base_price?.toLocaleString()} {plan.currency}
                  </p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    plan.plan_type === 'yearly' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {plan.plan_type.toUpperCase()}
                    {plan.plan_type === 'yearly' && ' - RECOMMENDED'}
                  </span>
                  {!plan.is_active && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-500">
                      INACTIVE
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground capitalize">{plan.plan_type} subscription</p>
                {plan.description && (
                  <p className="text-sm mt-1">{plan.description}</p>
                )}
              </div>
              <Button variant="outline" onClick={() => handleOpenEditSettings(plan)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          ))}
          
          <Dialog open={editingSettings} onOpenChange={(open) => {
            setEditingSettings(open);
            if (!open) setEditingPlanId(null);
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Subscription Plan</DialogTitle>
                <DialogDescription>Set the pricing and description for this plan</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (XAF)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="pl-10"
                      placeholder="2000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Subscription description..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Plan Active</Label>
                  <input
                    id="active"
                    type="checkbox"
                    checked={planActive}
                    onChange={(e) => setPlanActive(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>
                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettings.isPending}
                  className="w-full bg-brand hover:bg-brand/90"
                >
                  {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Active Subscriptions */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">User Subscriptions ({subscriptions.length})</h3>
        {subscriptions.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              No subscriptions yet
            </CardContent>
          </Card>
        ) : (
          subscriptions.map((sub) => (
            <Card key={sub.id} className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-medium">{getUserName(sub.user_id)}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        sub.status === 'active' ? 'bg-green-500/20 text-green-500' :
                        sub.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {sub.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Amount: {sub.amount.toLocaleString()} {sub.currency}
                        {sub.discount_percent > 0 && (
                          <span className="ml-2 text-green-500">
                            ({sub.discount_percent}% discount)
                          </span>
                        )}
                      </p>
                      {sub.expires_at && (
                        <p>Expires: {new Date(sub.expires_at).toLocaleDateString()}</p>
                      )}
                      {sub.discount_reason && (
                        <p className="text-xs">Reason: {sub.discount_reason}</p>
                      )}
                      {sub.admin_notes && (
                        <p className="text-xs italic">Note: {sub.admin_notes}</p>
                      )}
                    </div>
                  </div>
                  <Dialog open={editingSub?.id === sub.id} onOpenChange={(open) => !open && setEditingSub(null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditSub(sub)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Subscription</DialogTitle>
                        <DialogDescription>
                          Manage subscription for {getUserName(sub.user_id)}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="discount">Discount (%)</Label>
                          <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="discount"
                              type="number"
                              value={discountPercent}
                              onChange={(e) => setDiscountPercent(e.target.value)}
                              className="pl-10"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="discountReason">Discount Reason</Label>
                          <Input
                            id="discountReason"
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            placeholder="e.g., Customer loyalty, Issue resolution..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Admin Notes</Label>
                          <Textarea
                            id="notes"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Internal notes about this subscription..."
                          />
                        </div>
                        <Button
                          onClick={handleSaveSubscription}
                          disabled={updateSubscription.isPending}
                          className="w-full bg-brand hover:bg-brand/90"
                        >
                          {updateSubscription.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
