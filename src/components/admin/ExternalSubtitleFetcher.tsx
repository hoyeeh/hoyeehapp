import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, CheckCircle2, XCircle, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ExternalSubtitleFetcherProps {
  contentId: string;
  episodeId?: string;
  title: string;
  onComplete?: () => void;
}

interface FetchResult {
  fetched: Array<{ language: string; source: string; url: string }>;
  skipped: Array<{ language: string; reason: string }>;
  failed: Array<{ language: string; error: string }>;
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
];

export function ExternalSubtitleFetcher({
  contentId,
  episodeId,
  title,
  onComplete,
}: ExternalSubtitleFetcherProps) {
  const [isFetching, setIsFetching] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en', 'fr']);
  const [result, setResult] = useState<FetchResult | null>(null);

  // Fetch existing subtitles
  const { data: existingSubtitles, refetch: refetchSubtitles } = useQuery({
    queryKey: ['subtitles', contentId, episodeId],
    queryFn: async () => {
      let query = supabase
        .from('subtitles')
        .select('*')
        .eq('content_id', contentId);
      
      if (episodeId) {
        query = query.eq('episode_id', episodeId);
      } else {
        query = query.is('episode_id', null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const handleFetch = async () => {
    if (selectedLanguages.length === 0) {
      toast.error('Please select at least one language');
      return;
    }

    setIsFetching(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('auto-fetch-subtitles', {
        body: {
          contentId,
          episodeId,
          languages: selectedLanguages,
        },
      });

      if (error) throw error;

      setResult(data.results);

      if (data.results.fetched.length > 0) {
        toast.success(`Successfully fetched ${data.results.fetched.length} subtitle(s)`);
      } else if (data.results.skipped.length === selectedLanguages.length) {
        toast.info('All subtitles already exist');
      } else {
        toast.warning('No subtitles found from external sources');
      }

      refetchSubtitles();
      onComplete?.();
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error(error.message || 'Failed to fetch subtitles');
    } finally {
      setIsFetching(false);
    }
  };

  const toggleLanguage = (langCode: string) => {
    setSelectedLanguages(prev =>
      prev.includes(langCode)
        ? prev.filter(l => l !== langCode)
        : [...prev, langCode]
    );
  };

  const getExistingLangCodes = () => {
    return existingSubtitles?.map(s => {
      if (s.language_code === 'eng') return 'en';
      if (s.language_code === 'fra') return 'fr';
      return s.language_code;
    }) || [];
  };

  const existingLangs = getExistingLangCodes();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          External Subtitle Fetcher
        </CardTitle>
        <CardDescription>
          Automatically fetch subtitles from OpenSubtitles and other sources for "{title}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Languages</label>
          <div className="flex gap-2 flex-wrap">
            {LANGUAGE_OPTIONS.map(lang => {
              const isExisting = existingLangs.includes(lang.code);
              const isSelected = selectedLanguages.includes(lang.code);
              
              return (
                <Button
                  key={lang.code}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleLanguage(lang.code)}
                  disabled={isExisting}
                  className="relative"
                >
                  {lang.label}
                  {isExisting && (
                    <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
                  )}
                </Button>
              );
            })}
          </div>
          {existingLangs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 inline mr-1 text-green-500" />
              Already available languages are disabled
            </p>
          )}
        </div>

        {/* Existing Subtitles */}
        {existingSubtitles && existingSubtitles.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Existing Subtitles</label>
            <div className="flex gap-2 flex-wrap">
              {existingSubtitles.map(sub => (
                <Badge key={sub.id} variant="secondary">
                  {sub.language_label}
                  {sub.external_source && (
                    <span className="ml-1 text-xs opacity-70">
                      ({sub.external_source})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Fetch Button */}
        <Button
          onClick={handleFetch}
          disabled={isFetching || selectedLanguages.length === 0}
          className="w-full"
        >
          {isFetching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching External Sources...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Fetch Subtitles
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium">Results</h4>
            
            {result.fetched.length > 0 && (
              <div className="space-y-1">
                {result.fetched.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item.language.toUpperCase()}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.source}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            
            {result.skipped.length > 0 && (
              <div className="space-y-1">
                {result.skipped.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{item.language.toUpperCase()}</span>
                    <span className="text-xs">({item.reason})</span>
                  </div>
                ))}
              </div>
            )}
            
            {result.failed.length > 0 && (
              <div className="space-y-1">
                {result.failed.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>{item.language.toUpperCase()}</span>
                    <span className="text-xs">({item.error})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Sources: OpenSubtitles API, Podnapisi, YIFY Subtitles, Addic7ed, TVSubtitles
        </p>
      </CardContent>
    </Card>
  );
}
