const wordCount = (value = "") => String(value || "").trim().split(/\s+/).filter(Boolean).length;

export function getSmartTip(field, value = "") {
  const text = String(value || "");
  if (field === "summary" && /\b(i|my)\b/i.test(text)) {
    return "Rewrite without first-person words: use 'Experienced sales executive' instead of 'I am...'.";
  }
  if (field === "experience" && text.trim() && wordCount(text) < 20) {
    return "Too short. Add what you achieved, not only what you did.";
  }
  if (field === "skills" && text.trim().split(/[\n,;]+/).filter(Boolean).length < 5) {
    return "Add more skills. ATS systems match keywords here.";
  }
  if (field === "phone" && text.trim() && !/^\+\d/.test(text.trim())) {
    return "Add your country code, for example +971, so recruiters can call easily.";
  }
  if (field === "email" && /(cool|cute|baby|love|\d{5,})/i.test(text)) {
    return "Use a simple email if possible, like firstname.lastname@gmail.com.";
  }
  return "";
}
