// Shared offline-download entitlement + source-URL safety, used by
// download-start and download-video so both enforce the same rules.
// deno-lint-ignore-file no-explicit-any

export const ALLOWED_MEDIA_HOSTS = ["digitaloceanspaces.com", "supabase.co"];

/** Exact host or a true dot-boundary subdomain of an allowed host. HTTPS only. */
export function isAllowedMediaUrl(raw: string, hosts = ALLOWED_MEDIA_HOSTS): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  return hosts.some((d) => h === d || h.endsWith("." + d));
}

/** Fetch, following at most 3 redirects, re-validating every hop against the allowlist. */
export async function fetchAllowed(url: string, headers: Record<string, string>): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    if (!isAllowedMediaUrl(current)) throw new Error("SOURCE_NOT_ALLOWED");
    const res = await fetch(current, { headers, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel();
      if (!loc) throw new Error("SOURCE_NOT_ALLOWED");
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("SOURCE_NOT_ALLOWED");
}

export type Entitlement = { ok: true; subscriptionExpiry: string | null } | { ok: false; status: number; error: string; code: string };

/**
 * Established policy: admins always; paid titles → buyers only;
 * premium titles → active subscribers; free titles → any signed-in user.
 * "Active subscription" = is_subscribed AND (no expiry OR expiry in future).
 */
export async function checkDownloadEntitlement(admin: any, userId: string, contentId: string, premium: boolean): Promise<Entitlement> {
  const { data: prof } = await admin.from("profiles").select("is_subscribed, subscription_expiry").eq("id", userId).maybeSingle();
  const expiry: string | null = prof?.subscription_expiry ?? null;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (roles?.some((r: any) => r.role === "admin" || r.role === "super_admin")) return { ok: true, subscriptionExpiry: expiry };
  const { data: paid, error: paidErr } = await admin.from("paid_content").select("id")
    .eq("content_id", contentId).eq("is_active", true).eq("is_free", false).limit(1);
  if (paidErr) return { ok: false, status: 503, error: "Entitlement check failed", code: "CHECK_FAILED" };
  if (paid && paid.length > 0) {
    const { data: bought } = await admin.rpc("has_purchased_content", { _user_id: userId, _content_id: contentId });
    return bought === true ? { ok: true, subscriptionExpiry: null }
      : { ok: false, status: 403, error: "Purchase required to download", code: "PURCHASE_REQUIRED" };
  }
  if (premium) {
    const active = !!prof?.is_subscribed && (!expiry || new Date(expiry) > new Date());
    if (!active) return { ok: false, status: 403, error: "Active subscription required to download", code: "NO_SUBSCRIPTION" };
  }
  return { ok: true, subscriptionExpiry: expiry };
}
