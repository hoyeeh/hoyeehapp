import { useState } from "react";
import { 
  Activity, AlertTriangle, CheckCircle, HelpCircle, RefreshCw,
  Clock, TrendingUp, Shield, Eye, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAllPlayableGames, useUpdatePlayableGame, PlayableGame } from "@/hooks/usePlayableGames";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";

interface HealthCheckResult {
  checked: number;
  healthy: number;
  broken: number;
  timeout: number;
  statusChanges: Array<{ title: string; from: string | null; to: string }>;
  timestamp: string;
}

export const GameHealthMonitor = () => {
  const { data: games, isLoading } = useAllPlayableGames();
  const updateGame = useUpdatePlayableGame();
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<HealthCheckResult | null>(null);

  // Calculate stats
  const healthyCount = games?.filter(g => g.health_status === "healthy").length || 0;
  const brokenCount = games?.filter(g => g.health_status === "broken").length || 0;
  const unknownCount = games?.filter(g => g.health_status === "unknown" || !g.health_status).length || 0;
  const timeoutCount = games?.filter(g => (g.health_status as string) === "timeout").length || 0;

  // Get broken and timeout games
  const problematicGames = games?.filter(g => 
    g.health_status === "broken" || (g.health_status as string) === "timeout"
  ) || [];

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("game-health-check");
      
      if (error) throw error;
      
      setLastResult(data as HealthCheckResult);
      queryClient.invalidateQueries({ queryKey: ["all-playable-games"] });
      queryClient.invalidateQueries({ queryKey: ["playable-games"] });
      
      if (data.statusChanges?.length > 0) {
        toast.success(`Health check complete! ${data.statusChanges.length} status changes detected.`);
      } else {
        toast.success(`Health check complete! All ${data.checked} games checked.`);
      }
    } catch (error) {
      console.error("Health check failed:", error);
      toast.error("Failed to run health check");
    } finally {
      setIsChecking(false);
    }
  };

  const toggleGameActive = async (game: PlayableGame) => {
    try {
      await updateGame.mutateAsync({ id: game.id, is_active: !game.is_active });
      toast.success(game.is_active ? "Game hidden from users" : "Game restored to library");
    } catch (error) {
      toast.error("Failed to update game");
    }
  };

  const markAsHealthy = async (game: PlayableGame) => {
    try {
      await updateGame.mutateAsync({ id: game.id, health_status: "healthy" });
      toast.success(`${game.title} marked as healthy`);
    } catch (error) {
      toast.error("Failed to update game");
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case "broken":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Broken</Badge>;
      case "timeout":
        return <Badge variant="secondary" className="bg-yellow-500 text-black"><Clock className="h-3 w-3 mr-1" />Timeout</Badge>;
      default:
        return <Badge variant="outline"><HelpCircle className="h-3 w-3 mr-1" />Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Game Health Monitor</h2>
            <p className="text-sm text-muted-foreground">
              Monitor game availability and automatically hide broken games
            </p>
          </div>
        </div>
        <Button 
          onClick={runHealthCheck} 
          disabled={isChecking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Checking..." : "Run Health Check"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{healthyCount}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{brokenCount}</p>
                <p className="text-xs text-muted-foreground">Broken</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{timeoutCount}</p>
                <p className="text-xs text-muted-foreground">Timeout</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unknownCount}</p>
                <p className="text-xs text-muted-foreground">Unchecked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Automatic Protection</p>
              <p className="text-sm text-muted-foreground">
                Health checks run automatically every 6 hours. Broken games are automatically hidden from users 
                but remain visible here for review. You can manually mark games as healthy or hide/restore them.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Check Result */}
      {lastResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last Health Check
            </CardTitle>
            <CardDescription>
              {format(new Date(lastResult.timestamp), "PPpp")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xl font-bold">{lastResult.checked}</p>
                <p className="text-xs text-muted-foreground">Checked</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-500">{lastResult.healthy}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
              <div>
                <p className="text-xl font-bold text-destructive">{lastResult.broken}</p>
                <p className="text-xs text-muted-foreground">Broken</p>
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-500">{lastResult.timeout}</p>
                <p className="text-xs text-muted-foreground">Timeout</p>
              </div>
            </div>
            {lastResult.statusChanges?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Status Changes:</p>
                <div className="space-y-1">
                  {lastResult.statusChanges.map((change, i) => (
                    <div key={i} className="text-sm flex items-center gap-2">
                      <span className="font-medium">{change.title}</span>
                      <span className="text-muted-foreground">
                        {change.from || "unknown"} → {change.to}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Problematic Games Table */}
      {problematicGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Games Requiring Attention ({problematicGames.length})
            </CardTitle>
            <CardDescription>
              These games have failed health checks and are hidden from users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Check</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {problematicGames.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={game.thumbnail_url}
                          alt={game.title}
                          className="h-10 w-10 rounded object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                        <div>
                          <p className="font-medium">{game.title}</p>
                          <a 
                            href={game.embed_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary truncate block max-w-[200px]"
                          >
                            {game.embed_url}
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{game.source}</TableCell>
                    <TableCell>{getHealthBadge(game.health_status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {game.last_health_check 
                        ? formatDistanceToNow(new Date(game.last_health_check), { addSuffix: true })
                        : "Never"
                      }
                    </TableCell>
                    <TableCell>
                      {game.is_active ? (
                        <Badge variant="outline" className="text-green-500">
                          <Eye className="h-3 w-3 mr-1" />Visible
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="h-3 w-3 mr-1" />Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => markAsHealthy(game)}
                      >
                        Mark Healthy
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleGameActive(game)}
                      >
                        {game.is_active ? "Hide" : "Restore"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Games Health Overview */}
      {!isLoading && games && games.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Games Health Status</CardTitle>
            <CardDescription>
              Overview of health status for all {games.length} games
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-4 rounded-full overflow-hidden flex bg-muted">
              {healthyCount > 0 && (
                <div 
                  className="bg-green-500 h-full" 
                  style={{ width: `${(healthyCount / games.length) * 100}%` }}
                  title={`${healthyCount} healthy`}
                />
              )}
              {brokenCount > 0 && (
                <div 
                  className="bg-destructive h-full" 
                  style={{ width: `${(brokenCount / games.length) * 100}%` }}
                  title={`${brokenCount} broken`}
                />
              )}
              {timeoutCount > 0 && (
                <div 
                  className="bg-yellow-500 h-full" 
                  style={{ width: `${(timeoutCount / games.length) * 100}%` }}
                  title={`${timeoutCount} timeout`}
                />
              )}
              {unknownCount > 0 && (
                <div 
                  className="bg-muted-foreground/30 h-full" 
                  style={{ width: `${(unknownCount / games.length) * 100}%` }}
                  title={`${unknownCount} unknown`}
                />
              )}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Healthy ({healthyCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-destructive" />
                <span>Broken ({brokenCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span>Timeout ({timeoutCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                <span>Unchecked ({unknownCount})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
