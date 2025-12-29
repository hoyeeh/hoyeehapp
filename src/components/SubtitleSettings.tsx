import React from 'react';
import { Settings, Type, Palette } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSubtitleSettings, SubtitleFontSize, SubtitleFontStyle } from '@/hooks/useSubtitleSettings';

interface SubtitleSettingsProps {
  className?: string;
}

const FONT_SIZES: { value: SubtitleFontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
];

const FONT_STYLES: { value: SubtitleFontStyle; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Monospace' },
  { value: 'casual', label: 'Casual' },
];

export function SubtitleSettings({ className }: SubtitleSettingsProps) {
  const {
    settings,
    updateFontSize,
    updateFontStyle,
    resetToDefaults,
  } = useSubtitleSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          title="Subtitle Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-64 bg-background/95 backdrop-blur-sm border-border z-50"
        side="top"
        align="center"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-foreground">Subtitle Settings</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          </div>

          <div className="space-y-3">
            {/* Font Size */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5" />
                Font Size
              </Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value) => updateFontSize(value as SubtitleFontSize)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font Style */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" />
                Font Style
              </Label>
              <Select
                value={settings.fontStyle}
                onValueChange={(value) => updateFontStyle(value as SubtitleFontStyle)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {FONT_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div className="bg-black/75 text-white px-3 py-1.5 rounded text-center">
              <span className={`${settings.fontSize === 'small' ? 'text-sm' : settings.fontSize === 'large' ? 'text-lg' : settings.fontSize === 'xlarge' ? 'text-xl' : 'text-base'} ${settings.fontStyle === 'serif' ? 'font-serif' : settings.fontStyle === 'mono' ? 'font-mono' : settings.fontStyle === 'casual' ? 'italic' : ''}`}>
                Sample subtitle text
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
