import { ref, watchEffect } from "vue";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "fastboot-next:theme";
const modes: ThemeMode[] = ["system", "light", "dark"];
const media = window.matchMedia("(prefers-color-scheme: dark)");

const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
export const themeMode = ref<ThemeMode>(saved && modes.includes(saved) ? saved : "system");
const systemDark = ref(media.matches);
media.addEventListener("change", (event) => (systemDark.value = event.matches));

watchEffect(() => {
  localStorage.setItem(STORAGE_KEY, themeMode.value);
  const dark = themeMode.value === "dark" || (themeMode.value === "system" && systemDark.value);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
});

export function cycleTheme(): void {
  themeMode.value = modes[(modes.indexOf(themeMode.value) + 1) % modes.length];
}
