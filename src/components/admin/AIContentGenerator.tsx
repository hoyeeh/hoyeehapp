import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Loader2, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIContentGeneratorProps {
  suggestions: string[];
  isLoading: boolean;
  onSelect: (value: string) => void;
  onRegenerate: () => void;
  buttonText?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AIContentGenerator({
  suggestions,
  isLoading,
  onSelect,
  onRegenerate,
  buttonText = "Generate with AI",
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
}: AIContentGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelect = (suggestion: string, index: number) => {
    setSelectedIndex(index);
    onSelect(suggestion);
    setTimeout(() => {
      setIsOpen(false);
      setSelectedIndex(null);
    }, 300);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={buttonVariant}
          size={buttonSize}
          className={cn("gap-2", className)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {buttonText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">AI Suggestions</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isLoading}
              className="h-8 px-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(suggestion, index)}
                  className={cn(
                    "w-full text-left p-2 rounded-md text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "border border-border",
                    selectedIndex === index && "bg-primary/10 border-primary"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-1 line-clamp-3">{suggestion}</span>
                    {selectedIndex === index && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Click regenerate to get suggestions
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
