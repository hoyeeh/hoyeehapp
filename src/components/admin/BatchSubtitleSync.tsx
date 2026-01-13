import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Film, 
  Tv,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface SyncJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  content_types: string[];
  languages: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ProcessResult {
  item: string;
  result?: {
    fetched?: string[];
    skipped?: string[];
    failed?: string[];
  };
  error?: string;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Chinese' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'movie', label: 'Movies', icon: Film },
  { value: 'series', label: 'TV Series', icon: Tv },
];

export function BatchSubtitleSync() {
  const [currentJob, setCurrentJob] = useState<SyncJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [processResults, setProcessResults] = useState<ProcessResult[]>([]);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['movie', 'series']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en', 'fr']);
  const processingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load current job status on mount
  useEffect(() => {
    fetchJobStatus();
  }, []);

  // Auto-process when job is running
  useEffect(() => {
    if (currentJob?.status === 'running' && !processingRef.current) {
      processNextBatch();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentJob?.status]);

  const fetchJobStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('batch-fetch-subtitles', {
        body: { action: 'status' },
      });

      if (error) throw error;
      setCurrentJob(data.job);
    } catch (error) {
      console.error('Error fetching job status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startSync = async () => {
    if (selectedContentTypes.length === 0) {
      toast.error('Please select at least one content type');
      return;
    }
    if (selectedLanguages.length === 0) {
      toast.error('Please select at least one language');
      return;
    }

    setIsStarting(true);
    setProcessResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('batch-fetch-subtitles', {
        body: {
          action: 'start',
          contentTypes: selectedContentTypes,
          languages: selectedLanguages,
        },
      });

      if (error) throw error;
      
      setCurrentJob(data.job);
      toast.success(`Started syncing ${data.job.total_items} items`);
    } catch (error) {
      console.error('Error starting sync:', error);
      toast.error('Failed to start sync');
    } finally {
      setIsStarting(false);
    }
  };

  const pauseSync = async () => {
    if (!currentJob) return;

    try {
      await supabase.functions.invoke('batch-fetch-subtitles', {
        body: { action: 'pause', jobId: currentJob.id },
      });

      setCurrentJob(prev => prev ? { ...prev, status: 'paused' } : null);
      toast.info('Sync paused');
    } catch (error) {
      console.error('Error pausing sync:', error);
      toast.error('Failed to pause sync');
    }
  };

  const resumeSync = async () => {
    if (!currentJob) return;

    try {
      await supabase.functions.invoke('batch-fetch-subtitles', {
        body: { action: 'resume', jobId: currentJob.id },
      });

      setCurrentJob(prev => prev ? { ...prev, status: 'running' } : null);
      toast.info('Sync resumed');
    } catch (error) {
      console.error('Error resuming sync:', error);
      toast.error('Failed to resume sync');
    }
  };

  const processNextBatch = async () => {
    if (!currentJob || processingRef.current) return;

    processingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('batch-fetch-subtitles', {
        body: { action: 'process-next', jobId: currentJob.id, batchSize: 1 },
      });

      if (error) throw error;

      if (data.results) {
        setProcessResults(prev => [...prev, ...data.results].slice(-50));
      }

      setCurrentJob(data.job);

      if (!data.completed && data.job?.status === 'running') {
        // Add delay between batches (3 seconds to respect rate limits)
        setTimeout(() => {
          processingRef.current = false;
          if (currentJob?.status === 'running') {
            processNextBatch();
          }
        }, 3000);
      } else {
        processingRef.current = false;
        if (data.completed) {
          toast.success('Subtitle sync completed!');
        }
      }
    } catch (error) {
      console.error('Error processing batch:', error);
      processingRef.current = false;
      // Retry after delay
      setTimeout(() => {
        if (currentJob?.status === 'running') {
          processNextBatch();
        }
      }, 5000);
    }
  };

  const toggleContentType = (type: string) => {
    setSelectedContentTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguages(prev =>
      prev.includes(code) ? prev.filter(l => l !== code) : [...prev, code]
    );
  };

  const progressPercent = currentJob && currentJob.total_items > 0
    ? Math.round((currentJob.processed_items / currentJob.total_items) * 100)
    : 0;

  const estimatedTimeRemaining = currentJob && currentJob.total_items > 0
    ? Math.ceil(((currentJob.total_items - currentJob.processed_items) * 3) / 60)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5" />
          Batch Subtitle Sync
        </CardTitle>
        <CardDescription>
          Automatically fetch subtitles for all movies and TV episodes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration - Only show if no active job */}
        {(!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Content Types</h4>
              <div className="flex gap-4">
                {CONTENT_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedContentTypes.includes(value)}
                      onCheckedChange={() => toggleContentType(value)}
                    />
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Languages</h4>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map(({ code, label }) => (
                  <Button
                    key={code}
                    variant={selectedLanguages.includes(code) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleLanguage(code)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={startSync}
              disabled={isStarting}
              className="w-full"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Subtitle Sync
                </>
              )}
            </Button>
          </div>
        )}

        {/* Active Job Status */}
        {currentJob && (currentJob.status === 'running' || currentJob.status === 'paused') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(currentJob.status)}>
                  {currentJob.status === 'running' ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Running
                    </>
                  ) : (
                    <>
                      <Pause className="mr-1 h-3 w-3" />
                      Paused
                    </>
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {currentJob.processed_items} / {currentJob.total_items} items
                </span>
              </div>
              
              {currentJob.status === 'running' ? (
                <Button variant="outline" size="sm" onClick={pauseSync}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={resumeSync}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              )}
            </div>

            <Progress value={progressPercent} className="h-2" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{currentJob.successful_items} fetched</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-yellow-500" />
                <span>{currentJob.skipped_items} skipped</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>{currentJob.failed_items} failed</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>~{estimatedTimeRemaining} min left</span>
              </div>
            </div>
          </div>
        )}

        {/* Completed Job Summary */}
        {currentJob?.status === 'completed' && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Sync Completed</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fetched:</span>
                <span className="ml-2 font-medium">{currentJob.successful_items}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Skipped:</span>
                <span className="ml-2 font-medium">{currentJob.skipped_items}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>
                <span className="ml-2 font-medium">{currentJob.failed_items}</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity Log */}
        {processResults.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-4 space-y-2">
                {processResults.slice().reverse().map((result, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm py-1 border-b border-border/50 last:border-0"
                  >
                    {result.error ? (
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    ) : result.result?.fetched?.length ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{result.item}</span>
                      {result.error && (
                        <span className="text-red-500 text-xs">{result.error}</span>
                      )}
                      {result.result?.fetched?.map(lang => (
                        <Badge key={lang} variant="secondary" className="mr-1 text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Note about rate limits */}
        <p className="text-xs text-muted-foreground">
          Note: Processing is rate-limited to respect API limits (~3 seconds per item).
          A full sync of all content may take several hours.
        </p>
      </CardContent>
    </Card>
  );
}
