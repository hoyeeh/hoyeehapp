import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages, Upload, Sparkles, FileText } from "lucide-react";
import { SubtitleLanguageOverview } from "./SubtitleLanguageOverview";
import { SubtitleUploader } from "./SubtitleUploader";
import { SubtitleGenerator } from "./SubtitleGenerator";
import { SubtitleTranslator } from "./SubtitleTranslator";

interface SubtitleManagementPanelProps {
  contentId: string;
  episodeId?: string;
  videoUrl?: string;
  title: string;
  onComplete?: () => void;
}

export function SubtitleManagementPanel({
  contentId,
  episodeId,
  videoUrl,
  title,
  onComplete
}: SubtitleManagementPanelProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    onComplete?.();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Subtitle Management
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 mb-4">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <FileText className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="upload" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            {videoUrl && (
              <TabsTrigger 
                value="generate" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="translate" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <Languages className="h-4 w-4 mr-2" />
              Translate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 px-4 sm:px-0">
            <SubtitleLanguageOverview 
              key={`overview-${refreshKey}`}
              contentId={contentId}
              episodeId={episodeId}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="upload" className="mt-0 px-4 sm:px-0">
            <SubtitleUploader
              contentId={contentId}
              episodeId={episodeId}
              title={title}
              onComplete={handleRefresh}
            />
          </TabsContent>

          {videoUrl && (
            <TabsContent value="generate" className="mt-0 px-4 sm:px-0">
              <SubtitleGenerator
                contentId={contentId}
                episodeId={episodeId}
                videoUrl={videoUrl}
                title={title}
                onComplete={handleRefresh}
              />
            </TabsContent>
          )}

          <TabsContent value="translate" className="mt-0 px-4 sm:px-0">
            <SubtitleTranslator
              key={`translator-${refreshKey}`}
              contentId={contentId}
              episodeId={episodeId}
              title={title}
              onComplete={handleRefresh}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
