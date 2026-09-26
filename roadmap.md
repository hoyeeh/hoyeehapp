# Roadmap — casting + offline repair
- [x] Cast signaling: receiver credential, JWT ownership, atomic pair/command/ACK, durable rate limits
- [x] Cast command validator rejects non-https LOAD/queue URLs
- [x] Migrate legacy useDownloadManager to contentId-based download-video
- [x] download-video: verify episode→season→content parent + parent entitlement (keep established subscriber download policy)
- [x] Ship custom SW (vite-plugin-pwa generateSW overwrites public/sw.js); never cache protected requests
- [x] Browser E2E: controller/receiver two-page, real playable MP4 fixture offline cold start/play/seek/resume/delete, denial cases
- [x] Deploy cast-signaling + download-video; accurate report (app offline licensing ≠ DRM)
- [ ] Physical Chromecast / AirPlay / smart-TV and real iOS/Android device checks (needs hardware)
- [ ] Decide: merge the two Download buttons on title pages (older quality picker + new one)
