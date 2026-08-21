// Shared homepage-suggestion applier used by both the manual approve endpoint
// and the AI autopilot inside ai-homepage-audit.
// deno-lint-ignore-file no-explicit-any

export interface ApplyResult {
  ok: boolean;
  already_applied?: boolean;
  change_log_id?: string | null;
}

export async function applyHomepageSuggestion(
  admin: any,
  suggestionId: string,
  appliedBy: string | null,
  autoApplied: boolean,
): Promise<ApplyResult> {
  const { data: sug, error: sugErr } = await admin
    .from("homepage_ai_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .single();
  if (sugErr || !sug) throw new Error("Suggestion not found");
  if (sug.status === "applied") return { ok: true, already_applied: true };

  const payload = sug.proposed_payload ?? {};
  let previousState: Record<string, unknown> = {};

  if (sug.suggestion_type === "new_section") {
    // Never create a row that duplicates an existing active row title.
    const desiredTitle = String(payload.title ?? "New Section").trim();
    const { data: dupes } = await admin.from("home_sections").select("id,title,is_active");
    const norm = (t: unknown) => String(t ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if ((dupes ?? []).some((s: any) => s.is_active && norm(s.title) === norm(desiredTitle))) {
      throw new Error(`A homepage row named "${desiredTitle}" already exists`);
    }
    let genreId: string | null = null;
    if (payload.genre_name) {
      const { data: g } = await admin
        .from("genres").select("id").ilike("name", String(payload.genre_name)).maybeSingle();
      if (g) genreId = g.id;
    }
    const { data: maxOrder } = await admin
      .from("home_sections").select("display_order")
      .order("display_order", { ascending: false }).limit(1).maybeSingle();
    const nextOrder = ((maxOrder?.display_order as number | undefined) ?? 0) + 1;

    const { data: created, error: insErr } = await admin.from("home_sections").insert({
      title: desiredTitle,
      section_type: String(payload.section_type ?? "genre"),
      genre_id: genreId,
      card_style: String(payload.card_style ?? "full"),
      card_size: String(payload.card_size ?? "md"),
      max_items: Math.max(1, Math.min(50, Number(payload.max_items) || 15)),
      display_order: nextOrder,
      is_active: true,
      show_on_desktop: true,
      show_on_mobile: true,
      show_on_kids: false,
      is_curated: Array.isArray(payload.content_ids) && payload.content_ids.length > 0,
      allow_duplicates: false,
    }).select("id").single();
    if (insErr) throw insErr;

    // Optional seeded content (trend-driven sections)
    const ids: string[] = [...new Set(Array.isArray(payload.content_ids) ? payload.content_ids : [])];
    if (created?.id && ids.length > 0) {
      const max = Math.max(1, Math.min(50, Number(payload.max_items) || 15));
      const rows = ids.slice(0, max).map((cid, i) => ({
        section_id: created.id,
        content_id: cid,
        display_order: i + 1,
      }));
      await admin.from("section_content").insert(rows);
    }
    previousState = { created_section_id: created?.id ?? null };
  } else if (sug.suggestion_type === "content_swap") {
    const sectionId = sug.target_section_id ?? payload.section_id;
    if (!sectionId) throw new Error("content_swap requires a target section");
    const ids: string[] = [...new Set(Array.isArray(payload.content_ids) ? payload.content_ids : [])];
    if (ids.length === 0) throw new Error("content_swap requires content_ids");

    const { data: section } = await admin
      .from("home_sections").select("id,max_items").eq("id", sectionId).maybeSingle();
    if (!section) throw new Error("Target section not found");

    // Respect the admin-configured max_items — the AI never overrides layout limits.
    const max = Math.max(1, Number(section.max_items) || 20);

    const { data: prev } = await admin
      .from("section_content").select("content_id,display_order")
      .eq("section_id", sectionId).order("display_order");
    previousState = { section_id: sectionId, section_content: prev ?? [] };

    // Only keep IDs that exist in the catalog.
    const { data: valid } = await admin.from("content").select("id").in("id", ids.slice(0, 100));
    const validIds = new Set((valid ?? []).map((c: any) => c.id));
    const finalIds = ids.filter((id) => validIds.has(id)).slice(0, max);
    if (finalIds.length === 0) throw new Error("No valid content in swap payload");

    await admin.from("section_content").delete().eq("section_id", sectionId);
    await admin.from("section_content").insert(
      finalIds.map((cid, i) => ({ section_id: sectionId, content_id: cid, display_order: i + 1 })),
    );
  } else if (sug.suggestion_type === "reorder") {
    const orderedTitles: string[] = Array.isArray(payload.ordered_titles) ? payload.ordered_titles : [];
    if (orderedTitles.length === 0) throw new Error("Empty reorder list");
    const { data: existing } = await admin.from("home_sections").select("id,title,display_order");
    previousState = { sections: existing ?? [] };
    const titleToId = new Map((existing ?? []).map((s: any) => [s.title, s.id]));
    let order = 1;
    for (const t of orderedTitles) {
      const id = titleToId.get(t);
      if (!id) continue;
      await admin.from("home_sections").update({ display_order: order++ }).eq("id", id);
    }
  } else if (sug.suggestion_type === "heal") {
    if (payload.action === "hide" && sug.target_section_id) {
      const { data: s } = await admin
        .from("home_sections").select("id,is_active").eq("id", sug.target_section_id).maybeSingle();
      previousState = { section: s ?? null };
      await admin.from("home_sections")
        .update({ is_active: false }).eq("id", sug.target_section_id);
    }
  }

  await admin.from("homepage_ai_suggestions").update({
    status: "applied",
    reviewed_by: appliedBy,
    reviewed_at: new Date().toISOString(),
    applied_at: new Date().toISOString(),
  }).eq("id", suggestionId);

  const { data: log } = await admin.from("ai_homepage_change_log").insert({
    suggestion_id: suggestionId,
    suggestion_type: sug.suggestion_type,
    target_section_id: sug.target_section_id ?? null,
    applied_payload: payload,
    previous_state: previousState,
    applied_by: appliedBy,
    auto_applied: autoApplied,
  }).select("id").maybeSingle();

  return { ok: true, change_log_id: log?.id ?? null };
}

export async function revertHomepageChange(admin: any, changeLogId: string, userId: string | null) {
  const { data: log, error } = await admin
    .from("ai_homepage_change_log").select("*").eq("id", changeLogId).single();
  if (error || !log) throw new Error("Change log entry not found");
  if (log.reverted_at) return { ok: true, already_reverted: true };

  const prev = log.previous_state ?? {};

  if (log.suggestion_type === "new_section" && prev.created_section_id) {
    await admin.from("section_content").delete().eq("section_id", prev.created_section_id);
    await admin.from("home_sections").delete().eq("id", prev.created_section_id);
  } else if (log.suggestion_type === "content_swap" && prev.section_id) {
    await admin.from("section_content").delete().eq("section_id", prev.section_id);
    const rows = (prev.section_content ?? []).map((r: any, i: number) => ({
      section_id: prev.section_id,
      content_id: r.content_id,
      display_order: r.display_order ?? i + 1,
    }));
    if (rows.length > 0) await admin.from("section_content").insert(rows);
  } else if (log.suggestion_type === "reorder" && Array.isArray(prev.sections)) {
    for (const s of prev.sections) {
      await admin.from("home_sections").update({ display_order: s.display_order }).eq("id", s.id);
    }
  } else if (log.suggestion_type === "heal" && prev.section) {
    await admin.from("home_sections")
      .update({ is_active: prev.section.is_active }).eq("id", prev.section.id);
  }

  await admin.from("ai_homepage_change_log").update({
    reverted_at: new Date().toISOString(),
    reverted_by: userId,
  }).eq("id", changeLogId);

  return { ok: true };
}
