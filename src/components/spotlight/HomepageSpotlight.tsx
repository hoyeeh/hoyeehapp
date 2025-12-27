import { useActiveHomepageAds } from '@/hooks/useHomepageAds';
import { SpotlightAdCarousel } from './SpotlightAdCarousel';
import { Skeleton } from '@/components/ui/skeleton';

interface HomepageSpotlightProps {
  appContext?: 'main' | 'kids' | 'tv';
}

export function HomepageSpotlight({ appContext = 'main' }: HomepageSpotlightProps) {
  const { data: ads, isLoading } = useActiveHomepageAds(appContext);

  if (isLoading) {
    return (
      <div className="px-4 md:px-6 lg:px-8 py-4">
        <Skeleton className="w-full aspect-video md:aspect-[21/9] rounded-xl" />
      </div>
    );
  }

  if (!ads?.length) {
    return null;
  }

  return <SpotlightAdCarousel ads={ads} appContext={appContext} />;
}
