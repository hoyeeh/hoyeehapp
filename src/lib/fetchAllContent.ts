import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch ALL rows from the `content` table, paginating past Supabase's 1000-row
 * default cap. Pass any column projection (defaults to "*"). Optional `apply`
 * lets callers add filters/ordering to each page's query builder.
 */
export async function fetchAllContent<T = any>(
  columns: string = "*",
  apply?: (q: any) => any
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let all: T[] = [];
  let page = 0;
  // Cap pagination so a misconfigured table cannot loop forever.
  const MAX_PAGES = 100;

  while (page < MAX_PAGES) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q: any = supabase.from("content").select(columns);
    if (apply) q = apply(q);
    q = q.range(from, to);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data as T[]);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}
