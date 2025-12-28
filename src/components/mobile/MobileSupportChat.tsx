import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send, Plus, Film, Tv, HelpCircle, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useHaptics } from "@/hooks/useHaptics";

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

interface MobileSupportChatProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSupportChat({ open, onClose }: MobileSupportChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { lightTap, successFeedback } = useHaptics();
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
    enabled: !!user?.id && open,
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

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setSelectedTicket(null);
      setShowNewTicket(false);
    }
  }, [open]);

  // Create new ticket
  const createTicket = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newTicketSubject || !newTicketMessage) {
        throw new Error("Missing required fields");
      }

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

      const { error: messageError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          message: newTicketMessage,
          is_admin: false,
        });

      if (messageError) throw messageError;

      return ticket;
    },
    onSuccess: (ticket) => {
      successFeedback();
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
    },
    onSuccess: () => {
      successFeedback();
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

  const handleBack = () => {
    lightTap();
    if (selectedTicket || showNewTicket) {
      setSelectedTicket(null);
      setShowNewTicket(false);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        <div className="flex flex-col h-full pt-safe">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border/10 bg-background/80 backdrop-blur-xl">
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="font-semibold text-foreground flex-1">
              {selectedTicket ? selectedTicketData?.subject : showNewTicket ? "New Request" : "Support Chat"}
            </h2>
            {!selectedTicket && !showNewTicket && (
              <Button
                size="sm"
                onClick={() => {
                  lightTap();
                  setShowNewTicket(true);
                }}
                className="rounded-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {showNewTicket ? (
              <div className="p-4 space-y-4 overflow-y-auto h-full">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Request Type</label>
                  <Select value={newTicketType} onValueChange={setNewTicketType}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Support</SelectItem>
                      <SelectItem value="movie_request">Request a Movie</SelectItem>
                      <SelectItem value="show_request">Request a TV Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Subject</label>
                  <Input
                    placeholder="What's this about?"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Message</label>
                  <Textarea
                    placeholder="Describe your request..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    rows={6}
                    className="rounded-xl resize-none"
                  />
                </div>
                <Button
                  className="w-full rounded-xl"
                  onClick={() => createTicket.mutate()}
                  disabled={!newTicketSubject || !newTicketMessage || createTicket.isPending}
                >
                  {createTicket.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            ) : selectedTicket ? (
              <div className="flex flex-col h-full">
                {/* Ticket Info */}
                <div className="p-3 border-b border-border/10 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs rounded-full">
                      {selectedTicketData?.ticket_type.replace("_", " ")}
                    </Badge>
                    <Badge
                      variant={selectedTicketData?.status === "open" ? "default" : "secondary"}
                      className="text-xs rounded-full"
                    >
                      {selectedTicketData?.status}
                    </Badge>
                  </div>
                </div>

                {/* Messages */}
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
                            "max-w-[85%] rounded-2xl p-3",
                            msg.is_admin
                              ? "bg-muted rounded-bl-md"
                              : "bg-primary text-primary-foreground rounded-br-md"
                          )}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.is_admin ? "text-muted-foreground" : "text-primary-foreground/70"
                          )}>
                            {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-3 border-t border-border/10 bg-background pb-safe">
                  <div className="flex gap-2">
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
                      className="rounded-full"
                    />
                    <Button
                      size="icon"
                      className="rounded-full shrink-0"
                      onClick={() => sendMessage.mutate()}
                      disabled={!newMessage.trim() || sendMessage.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {tickets?.map((ticket) => (
                    <motion.button
                      key={ticket.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        lightTap();
                        setSelectedTicket(ticket.id);
                      }}
                      className="w-full p-4 bg-muted/20 rounded-2xl text-left active:bg-muted/40 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          {getTicketTypeIcon(ticket.ticket_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {ticket.subject}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={ticket.status === "open" ? "default" : "secondary"}
                              className="text-xs rounded-full"
                            >
                              {ticket.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(ticket.updated_at), "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                  {(!tickets || tickets.length === 0) && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted/30 flex items-center justify-center mb-4">
                        <HelpCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No conversations yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        Tap "New" to start a support request
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}