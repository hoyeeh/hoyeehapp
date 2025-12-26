import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  RefreshCw, 
  Tv, 
  Smartphone, 
  Clock, 
  Play, 
  Pause, 
  Volume2, 
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface CastSession {
  id: string;
  pairing_code: string;
  status: string | null;
  video_url: string | null;
  video_title: string | null;
  video_thumbnail: string | null;
  playback_time: number | null;
  video_duration: number | null;
  is_playing: boolean | null;
  volume_level: number | null;
  last_heartbeat: string | null;
  created_at: string | null;
  expires_at: string | null;
  controller_user_id: string | null;
  receiver_id: string | null;
  queue: unknown;
}

interface CastReceiver {
  id: string;
  device_name: string;
  device_type: string | null;
  last_active: string | null;
  created_at: string | null;
  user_id: string | null;
}

export function CastSessionsManagement() {
  const [sessions, setSessions] = useState<CastSession[]>([]);
  const [receivers, setReceivers] = useState<CastReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<CastSession | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, receiversRes] = await Promise.all([
        supabase.from('cast_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('cast_receivers').select('*').order('last_active', { ascending: false })
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (receiversRes.error) throw receiversRes.error;

      setSessions(sessionsRes.data || []);
      setReceivers(receiversRes.data || []);
    } catch (error) {
      console.error('Error fetching cast data:', error);
      toast.error('Failed to load cast sessions');
    } finally {
      setLoading(false);
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    fetchData();

    const sessionsChannel = supabase
      .channel('admin-cast-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cast_sessions' },
        () => fetchData()
      )
      .subscribe();

    const receiversChannel = supabase
      .channel('admin-cast-receivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cast_receivers' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(receiversChannel);
    };
  }, []);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'paired':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Tv className="w-3 h-3 mr-1" /> Paired</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Disconnected</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const getHeartbeatStatus = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return { status: 'unknown', text: 'Never' };
    
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    if (diff < 5000) return { status: 'healthy', text: 'Just now' };
    if (diff < 30000) return { status: 'healthy', text: formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true }) };
    if (diff < 60000) return { status: 'warning', text: formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true }) };
    return { status: 'stale', text: formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true }) };
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      const { error } = await supabase
        .from('cast_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      toast.success('Session deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'paired');
  const inactiveSessions = sessions.filter(s => s.status !== 'active' && s.status !== 'paired');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display">Cast Sessions</h2>
          <p className="text-muted-foreground">Monitor and manage active TV cast sessions</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Tv className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{receivers.length}</p>
                <p className="text-sm text-muted-foreground">Registered Receivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.is_playing).length}
                </p>
                <p className="text-sm text-muted-foreground">Currently Playing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveSessions.length}</p>
                <p className="text-sm text-muted-foreground">Inactive Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="receivers">Receivers ({receivers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cast Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Tv className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No cast sessions found</p>
                    </div>
                  ) : (
                    sessions.map((session) => {
                      const heartbeat = getHeartbeatStatus(session.last_heartbeat);
                      
                      return (
                        <div 
                          key={session.id} 
                          className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <code className="text-lg font-mono font-bold text-primary">
                                  {session.pairing_code}
                                </code>
                                {getStatusBadge(session.status)}
                                {session.is_playing && (
                                  <Badge className="bg-primary/20 text-primary">
                                    <Play className="w-3 h-3 mr-1" /> Playing
                                  </Badge>
                                )}
                              </div>

                              {session.video_title && (
                                <div className="flex items-center gap-3 mb-2">
                                  {session.video_thumbnail && (
                                    <img 
                                      src={session.video_thumbnail} 
                                      alt="" 
                                      className="w-16 h-9 object-cover rounded"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium truncate">{session.video_title}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatTime(session.playback_time)} / {formatTime(session.video_duration)}
                                    </p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Heartbeat: 
                                  <span className={
                                    heartbeat.status === 'healthy' ? 'text-green-400' :
                                    heartbeat.status === 'warning' ? 'text-yellow-400' :
                                    heartbeat.status === 'stale' ? 'text-red-400' : ''
                                  }>
                                    {heartbeat.text}
                                  </span>
                                </span>
                                {session.volume_level !== null && (
                                  <span className="flex items-center gap-1">
                                    <Volume2 className="w-3 h-3" />
                                    {session.volume_level}%
                                  </span>
                                )}
                                <span>
                                  Created: {session.created_at ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true }) : 'Unknown'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setSelectedSession(session)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleDeleteSession(session.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receivers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered Receivers</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {receivers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No receivers registered</p>
                    </div>
                  ) : (
                    receivers.map((receiver) => {
                      const lastActive = getHeartbeatStatus(receiver.last_active);
                      
                      return (
                        <div 
                          key={receiver.id} 
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-full bg-muted">
                                <Tv className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">{receiver.device_name}</p>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                  <span>{receiver.device_type || 'Unknown type'}</span>
                                  <span>•</span>
                                  <span className={
                                    lastActive.status === 'healthy' ? 'text-green-400' :
                                    lastActive.status === 'warning' ? 'text-yellow-400' :
                                    lastActive.status === 'stale' ? 'text-red-400' : ''
                                  }>
                                    Last active: {lastActive.text}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline">
                              ID: {receiver.id.slice(0, 8)}...
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Session Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(selectedSession, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
