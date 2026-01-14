import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Save, Languages, Loader2 } from "lucide-react";

interface LanguageOption {
  code: string;
  label: string;
  native_label: string | null;
  region: string | null;
  is_african: boolean;
  display_order: number;
}

export function SubtitleLanguageConfig() {
  const queryClient = useQueryClient();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // Fetch available language options
  const { data: languageOptions = [], isLoading: loadingOptions } = useQuery({
    queryKey: ["subtitle-language-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtitle_language_options")
        .select("*")
        .order("display_order");
      
      if (error) throw error;
      return data as LanguageOption[];
    },
  });

  // Fetch current settings
  const { data: currentSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["subtitle-languages-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("setting_value")
        .eq("setting_key", "subtitle_languages")
        .single();
      
      if (error && error.code !== "PGRST116") throw error;
      return data?.setting_value ? JSON.parse(data.setting_value) : ["eng", "fra"];
    },
  });

  // Update selected languages when settings load
  useEffect(() => {
    if (currentSettings) {
      setSelectedLanguages(currentSettings);
    }
  }, [currentSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (languages: string[]) => {
      const { error } = await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(languages) })
        .eq("setting_key", "subtitle_languages");
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtitle-languages-setting"] });
      toast.success("Subtitle languages saved", {
        description: `${selectedLanguages.length} languages will be auto-generated`,
      });
    },
    onError: (error) => {
      toast.error("Failed to save settings", {
        description: error.message,
      });
    },
  });

  const toggleLanguage = (code: string) => {
    // English is always required
    if (code === "eng") return;
    
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  };

  const groupedLanguages = {
    global: languageOptions.filter((l) => l.region === "Global"),
    african: languageOptions.filter((l) => l.is_african),
    european: languageOptions.filter((l) => l.region === "Europe"),
    other: languageOptions.filter((l) => 
      !l.is_african && l.region !== "Global" && l.region !== "Europe"
    ),
  };

  const isLoading = loadingOptions || loadingSettings;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Auto-Generated Subtitle Languages
        </CardTitle>
        <CardDescription>
          Select which languages should be automatically generated for all content.
          English is always required as the source language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Languages */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Global Languages
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {groupedLanguages.global.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLanguages.includes(lang.code)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                } ${lang.code === "eng" ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <Checkbox
                  checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={() => toggleLanguage(lang.code)}
                  disabled={lang.code === "eng"}
                />
                <div className="min-w-0">
                  <div className="font-medium text-sm">{lang.label}</div>
                  <div className="text-xs text-muted-foreground">{lang.native_label}</div>
                </div>
                {lang.code === "eng" && (
                  <Badge variant="secondary" className="ml-auto text-xs">Required</Badge>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* African Languages */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            🌍 African Languages
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {groupedLanguages.african.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLanguages.includes(lang.code)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={() => toggleLanguage(lang.code)}
                />
                <div className="min-w-0">
                  <div className="font-medium text-sm">{lang.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {lang.native_label} • {lang.region}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* European Languages */}
        <div>
          <h4 className="text-sm font-medium mb-3">🇪🇺 European Languages</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {groupedLanguages.european.map((lang) => (
              <label
                key={lang.code}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedLanguages.includes(lang.code)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={() => toggleLanguage(lang.code)}
                />
                <div className="min-w-0">
                  <div className="font-medium text-sm">{lang.label}</div>
                  <div className="text-xs text-muted-foreground">{lang.native_label}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Other Languages */}
        {groupedLanguages.other.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">🌏 Other Languages</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {groupedLanguages.other.map((lang) => (
                <label
                  key={lang.code}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedLanguages.includes(lang.code)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={selectedLanguages.includes(lang.code)}
                    onCheckedChange={() => toggleLanguage(lang.code)}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{lang.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {lang.native_label} • {lang.region}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Summary and Save */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedLanguages.length}</span> languages selected
          </div>
          <Button
            onClick={() => saveMutation.mutate(selectedLanguages)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
