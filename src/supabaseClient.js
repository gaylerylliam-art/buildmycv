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

export async function submitContactMessage({ name, email, message }) {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  const { error } = await supabase.from("contact_messages").insert({ name, email, message });
  if (error) throw error;
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
  const { count, error: countError } = await supabase
    .from("cvs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;
  if ((count || 0) >= 5) {
    throw new Error("You can save up to 5 CVs. Delete one before saving another.");
  }
  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      title: cv.fullName ? `${cv.fullName} CV` : "My CV",
      category_id: categoryId,
      cv_data: cv,
      theme_id: themeId,
      layout_id: layoutId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listUserCvs(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("cvs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
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
  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: item.user_id,
      title: `${item.title || "My CV"} Copy`,
      category_id: item.category_id,
      cv_data: item.cv_data,
      theme_id: item.theme_id,
      layout_id: item.layout_id,
      profile_photo_path: item.profile_photo_path,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
