<script setup lang="ts">
import { ref } from "vue";
import { formatBytes } from "@/app/format";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

defineProps<{ accept?: string; disabled?: boolean }>();
const file = defineModel<File | null>({ required: true });
const dragging = ref(false);

function onChange(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  input.value = "";
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  const dropped = event.dataTransfer?.files[0];
  if (dropped) file.value = dropped;
}
</script>

<template>
  <label
    class="picker"
    :class="{ dragging, disabled }"
    @dragover.prevent="dragging = !disabled"
    @dragleave="dragging = false"
    @drop.prevent="!disabled && onDrop($event)"
  >
    <input type="file" class="visually-hidden" :accept="accept" :disabled="disabled" @change="onChange" />
    <AppIcon name="upload" :size="28" />
    <span v-if="file" class="name">
      <strong>{{ file.name }}</strong>
      <span class="hint">{{ formatBytes(file.size) }}</span>
    </span>
    <span v-else class="name">
      <strong>{{ t("file.choose") }}</strong>
      <span class="hint">{{ t("file.drop") }}</span>
    </span>
  </label>
</template>

<style scoped>
.picker {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px dashed var(--outline);
  border-radius: var(--radius-m);
  color: var(--on-surface-variant);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.picker:hover,
.picker.dragging {
  border-color: var(--primary);
  background: var(--surface-mid);
}

.picker:focus-within {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.picker.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.name {
  display: grid;
  min-width: 0;
}

.name strong {
  overflow: hidden;
  color: var(--on-surface);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
