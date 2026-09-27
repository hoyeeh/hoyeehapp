/**
 * DEV-ONLY player E2E harness. Mounted by App.tsx only when import.meta.env.DEV,
 * so neither this module nor the fixture video is emitted into production builds.
 * Mounts the real live player components against a local playable fixture.
 * No auth is bypassed: players run with whatever (usually signed-out) session exists.
 */
import { useSearchParams } from "react-router-dom";
import fixtureUrl from "../../e2e/fixtures/fixture.webm?url";
import { VideoPlayer } from "@/components/VideoPlayer";
import { MobileVideoPlayer } from "@/components/mobile/MobileVideoPlayer";
import { VideoJSPlayerWithWatchParty } from "@/components/VideoJSPlayerWithWatchParty";
import type { Content } from "@/types";

const content: Content = {
  id: "e2e-fixture",
  title: "E2E Fixture",
  description: "Local playable fixture",
  thumbnailUrl: "",
  videoUrl: fixtureUrl,
  genre: "Animation",
  contentType: "movie",
  isPremium: false,
  duration: 1,
  contentRating: "G",
};

export default function PlayerHarness() {
  const [params] = useSearchParams();
  const player = params.get("player") ?? "desktop";
  const noop = () => {};

  return (
    <div data-testid="harness" data-player={player} className="fixed inset-0 bg-background">
      {player === "desktop" && (
        <VideoPlayer src={fixtureUrl} title={content.title} contentId={content.id} initialProgress={0} onBack={noop} />
      )}
      {(player === "mobile" || player === "mobile-kids") && (
        <MobileVideoPlayer
          content={content}
          videoUrl={fixtureUrl}
          title={content.title}
          onClose={noop}
          isKidsMode={player === "mobile-kids"}
          kidsProfileId={player === "mobile-kids" ? "e2e-kids-profile" : undefined}
          kidsTimeRemaining={player === "mobile-kids" ? 60 : undefined}
        />
      )}
      {player === "videojs" && (
        <VideoJSPlayerWithWatchParty src={fixtureUrl} type="video/webm" autoplay contentId={content.id} title={content.title} />
      )}
    </div>
  );
}
