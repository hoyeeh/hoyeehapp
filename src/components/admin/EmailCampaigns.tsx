import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Plus, Send, Calendar, Mail, Users, Trash2, Play, Pause, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  template_type: string;
  html_content: string | null;
  status: string;
  campaign_type: string;
  scheduled_at: string | null;
  sent_at: string | null;
  target_audience: string;
  filters: Record<string, unknown>;
  created_at: string;
}

interface DripSequence {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  is_active: boolean;
  created_at: string;
}

interface DripStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  template_type: string;
  html_content: string | null;
}

export const EmailCampaigns = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showSequenceDialog, setShowSequenceDialog] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<DripSequence | null>(null);
  const [showStepDialog, setShowStepDialog] = useState(false);

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    subject: '',
    template_type: 'custom',
    html_content: '',
    campaign_type: 'one-time',
    scheduled_at: '',
    target_audience: 'all'
  });

  // Sequence form state
  const [sequenceForm, setSequenceForm] = useState({
    name: '',
    description: '',
    trigger_event: 'signup'
  });

  // Step form state
  const [stepForm, setStepForm] = useState({
    delay_days: 0,
    delay_hours: 0,
    subject: '',
    template_type: 'custom',
    html_content: ''
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    }
  });

  // Fetch drip sequences
  const { data: sequences = [], isLoading: sequencesLoading } = useQuery({
    queryKey: ['drip-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drip_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DripSequence[];
    }
  });

  // Fetch steps for selected sequence
  const { data: steps = [] } = useQuery({
    queryKey: ['drip-steps', selectedSequence?.id],
    queryFn: async () => {
      if (!selectedSequence) return [];
      const { data, error } = await supabase
        .from('drip_sequence_steps')
        .select('*')
        .eq('sequence_id', selectedSequence.id)
        .order('step_order', { ascending: true });
      if (error) throw error;
      return data as DripStep[];
    },
    enabled: !!selectedSequence
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('email_campaigns').insert({
        ...campaignForm,
        scheduled_at: campaignForm.scheduled_at || null,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      setShowCampaignDialog(false);
      setCampaignForm({
        name: '',
        subject: '',
        template_type: 'custom',
        html_content: '',
        campaign_type: 'one-time',
        scheduled_at: '',
        target_audience: 'all'
      });
      toast({ title: 'Campaign created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating campaign', description: error.message, variant: 'destructive' });
    }
  });

  // Send campaign mutation
  const sendCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.functions.invoke('process-email-campaign', {
        body: { campaignId }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign queued for sending' });
    },
    onError: (error) => {
      toast({ title: 'Error sending campaign', description: error.message, variant: 'destructive' });
    }
  });

  // Delete campaign mutation
  const deleteCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.from('email_campaigns').delete().eq('id', campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign deleted' });
    }
  });

  // Create sequence mutation
  const createSequence = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('drip_sequences').insert({
        ...sequenceForm,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-sequences'] });
      setShowSequenceDialog(false);
      setSequenceForm({ name: '', description: '', trigger_event: 'signup' });
      toast({ title: 'Sequence created successfully' });
    }
  });

  // Toggle sequence active mutation
  const toggleSequence = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('drip_sequences')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-sequences'] });
      toast({ title: 'Sequence updated' });
    }
  });

  // Create step mutation
  const createStep = useMutation({
    mutationFn: async () => {
      if (!selectedSequence) return;
      const nextOrder = steps.length + 1;
      const { error } = await supabase.from('drip_sequence_steps').insert({
        ...stepForm,
        sequence_id: selectedSequence.id,
        step_order: nextOrder
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-steps'] });
      setShowStepDialog(false);
      setStepForm({ delay_days: 0, delay_hours: 0, subject: '', template_type: 'custom', html_content: '' });
      toast({ title: 'Step added' });
    }
  });

  // Delete step mutation
  const deleteStep = useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('drip_sequence_steps').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-steps'] });
      toast({ title: 'Step deleted' });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/20 text-green-400';
      case 'scheduled': return 'bg-blue-500/20 text-blue-400';
      case 'sending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="sequences" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Drip Sequences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Email Campaigns</h3>
            <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Email Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campaign Name</Label>
                      <Input
                        value={campaignForm.name}
                        onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                        placeholder="Welcome Campaign"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Audience</Label>
                      <Select
                        value={campaignForm.target_audience}
                        onValueChange={(v) => setCampaignForm({ ...campaignForm, target_audience: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="subscribed">Subscribed Users</SelectItem>
                          <SelectItem value="unsubscribed">Unsubscribed Users</SelectItem>
                          <SelectItem value="new">New Users (7 days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email Subject</Label>
                    <Input
                      value={campaignForm.subject}
                      onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                      placeholder="Welcome to Hoyeeh!"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campaign Type</Label>
                      <Select
                        value={campaignForm.campaign_type}
                        onValueChange={(v) => setCampaignForm({ ...campaignForm, campaign_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one-time">One-Time</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {campaignForm.campaign_type === 'scheduled' && (
                      <div className="space-y-2">
                        <Label>Schedule For</Label>
                        <Input
                          type="datetime-local"
                          value={campaignForm.scheduled_at}
                          onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Email Content (HTML)</Label>
                    <Textarea
                      value={campaignForm.html_content}
                      onChange={(e) => setCampaignForm({ ...campaignForm, html_content: e.target.value })}
                      placeholder="<h1>Welcome!</h1><p>Thank you for joining...</p>"
                      rows={8}
                    />
                  </div>
                  <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending} className="w-full">
                    Create Campaign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {campaignsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No campaigns yet. Create your first email campaign.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{campaign.name}</h4>
                          <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {campaign.target_audience}
                          </span>
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(campaign.scheduled_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {campaign.status === 'draft' && (
                          <Button
                            size="sm"
                            onClick={() => sendCampaign.mutate(campaign.id)}
                            disabled={sendCampaign.isPending}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteCampaign.mutate(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sequences" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Drip Sequences</h3>
            <Dialog open={showSequenceDialog} onOpenChange={setShowSequenceDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Sequence
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Drip Sequence</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Sequence Name</Label>
                    <Input
                      value={sequenceForm.name}
                      onChange={(e) => setSequenceForm({ ...sequenceForm, name: e.target.value })}
                      placeholder="Welcome Series"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={sequenceForm.description}
                      onChange={(e) => setSequenceForm({ ...sequenceForm, description: e.target.value })}
                      placeholder="Onboarding emails for new users"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger Event</Label>
                    <Select
                      value={sequenceForm.trigger_event}
                      onValueChange={(v) => setSequenceForm({ ...sequenceForm, trigger_event: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="signup">User Signup</SelectItem>
                        <SelectItem value="subscription">Subscription Started</SelectItem>
                        <SelectItem value="trial_ending">Trial Ending</SelectItem>
                        <SelectItem value="inactive">User Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => createSequence.mutate()} disabled={createSequence.isPending} className="w-full">
                    Create Sequence
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {sequencesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sequences...</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Sequences List */}
              <div className="space-y-3">
                {sequences.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No drip sequences yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  sequences.map((sequence) => (
                    <Card
                      key={sequence.id}
                      className={`cursor-pointer transition-colors ${selectedSequence?.id === sequence.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedSequence(sequence)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{sequence.name}</h4>
                              <Badge variant={sequence.is_active ? 'default' : 'secondary'}>
                                {sequence.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{sequence.description}</p>
                            <p className="text-xs text-muted-foreground">Trigger: {sequence.trigger_event}</p>
                          </div>
                          <Switch
                            checked={sequence.is_active}
                            onCheckedChange={(checked) => toggleSequence.mutate({ id: sequence.id, is_active: checked })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Steps for selected sequence */}
              <div>
                {selectedSequence ? (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-base">{selectedSequence.name} Steps</CardTitle>
                      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-1">
                            <Plus className="h-3 w-3" />
                            Add Step
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Email Step</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Delay Days</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={stepForm.delay_days}
                                  onChange={(e) => setStepForm({ ...stepForm, delay_days: parseInt(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Delay Hours</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={23}
                                  value={stepForm.delay_hours}
                                  onChange={(e) => setStepForm({ ...stepForm, delay_hours: parseInt(e.target.value) || 0 })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Subject</Label>
                              <Input
                                value={stepForm.subject}
                                onChange={(e) => setStepForm({ ...stepForm, subject: e.target.value })}
                                placeholder="Day 1: Getting Started"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Email Content (HTML)</Label>
                              <Textarea
                                value={stepForm.html_content}
                                onChange={(e) => setStepForm({ ...stepForm, html_content: e.target.value })}
                                rows={6}
                              />
                            </div>
                            <Button onClick={() => createStep.mutate()} disabled={createStep.isPending} className="w-full">
                              Add Step
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {steps.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No steps yet. Add your first email step.</p>
                      ) : (
                        <div className="space-y-3">
                          {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </div>
                              {index > 0 && (
                                <div className="absolute left-4 -mt-6 h-6 w-px bg-border" />
                              )}
                              <div className="flex-1 bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{step.subject}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {step.delay_days > 0 && `${step.delay_days}d `}
                                      {step.delay_hours > 0 && `${step.delay_hours}h `}
                                      after previous
                                    </p>
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => deleteStep.mutate(step.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {index < steps.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">Select a sequence to view and edit its steps</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailCampaigns;
