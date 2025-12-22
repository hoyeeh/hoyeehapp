import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageCircle, Send, Film, Tv, HelpCircle, Check, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  ticket_type: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export const AdminSupportChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all users for display names
  const { data: users } = useQuery({
    queryKey: ["all-users-support"],
    queryFn: async () => {
      // Use profiles_safe view which excludes sensitive fields
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, display_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all tickets
  const { data: tickets } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["admin-support-messages", selectedTicket],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicket,
  });

  // Subscribe to real-time messages
  useEffect(() => {
    const channel = supabase
      .channel("admin-support-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-support-messages", selectedTicket] });
          queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_tickets",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket, queryClient]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedTicket || !newMessage.trim()) {
        throw new Error("Missing required fields");
      }

      const ticket = tickets?.find(t => t.id === selectedTicket);
      if (!ticket) throw new Error("Ticket not found");

      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket,
          sender_id: user.id,
          message: newMessage.trim(),
          is_admin: true,
        });

      if (error) throw error;

      // Update ticket's updated_at
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket);

      // Send email notification via edge function
      const userName = users?.find(u => u.id === ticket.user_id)?.display_name || "User";
      
      // Send email notification
      try {
        await supabase.functions.invoke("send-support-reply-email", {
          body: {
            userId: ticket.user_id,
            userName,
            ticketSubject: ticket.subject,
            replyMessage: newMessage.trim(),
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

      // Send push notification
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: ticket.user_id,
            title: "Support Reply",
            body: `New reply on: ${ticket.subject}`,
            url: "/",
          },
        });
      } catch (pushError) {
        console.error("Failed to send push notification:", pushError);
      }

      // Create in-app notification
      try {
        await supabase.from("notifications").insert({
          user_id: ticket.user_id,
          title: "Support Reply",
          body: `New reply on your ticket: ${ticket.subject}`,
          type: "support",
        });
      } catch (notifError) {
        console.error("Failed to create notification:", notifError);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      toast.success("Reply sent with notifications");
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages", selectedTicket] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  // Update ticket status
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!selectedTicket) throw new Error("No ticket selected");

      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", selectedTicket);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const getTicketTypeIcon = (type: string) => {
    switch (type) {
      case "movie_request":
        return <Film className="h-4 w-4 text-blue-500" />;
      case "show_request":
        return <Tv className="h-4 w-4 text-purple-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUserName = (userId: string) => {
    return users?.find(u => u.id === userId)?.display_name || "Unknown User";
  };

  const filteredTickets = tickets?.filter(ticket => {
    if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
    if (typeFilter !== "all" && ticket.ticket_type !== typeFilter) return false;
    if (assignmentFilter === "mine" && ticket.assigned_to !== user?.id) return false;
    if (assignmentFilter === "unassigned" && ticket.assigned_to !== null) return false;
    return true;
  });

  const selectedTicketData = tickets?.find(t => t.id === selectedTicket);

  // Stats
  const openCount = tickets?.filter(t => t.status === "open").length || 0;
  const myTickets = tickets?.filter(t => t.assigned_to === user?.id).length || 0;
  const unassignedCount = tickets?.filter(t => t.assigned_to === null && t.status === "open").length || 0;
  const movieRequests = tickets?.filter(t => t.ticket_type === "movie_request").length || 0;
  const showRequests = tickets?.filter(t => t.ticket_type === "show_request").length || 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{tickets?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">{openCount}</div>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-brand">{myTickets}</div>
            <p className="text-sm text-muted-foreground">My Tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">{unassignedCount}</div>
            <p className="text-sm text-muted-foreground">Unassigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-500">{movieRequests}</div>
            <p className="text-sm text-muted-foreground">Movie Requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Interface */}
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-brand" />
              Support Tickets
            </CardTitle>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tickets</SelectItem>
                  <SelectItem value="mine">My Tickets</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="movie_request">Movie Requests</SelectItem>
                  <SelectItem value="show_request">Show Requests</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex overflow-hidden p-0">
          {/* Tickets List */}
          <div className="w-1/3 border-r flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredTickets?.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket.id)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors",
                      selectedTicket === ticket.id
                        ? "bg-brand/20 border border-brand"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getTicketTypeIcon(ticket.ticket_type)}
                      <span className="text-sm font-medium truncate flex-1">
                        {ticket.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{getUserName(ticket.user_id)}</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1 mt-2">
                      <Badge
                        variant={ticket.status === "open" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {ticket.status}
                      </Badge>
                      {ticket.assigned_to && (
                        <Badge variant="outline" className="text-xs">
                          {ticket.assigned_to === user?.id ? "You" : getUserName(ticket.assigned_to)}
                        </Badge>
                      )}
                      {!ticket.assigned_to && (
                        <Badge variant="destructive" className="text-xs">
                          Unassigned
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(ticket.updated_at), "MMM d")}
                      </span>
                    </div>
                  </button>
                ))}
                {(!filteredTickets || filteredTickets.length === 0) && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No tickets found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedTicket && selectedTicketData ? (
              <>
                <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{selectedTicketData.subject}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      {getUserName(selectedTicketData.user_id)}
                      <span>•</span>
                      {format(new Date(selectedTicketData.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={selectedTicketData.status === "open" ? "default" : "outline"}
                      onClick={() => updateStatus.mutate(selectedTicketData.status === "open" ? "closed" : "open")}
                    >
                      {selectedTicketData.status === "open" ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Close
                        </>
                      ) : (
                        <>
                          <Clock className="h-4 w-4 mr-1" />
                          Reopen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.is_admin ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-3",
                            msg.is_admin
                              ? "bg-brand text-white"
                              : "bg-muted"
                          )}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.is_admin ? "text-white/70" : "text-muted-foreground"
                          )}>
                            {msg.is_admin ? "Admin" : getUserName(msg.sender_id)} • {format(new Date(msg.created_at), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder="Type a reply..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage.mutate();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessage.mutate()}
                    disabled={!newMessage.trim() || sendMessage.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a ticket to view conversation
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
