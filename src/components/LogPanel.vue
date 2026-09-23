<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { clearLogs, formatLogs, logs } from "@/app/log";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const list = ref<HTMLElement | null>(null);

// Follow new entries unless the user scrolled up to read.
watch(
  () => logs.length,
  async () => {
    const el = list.value;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    await nextTick();
    if (atBottom) el.scrollTop = el.scrollHeight;
  }
);

function copy() {
  void navigator.clipboard.writeText(formatLogs());
}

const time = (date: Date) => date.toLocaleTimeString(undefined, { hour12: false });
</script>

<template>
  <section class="card log">
    <header class="row head">
      <h2>{{ t("log.title") }}</h2>
      <button class="icon-btn" :title="t('log.copy')" :aria-label="t('log.copy')" :disabled="!logs.length" @click="copy">
        <AppIcon name="copy" />
      </button>
      <button class="icon-btn" :title="t('log.clear')" :aria-label="t('log.clear')" :disabled="!logs.length" @click="clearLogs">
        <AppIcon name="delete" />
      </button>
    </header>
    <div ref="list" class="entries mono">
      <p v-if="!logs.length" class="hint">{{ t("log.empty") }}</p>
      <div v-for="entry in logs" :key="entry.id" class="entry" :data-level="entry.level">
        <time>{{ time(entry.time) }}</time>
        <span class="text">{{ entry.text }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.log {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 8px;
  min-height: 0;
}

.head h2 {
  flex: 1;
}

.entries {
  height: 260px;
  overflow: auto;
  padding: 8px 12px;
  border-radius: var(--radius-m);
  background: var(--surface);
  font-size: 12.5px;
}

.entry {
  display: flex;
  gap: 12px;
  padding: 1px 0;
}

.entry time {
  flex: none;
  color: var(--outline);
}

.text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

[data-level="command"] .text {
  color: var(--primary);
  font-weight: 600;
}

[data-level="success"] .text {
  color: var(--success);
}

[data-level="warn"] .text {
  color: var(--on-warn-container);
  background: var(--warn-container);
}

[data-level="error"] .text {
  color: var(--error);
}

[data-level="device"] .text {
  color: var(--on-surface-variant);
}

[data-level="device"] .text::before {
  content: "(device) ";
  color: var(--outline);
}
</style>
