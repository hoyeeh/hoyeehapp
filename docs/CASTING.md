# Casting capability matrix (truthful, as shipped)

Three independent paths. They are NOT the same session or protocol.

| Runtime | Google Cast (CAF Web Sender, Default Media Receiver `CC1AD845`) | AirPlay (Safari `webkitShowPlaybackTargetPicker`) | Browser Remote Playback (`video.remote.prompt`) | Hoyeeh TV-code / QR (`/tv` receiver, cast-signaling v2) |
|---|---|---|---|---|
| Chrome desktop (Win/Mac/Linux/ChromeOS) | Yes, when SDK loads and a Cast device is on the network | No | Shown if API present | Yes |
| Edge / Opera / Firefox desktop | No (not enabled in app) | No | Shown only if API present | Yes |
| Safari macOS | No | Yes, attached to the playing `<video>` | No | Yes |
| iOS Safari | No | Yes, attached to the playing `<video>` (`playsInline`, `x-webkit-airplay="allow"`) | No | Yes |
| Chrome / Firefox / Edge on iOS (CriOS etc.) | No — Google does not support Web Sender here | Only if WebKit exposes the picker on the video | No | Yes |
| Android Chrome (mobile web / installed PWA) | No (Web Sender not used on mobile) | No | Shown only if API present; not labelled Chromecast | Yes |
| Capacitor webview (Android/iOS) | No — native Cast unavailable | iOS only if WebKit exposes picker | No | Yes |

Rules
- "Casting" is shown only after a confirmed result: CAF `loadMedia` resolved, or TV-code LOAD ACKed by exact seq. Remote Playback / AirPlay only report that the system picker opened/connected.
- CAF sessions play on Google's Default Media Receiver; they never use or report Hoyeeh TV-code ACKs, and vice versa.
- Only receiver-reachable https media is sent (no blob/offline/local hosts) — `src/lib/castMedia.ts`.
- The TV-code receiver (signed-in controller JWT + receiver secret) is the core cross-platform path.

## Native Cast (not implemented — remaining integration steps)
The repo has no `android/` or `ios/` projects and no registered Cast plugin, so there is no native UI.
To add it for real:
1. `npx cap add android` and `npx cap add ios`; commit the native projects.
2. Pick a maintained Capacitor Google Cast plugin (verify latest release/Capacitor major compatibility), or write a local plugin wrapping
   Android `com.google.android.gms:play-services-cast-framework` (`CastOptionsProvider`, `CastContext`, `RemoteMediaClient`) and iOS `google-cast-sdk` (`GCKCastContext`, `GCKRemoteMediaClient`).
3. Android: add `OptionsProvider` meta-data to `AndroidManifest.xml` with receiver app ID (`CC1AD845` or a registered custom receiver).
4. iOS: add `NSLocalNetworkUsageDescription` and `NSBonjourServices` (`_googlecast._tcp`, `_<APPID>._googlecast._tcp`) to Info.plist; iOS 14+ local-network permission prompt.
5. Expose a bridge returning `{success, error, cancelled, deviceName}` for connect/load (same contract as `googleCastSender.ts`), then add a `native` branch in the cast selector gated on `Capacitor.isPluginAvailable(...)`.
6. Test on physical Android and iPhone with a real Chromecast before enabling UI.
