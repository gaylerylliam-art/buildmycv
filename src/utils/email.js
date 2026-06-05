import emailjs from "@emailjs/browser";

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const isEmailJsConfigured = Boolean(serviceId && templateId && publicKey);

export async function sendContactEmail(formElement) {
  if (!isEmailJsConfigured) {
    throw new Error("EmailJS is not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY.");
  }

  return emailjs.sendForm(serviceId, templateId, formElement, { publicKey });
}
