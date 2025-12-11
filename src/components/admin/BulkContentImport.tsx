import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, X, Check, AlertCircle, Loader2 } from "lucide-react";
import { useCreateContent } from "@/hooks/useAdmin";

interface ParsedContent {
  title: string;
  video_url: string;
  thumbnail_url?: string;
  genre?: string;
  description?: string;
  year?: number;
  content_type: "movie" | "series";
  status: "pending" | "importing" | "success" | "error";
  error?: string;
}

export const BulkContentImport = ({ onClose }: { onClose: () => void }) => {
  const [inputText, setInputText] = useState("");
  const [contentType, setContentType] = useState<"movie" | "series">("movie");
  const [parsedItems, setParsedItems] = useState<ParsedContent[]>([]);
  const [importing, setImporting] = useState(false);
  const createContent = useCreateContent();

  const parseInput = () => {
    const lines = inputText.trim().split("\n").filter(line => line.trim());
    
    if (lines.length === 0) {
      toast.error("Please enter content data");
      return;
    }

    const items: ParsedContent[] = [];
    
    for (const line of lines) {
      // Support multiple formats:
      // 1. Simple: Title, Video URL
      // 2. Extended: Title, Video URL, Thumbnail URL
      // 3. Full CSV: Title, Video URL, Thumbnail URL, Genre, Year, Description
      const parts = line.split(/[,\t]/).map(p => p.trim());
      
      if (parts.length < 2) {
        items.push({
          title: parts[0] || "Unknown",
          video_url: "",
          content_type: contentType,
          status: "error",
          error: "Missing video URL"
        });
        continue;
      }

      const [title, video_url, thumbnail_url, genre, yearStr, description] = parts;
      
      // Validate video URL
      if (!video_url || !isValidUrl(video_url)) {
        items.push({
          title,
          video_url,
          content_type: contentType,
          status: "error",
          error: "Invalid video URL"
        });
        continue;
      }

      items.push({
        title,
        video_url,
        thumbnail_url: thumbnail_url && isValidUrl(thumbnail_url) ? thumbnail_url : undefined,
        genre: genre || undefined,
        year: yearStr ? parseInt(yearStr) : undefined,
        description: description || undefined,
        content_type: contentType,
        status: "pending"
      });
    }

    setParsedItems(items);
    toast.success(`Parsed ${items.length} items`);
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(item => item.status === "pending");
    
    if (validItems.length === 0) {
      toast.error("No valid items to import");
      return;
    }

    setImporting(true);

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      
      if (item.status !== "pending") continue;

      // Update status to importing
      setParsedItems(prev => 
        prev.map((p, idx) => idx === i ? { ...p, status: "importing" as const } : p)
      );

      try {
        await createContent.mutateAsync({
          title: item.title,
          video_url: item.video_url,
          thumbnail_url: item.thumbnail_url || null,
          genre: item.genre || null,
          description: item.description || null,
          year: item.year || null,
          content_type: item.content_type,
          is_premium: true
        });

        setParsedItems(prev => 
          prev.map((p, idx) => idx === i ? { ...p, status: "success" as const } : p)
        );
      } catch (error: any) {
        setParsedItems(prev => 
          prev.map((p, idx) => idx === i ? { 
            ...p, 
            status: "error" as const, 
            error: error.message || "Import failed" 
          } : p)
        );
      }
    }

    setImporting(false);
    
    const successCount = parsedItems.filter(p => p.status === "success").length;
    const errorCount = parsedItems.filter(p => p.status === "error").length;
    
    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} items`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} items failed to import`);
    }
  };

  const removeItem = (index: number) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setParsedItems([]);
    setInputText("");
  };

  const getStatusBadge = (status: ParsedContent["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "importing":
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Importing</Badge>;
      case "success":
        return <Badge variant="default" className="bg-green-500 gap-1"><Check className="h-3 w-3" />Success</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Error</Badge>;
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Content Import
          </CardTitle>
          <CardDescription>
            Import multiple content items from CSV or text
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {parsedItems.length === 0 ? (
          <>
            <div className="space-y-2">
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={(v) => setContentType(v as "movie" | "series")}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="movie">Movies</SelectItem>
                  <SelectItem value="series">TV Series</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paste Content Data</Label>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Enter one item per line. Supported formats:

Title, Video URL
Title, Video URL, Thumbnail URL
Title, Video URL, Thumbnail URL, Genre, Year, Description

Example:
The Matrix, https://cdn.example.com/matrix.mp4, https://cdn.example.com/matrix.jpg, Action, 1999, A computer hacker learns about the true nature of reality
Inception, https://cdn.example.com/inception.mp4`}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={parseInput} disabled={!inputText.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                Parse Content
              </Button>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Format Guide:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Separate fields with comma (,) or tab</li>
                <li>One content item per line</li>
                <li>Required: Title, Video URL</li>
                <li>Optional: Thumbnail URL, Genre, Year, Description</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {parsedItems.length} items parsed • 
                {parsedItems.filter(p => p.status === "pending").length} pending • 
                {parsedItems.filter(p => p.status === "success").length} imported
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll} disabled={importing}>
                  Clear All
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={importing || parsedItems.filter(p => p.status === "pending").length === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import All
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Title</TableHead>
                    <TableHead>Video URL</TableHead>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Genre</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => (
                    <TableRow key={index} className={item.status === "error" ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {item.video_url || "-"}
                      </TableCell>
                      <TableCell>
                        {item.thumbnail_url ? (
                          <img 
                            src={item.thumbnail_url} 
                            alt="" 
                            className="w-10 h-6 object-cover rounded"
                            onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                          />
                        ) : "-"}
                      </TableCell>
                      <TableCell>{item.genre || "-"}</TableCell>
                      <TableCell>
                        {getStatusBadge(item.status)}
                        {item.error && (
                          <p className="text-xs text-destructive mt-1">{item.error}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === "pending" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeItem(index)}
                            disabled={importing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
