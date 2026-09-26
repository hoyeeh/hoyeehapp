#!/usr/bin/env bash
# Live behavioral checks against the deployed download services.
# Needs a signed-in session file: `lovable auth-session --json --self`
# Usage: FREE_ID=<free title uuid> PREMIUM_ID=<premium title uuid, caller NOT subscribed> bash e2e/live_download_api.sh
# Tokens are never printed.
set -u
S=~/.cache/lovable-auth/session.json
T=$(python3 -c "import json;print(json.load(open('$S'))['session']['access_token'])")
UID_=$(python3 -c "import json;print(json.load(open('$S'))['user_id'])")
U=https://astugmzoxhxcyipxsojl.supabase.co
K=$(grep VITE_SUPABASE_PUBLISHABLE_KEY "$(dirname "$0")/../.env" | cut -d'"' -f2)
h=(-H "Authorization: Bearer $T" -H "apikey: $K" -H "Content-Type: application/json")
DEV=e2e-dev-$$
fn() { curl -s "${h[@]}" -X POST "$U/functions/v1/$1" -d "$2" -w " [%{http_code}]\n"; }

echo "1 free title, Range 0-99 (expect 206 + ftyp):"
curl -s -o /tmp/e2e_b1 -D - "${h[@]}" -H "Range: bytes=0-99" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" | grep -iE "^HTTP|^content-range"; xxd /tmp/e2e_b1 | head -1
echo "2 resume Range 100-199 (expect 206 bytes 100-199/N):"
curl -s -o /dev/null -D - "${h[@]}" -H "Range: bytes=100-199" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" | grep -iE "^HTTP|^content-range"
echo "3 premium without subscription (expect 403):"; fn download-video "{\"contentId\":\"$PREMIUM_ID\"}"
echo "4 client-supplied videoUrl (expect 400):"; fn download-video '{"videoUrl":"https://evil.example/x.mp4"}'
echo "5 no auth (expect 401):"; curl -s -H "apikey: $K" -X POST $U/functions/v1/download-video -d "{\"contentId\":\"$FREE_ID\"}" -w " [%{http_code}]\n"
echo "6 download-start premium (expect 403, same rule):"; fn download-start "{\"contentId\":\"$PREMIUM_ID\",\"deviceId\":\"$DEV\"}"
echo "7 download-start free (expect manifest WITHOUT videoUrl):"
curl -s "${h[@]}" -X POST $U/functions/v1/download-start -d "{\"contentId\":\"$FREE_ID\",\"deviceId\":\"$DEV\"}" \
  | python3 -c "import json,sys;m=json.load(sys.stdin)['manifest'];print('has videoUrl:', 'videoUrl' in m, '| expires set:', m['license']['expiresAt']>0)"
echo "8 direct license expiry edit (expect 403):"
curl -s "${h[@]}" -X PATCH "$U/rest/v1/download_licenses?user_id=eq.$UID_" -d '{"expires_at":"2099-01-01T00:00:00Z"}' -w " [%{http_code}]\n"
echo "9 direct license insert (expect 403):"
curl -s "${h[@]}" -X POST "$U/rest/v1/download_licenses" -d "{\"user_id\":\"$UID_\",\"content_id\":\"$PREMIUM_ID\",\"device_id\":\"x\",\"expires_at\":\"2099-01-01T00:00:00Z\",\"encrypted_key\":\"x\"}" -w " [%{http_code}]\n"
rpc() { curl -s "${h[@]}" -X POST $U/rest/v1/rpc/complete_download_license -d "{\"_content_id\":\"$1\",\"_episode_id\":null,\"_device_id\":\"$DEV\",\"_total_size\":1234}"; echo; }
echo "10 complete issued license (expect true):"; rpc "$FREE_ID"
echo "11 complete again (expect false):"; rpc "$FREE_ID"
echo "12 complete never-issued license (expect false):"; rpc "$PREMIUM_ID"
echo "13 cleanup own license (expect 204):"; curl -s "${h[@]}" -X DELETE "$U/rest/v1/download_licenses?device_id=eq.$DEV" -w " [%{http_code}]\n"
