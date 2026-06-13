import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const SAVED_CV_LIMIT = 10;
export const SAVED_CV_RETENTION_DAYS = 14;

export async function submitContactMessage({ name, email, message }) {
  const response = await fetch("/.netlify/functions/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, message }),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && result.ok) return result;

  if (!supabase) {
    throw new Error(result.message || "Could not send message. Please try again later.");
  }
  const { error } = await supabase.from("contact_messages").insert({ name, email, message });
  if (error) throw error;
  return { ok: true, stored: true, forwarded: false };
}

export async function uploadProfilePhoto(userId, dataUrl) {
  if (!supabase || !userId || !dataUrl) return { path: "", publicUrl: dataUrl };
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const path = `${userId}/profile-${Date.now()}.png`;
  const { error } = await supabase.storage.from("profile-photos").upload(path, blob, {
    contentType: blob.type || "image/png",
    upsert: true,
  });
  if (error) throw error;
  return { path, publicUrl: dataUrl };
}

export async function saveCvForUser({ userId, cv, categoryId, themeId, layoutId }) {
  if (!supabase || !userId) throw new Error("Supabase is not configured.");
  await deleteExpiredUserCvs(userId);
  const { count, error: countError } = await supabase
    .from("cvs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;
  if ((count || 0) >= SAVED_CV_LIMIT) {
    throw new Error(`You can save up to ${SAVED_CV_LIMIT} CVs. Delete one before saving another.`);
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count: todayCount, error: todayCountError } = await supabase
    .from("cvs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString());
  if (todayCountError) throw todayCountError;
  if ((todayCount || 0) >= SAVED_CV_LIMIT) {
    throw new Error(`You can generate and save up to ${SAVED_CV_LIMIT} CVs per day. Please try again tomorrow.`);
  }
  const expiresAt = new Date(Date.now() + SAVED_CV_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const row = {
    user_id: userId,
    title: cv.fullName ? `${cv.fullName} CV` : "My CV",
    category_id: categoryId,
    cv_data: cv,
    theme_id: themeId,
    layout_id: layoutId,
    expires_at: expiresAt,
  };
  const insert = (payload) => supabase.from("cvs").insert(payload).select().single();
  let { data, error } = await insert(row);
  if (error && /expires_at/i.test(error.message || "")) {
    const { expires_at, ...legacyRow } = row;
    ({ data, error } = await insert(legacyRow));
  }
  if (error) throw error;
  return data;
}

export async function deleteExpiredUserCvs(userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase
    .from("cvs")
    .delete()
    .eq("user_id", userId)
    .lte("expires_at", new Date().toISOString());
  if (error && !/expires_at/i.test(error.message || "")) throw error;
}

export async function saveDraftForUser({ userId, draftData }) {
  if (!supabase || !userId) throw new Error("Supabase is not configured.");
  const { data: existing, error: findError } = await supabase
    .from("cv_drafts")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (findError) throw findError;

  if (existing?.[0]?.id) {
    const { data, error } = await supabase
      .from("cv_drafts")
      .update({ draft_data: draftData })
      .eq("id", existing[0].id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("cv_drafts")
    .insert({ user_id: userId, draft_data: draftData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadLatestDraftForUser(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from("cv_drafts")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listUserCvs(userId) {
  if (!supabase || !userId) return [];
  await deleteExpiredUserCvs(userId);
  let { data, error } = await supabase
    .from("cvs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error && /expires_at/i.test(error.message || "")) {
    ({ data, error } = await supabase
      .from("cvs")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }));
  }
  if (error) throw error;
  return data || [];
}

export async function deleteUserCv(id) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("cvs").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateUserCv(item) {
  if (!supabase || !item) return null;
  await deleteExpiredUserCvs(item.user_id);
  const { count, error: countError } = await supabase.from("cvs").select("id", { count: "exact", head: true }).eq("user_id", item.user_id);
  if (countError) throw countError;
  if ((count || 0) >= SAVED_CV_LIMIT) throw new Error(`You can save up to ${SAVED_CV_LIMIT} CVs. Delete one before duplicating another.`);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count: todayCount, error: todayCountError } = await supabase
    .from("cvs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", item.user_id)
    .gte("created_at", startOfToday.toISOString());
  if (todayCountError) throw todayCountError;
  if ((todayCount || 0) >= SAVED_CV_LIMIT) throw new Error(`You can generate and save up to ${SAVED_CV_LIMIT} CVs per day. Please try again tomorrow.`);
  const expiresAt = new Date(Date.now() + SAVED_CV_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const row = {
    user_id: item.user_id,
    title: `${item.title || "My CV"} Copy`,
    category_id: item.category_id,
    cv_data: item.cv_data,
    theme_id: item.theme_id,
    layout_id: item.layout_id,
    profile_photo_path: item.profile_photo_path,
    expires_at: expiresAt,
  };
  const insert = (payload) => supabase.from("cvs").insert(payload).select().single();
  let { data, error } = await insert(row);
  if (error && /expires_at/i.test(error.message || "")) {
    const { expires_at, ...legacyRow } = row;
    ({ data, error } = await insert(legacyRow));
  }
  if (error) throw error;
  return data;
}
