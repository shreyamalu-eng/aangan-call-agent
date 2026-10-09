import { fetchJson } from "./http";

const api = (method: string) => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${t}/${method}`;
};
const post = (method: string, body: unknown) =>
  fetchJson<any>(api(method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type Button = { text: string; callback_data?: string; url?: string };

export async function send(chatId: string | number, html: string, buttons?: Button[][]) {
  const r = await post("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: buttons ? { inline_keyboard: buttons } : undefined });
  return r.result as { message_id: number; chat: { id: number } };
}

export async function edit(chatId: string | number, messageId: number, html: string, buttons?: Button[][]) {
  return post("editMessageText", { chat_id: chatId, message_id: messageId, text: html, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: buttons ?? [] } });
}

export async function answer(callbackQueryId: string, text: string) {
  return post("answerCallbackQuery", { callback_query_id: callbackQueryId, text, show_alert: false });
}

/** Breakage and SLA alerts go to the alert chat (falls back to the designers' group). */
export async function alert(html: string) {
  const chat = process.env.TELEGRAM_ALERT_CHAT_ID || process.env.TELEGRAM_DESIGNERS_CHAT_ID;
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return null;
  try { return await send(chat, html); } catch { return null; }
}

export async function setWebhook(url: string) {
  return post("setWebhook", { url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["callback_query", "message"] });
}
