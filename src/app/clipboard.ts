import { ref } from "vue";

/** Copies text and exposes a short-lived `copied` flag for button feedback. */
export function useCopy(duration = 1500) {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), duration);
  }

  return { copied, copy };
}
