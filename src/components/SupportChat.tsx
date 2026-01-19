import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageCircle, Send, Plus, Film, Tv, HelpCircle, X } from "lucide-react";
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
  created_at: string;
  updated_at: string;
}

export const SupportChat = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketType, setNewTicketType] = useState("general");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user's tickets
  const { data: tickets } = useQuery({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user?.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user?.id && isOpen,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["support-messages", selectedTicket],
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
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`ticket-${selectedTicket}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${selectedTicket}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket] });
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

  // Notify admins about support activity
  const notifyAdmins = async (
    ticketId: string,
    ticketSubject: string,
    ticketType: string,
    message: string,
    isNewTicket: boolean
  ) => {
    try {
      await supabase.functions.invoke("notify-admin-support", {
        body: {
          ticketId,
          ticketSubject,
          ticketType,
          message,
          isNewTicket,
        },
      });
    } catch (error) {
      console.error("Failed to notify admins:", error);
    }
  };

  // Create new ticket
  const createTicket = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newTicketSubject || !newTicketMessage) {
        throw new Error("Missing required fields");
      }

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: newTicketSubject,
          ticket_type: newTicketType,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Add initial message
      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          message: newTicketMessage,
          is_admin: false,
        });

      if (messageError) throw messageError;

      // Notify admins about new ticket
      await notifyAdmins(ticket.id, newTicketSubject, newTicketType, newTicketMessage, true);

      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success("Support ticket created!");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowNewTicket(false);
      setNewTicketSubject("");
      setNewTicketMessage("");
      setSelectedTicket(ticket.id);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create ticket");
    },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedTicket || !newMessage.trim()) {
        throw new Error("Missing required fields");
      }

      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket,
          sender_id: user.id,
          message: newMessage.trim(),
          is_admin: false,
        });

      if (error) throw error;

      // Find ticket details for notification
      const ticket = tickets?.find(t => t.id === selectedTicket);
      if (ticket) {
        await notifyAdmins(selectedTicket, ticket.subject, ticket.ticket_type, newMessage.trim(), false);
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const getTicketTypeIcon = (type: string) => {
    switch (type) {
      case "movie_request":
        return <Film className="h-4 w-4" />;
      case "show_request":
        return <Tv className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const selectedTicketData = tickets?.find(t => t.id === selectedTicket);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 p-0 shadow-lg bg-brand text-white hover:bg-brand/90 border-0"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-brand" />
            Support Chat
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Tickets List */}
          <div className="w-1/3 border-r flex flex-col">
            <div className="p-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  setShowNewTicket(true);
                  setSelectedTicket(null);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Request
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {tickets?.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicket(ticket.id);
                      setShowNewTicket(false);
                    }}
                    className={cn(
                      "w-full p-2 rounded-lg text-left transition-colors",
                      selectedTicket === ticket.id
                        ? "bg-brand/20 border border-brand"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {getTicketTypeIcon(ticket.ticket_type)}
                      <span className="text-sm font-medium truncate">
                        {ticket.subject}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={ticket.status === "open" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {ticket.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(ticket.updated_at), "MMM d")}
                      </span>
                    </div>
                  </button>
                ))}
                {(!tickets || tickets.length === 0) && (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No conversations yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {showNewTicket ? (
              <div className="p-4 space-y-4">
                <h3 className="font-medium">New Support Request</h3>
                <div className="space-y-2">
                  <Select value={newTicketType} onValueChange={setNewTicketType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Support</SelectItem>
                      <SelectItem value="movie_request">Request a Movie</SelectItem>
                      <SelectItem value="show_request">Request a TV Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder="Subject"
                  value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Describe your request..."
                  value={newTicketMessage}
                  onChange={(e) => setNewTicketMessage(e.target.value)}
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewTicket(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createTicket.mutate()}
                    disabled={!newTicketSubject || !newTicketMessage || createTicket.isPending}
                  >
                    Submit
                  </Button>
                </div>
              </div>
            ) : selectedTicket ? (
              <>
                <div className="p-3 border-b bg-muted/50">
                  <h3 className="font-medium">{selectedTicketData?.subject}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {selectedTicketData?.ticket_type.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={selectedTicketData?.status === "open" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {selectedTicketData?.status}
                    </Badge>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages?.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.is_admin ? "justify-start" : "justify-end"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-3",
                            msg.is_admin
                              ? "bg-muted"
                              : "bg-brand text-white"
                          )}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.is_admin ? "text-muted-foreground" : "text-white/70"
                          )}>
                            {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder="Type a message..."
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
                Select a conversation or start a new one
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
