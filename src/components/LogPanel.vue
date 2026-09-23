<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useCopy } from "@/app/clipboard";
import { clearLogs, formatLogs, logs } from "@/app/log";
import { t } from "@/i18n";
import AppCard from "./AppCard.vue";
import AppIcon from "./AppIcon.vue";

const list = ref<HTMLElement | null>(null);
const { copied, copy } = useCopy();

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

const time = (date: Date) => date.toLocaleTimeString(undefined, { hour12: false });
</script>

<template>
  <AppCard :title="t('log.title')" icon="terminal">
    <template #actions>
      <button class="icon-btn" :title="t('log.copy')" :aria-label="t('log.copy')" :disabled="!logs.length" @click="copy(formatLogs())">
        <AppIcon :name="copied ? 'check' : 'copy'" />
      </button>
      <button class="icon-btn" :title="t('log.clear')" :aria-label="t('log.clear')" :disabled="!logs.length" @click="clearLogs">
        <AppIcon name="delete" />
      </button>
    </template>

    <div ref="list" class="entries mono">
      <p v-if="!logs.length" class="hint">{{ t("log.empty") }}</p>
      <div v-for="entry in logs" :key="entry.id" class="entry" :data-level="entry.level">
        <time>{{ time(entry.time) }}</time>
        <span class="text">{{ entry.text }}</span>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.entries {
  height: 240px;
  overflow: auto;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-control);
  background: var(--surface);
  font-size: 12.5px;
}

.entry {
  display: flex;
  gap: var(--space-3);
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
  color: var(--warn);
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
