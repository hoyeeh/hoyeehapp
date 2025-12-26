import { Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCast } from '@/contexts/CastContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CastContentButtonProps {
  videoUrl?: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}

export function CastContentButton({
  videoUrl,
  title,
  thumbnail,
  duration,
  className,
  size = 'sm',
  variant = 'ghost',
}: CastContentButtonProps) {
  const navigate = useNavigate();
  const { isConnected, loadVideo } = useCast();

  const handleCast = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!videoUrl) {
      toast.error('No video available to cast');
      return;
    }

    if (!isConnected) {
      // Navigate to cast screen with video info in state
      navigate('/cast', {
        state: {
          pendingVideo: { url: videoUrl, title, thumbnail, duration }
        }
      });
      return;
    }

    // Already connected, cast directly
    try {
      await loadVideo(videoUrl, title, thumbnail, duration);
      toast.success(`Casting "${title}" to TV`);
    } catch (error) {
      console.error('Cast error:', error);
      toast.error('Failed to cast to TV');
    }
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-5 w-5',
  };

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={handleCast}
      className={cn(
        sizeClasses[size],
        'rounded-full',
        isConnected && 'text-primary',
        className
      )}
      title={isConnected ? `Cast "${title}" to TV` : 'Connect to TV to cast'}
    >
      <Tv className={cn(iconSizes[size], isConnected && 'animate-pulse')} />
    </Button>
  );
}
