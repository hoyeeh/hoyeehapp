#!/usr/bin/env bash
# Live checks against the deployed download services. Needs ~/.cache/lovable-auth/session.json (lovable auth-session --json --self).
# Usage: FREE_ID=<free title uuid> PREMIUM_ID=<premium uuid> bash e2e/live_download_api.sh
set -u
T=$(python3 -c "import json;print(json.load(open('/root/.cache/lovable-auth/session.json'))['session']['access_token'])")
UID_=$(python3 -c "import json;print(json.load(open('/root/.cache/lovable-auth/session.json'))['user_id'])")
U=https://astugmzoxhxcyipxsojl.supabase.co; K=$(grep VITE_SUPABASE_PUBLISHABLE_KEY /dev-server/.env | cut -d'"' -f2 | cut -d= -f2)
h=(-H "Authorization: Bearer $T" -H "apikey: $K" -H "Content-Type: application/json")
echo "1 free range 0-99:"; curl -s -o /tmp/b1 -D - "${h[@]}" -H "Range: bytes=0-99" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" | grep -iE "^HTTP|content-range"; xxd /tmp/b1 | head -1
echo "2 resume range 100-199:"; curl -s -o /dev/null -D - "${h[@]}" -H "Range: bytes=100-199" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" | grep -iE "^HTTP|content-range"
echo "3 premium without sub:"; curl -s "${h[@]}" -X POST $U/functions/v1/download-video -d '{"contentId":"$PREMIUM_ID"}' -w " %{http_code}\n"
echo "4 legacy videoUrl body:"; curl -s "${h[@]}" -X POST $U/functions/v1/download-video -d '{"videoUrl":"https://evil.example/x.mp4"}' -w " %{http_code}\n"
echo "5 no auth:"; curl -s -H "apikey: $K" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" -w " %{http_code}\n"
echo "6 download-start premium:"; curl -s "${h[@]}" -X POST $U/functions/v1/download-start -d '{"contentId":"$PREMIUM_ID","deviceId":"e2e-dev"}' -w " %{http_code}\n"
echo "7 download-start free (no videoUrl in reply?):"; curl -s "${h[@]}" -X POST $U/functions/v1/download-start -d '{"contentId":"$FREE_ID","deviceId":"e2e-dev"}' > /tmp/m.json; python3 -c "import json;m=json.load(open('/tmp/m.json'))['manifest'];print('videoUrl' in m, m['license']['expiresAt']>0)"
echo "8 client direct license expiry edit:"; curl -s "${h[@]}" -X PATCH "$U/rest/v1/download_licenses?user_id=eq.$UID_" -d '{"expires_at":"2099-01-01T00:00:00Z"}' -w " %{http_code}\n"
echo "9 client direct license insert:"; curl -s "${h[@]}" -X POST "$U/rest/v1/download_licenses" -d '{"user_id":"$UID_","content_id":"$PREMIUM_ID","device_id":"x","expires_at":"2099-01-01T00:00:00Z","encrypted_key":"x"}' -w " %{http_code}\n"
echo "10 complete RPC real:"; curl -s "${h[@]}" -X POST $U/rest/v1/rpc/complete_download_license -d '{"_content_id":"$FREE_ID","_episode_id":null,"_device_id":"e2e-dev","_total_size":1234}'; echo
echo "11 complete RPC again (already complete):"; curl -s "${h[@]}" -X POST $U/rest/v1/rpc/complete_download_license -d '{"_content_id":"$FREE_ID","_episode_id":null,"_device_id":"e2e-dev","_total_size":1234}'; echo
echo "12 complete RPC for unissued premium:"; curl -s "${h[@]}" -X POST $U/rest/v1/rpc/complete_download_license -d '{"_content_id":"$PREMIUM_ID","_episode_id":null,"_device_id":"e2e-dev","_total_size":1}'; echo
echo "13 cleanup delete own:"; curl -s "${h[@]}" -X DELETE "$U/rest/v1/download_licenses?device_id=eq.e2e-dev" -w " %{http_code}\n"
