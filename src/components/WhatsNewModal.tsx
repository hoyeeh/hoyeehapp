import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Zap, Shield, Download, Globe, Bell } from 'lucide-react';

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Changelog entries - update these when releasing new versions
const CHANGELOG = [
  {
    version: '2.1.0',
    date: 'December 2024',
    highlights: [
      {
        icon: Zap,
        title: 'Faster App Updates',
        description: 'The app now updates automatically in the background with minimal disruption.',
      },
      {
        icon: Globe,
        title: 'Offline Support',
        description: 'Actions performed while offline are now automatically synced when you reconnect.',
      },
      {
        icon: Shield,
        title: 'Improved Cache Management',
        description: 'Automatic cache cleanup prevents storage issues and keeps the app running smoothly.',
      },
      {
        icon: Download,
        title: 'Better Download Experience',
        description: 'Enhanced download manager with background sync support.',
      },
    ],
  },
  {
    version: '2.0.0',
    date: 'November 2024',
    highlights: [
      {
        icon: Sparkles,
        title: 'New Design',
        description: 'Fresh new look with improved navigation and better mobile experience.',
      },
      {
        icon: Bell,
        title: 'Push Notifications',
        description: 'Stay updated with new releases and personalized recommendations.',
      },
    ],
  },
];

export function WhatsNewModal({ open, onOpenChange }: WhatsNewModalProps) {
  const latestVersion = CHANGELOG[0];

  // Mark as seen
  const handleClose = () => {
    localStorage.setItem('hoyeeh-last-seen-version', latestVersion.version);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-brand/10">
              <Sparkles className="h-5 w-5 text-brand" />
            </div>
            <DialogTitle className="text-xl">What's New</DialogTitle>
          </div>
          <DialogDescription>
            Check out the latest features and improvements
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {CHANGELOG.map((release, idx) => (
              <div key={release.version} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    Version {release.version}
                  </h3>
                  <span className="text-xs text-muted-foreground">{release.date}</span>
                </div>

                <div className="space-y-3">
                  {release.highlights.map((item, i) => (
                    <div 
                      key={i}
                      className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-shrink-0 p-1.5 rounded-md bg-brand/10">
                        <item.icon className="h-4 w-4 text-brand" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {idx < CHANGELOG.length - 1 && (
                  <div className="border-t border-border pt-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button onClick={handleClose} className="bg-brand hover:bg-brand/90">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
