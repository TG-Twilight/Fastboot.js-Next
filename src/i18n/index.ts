import { ref, watchEffect } from "vue";
import enUS from "./en-US";
import zhCN from "./zh-CN";

export type MessageKey = keyof typeof enUS;
export type Messages = Record<MessageKey, string>;
export type Locale = "zh-CN" | "en-US";

const messages: Record<Locale, Messages> = { "zh-CN": zhCN, "en-US": enUS };
const STORAGE_KEY = "fastboot-next:locale";

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "zh-CN" || saved === "en-US") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export const locale = ref<Locale>(initialLocale());

watchEffect(() => {
  localStorage.setItem(STORAGE_KEY, locale.value);
  document.documentElement.lang = locale.value;
});

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[locale.value][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function toggleLocale(): void {
  locale.value = locale.value === "zh-CN" ? "en-US" : "zh-CN";
}
