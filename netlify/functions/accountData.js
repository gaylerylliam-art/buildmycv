import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role credentials are not configured.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

const getUser = async (supabase, event) => {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new Error("Sign in is required.");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Please sign in again.");
  return data.user;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST." });
  try {
    const supabase = getSupabase();
    const user = await getUser(supabase, event);
    const payload = JSON.parse(event.body || "{}");
    if (payload.action !== "delete-account") return json(400, { ok: false, message: "Unsupported action." });

    await supabase.from("cv_drafts").delete().eq("user_id", user.id);
    await supabase.from("cvs").delete().eq("user_id", user.id);
    await supabase.storage.from("profile-photos").remove([`${user.id}`]).catch(() => {});
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return json(200, { ok: true, message: "Account and saved CV data deleted." });
  } catch (error) {
    return json(400, { ok: false, message: error.message || "Could not update account data." });
  }
};
