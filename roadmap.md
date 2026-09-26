# Roadmap — casting + offline repair
- [x] Cast signaling: receiver credential, JWT ownership, atomic pair/command/ACK, durable rate limits
- [x] Cast command validator rejects non-https LOAD/queue URLs
- [ ] Migrate legacy useDownloadManager to contentId-based download-video
- [ ] download-video: verify episode→season→content parent + parent entitlement (keep established subscriber download policy)
- [ ] Ship custom SW (vite-plugin-pwa generateSW overwrites public/sw.js); never cache protected requests
- [ ] Browser E2E: controller/receiver two-page, real playable MP4 fixture offline cold start/play/seek/resume/delete, denial cases
- [ ] Deploy cast-signaling + download-video; accurate report (app offline licensing ≠ DRM)
