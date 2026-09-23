<script setup lang="ts">
import { computed } from "vue";
import { cancelTask, session } from "@/app/session";
import { t } from "@/i18n";

const percent = computed(() => {
  const progress = session.task?.progress;
  return progress === null || progress === undefined ? null : Math.round(progress * 100);
});
</script>

<template>
  <section v-if="session.task" class="task" role="status" aria-live="polite">
    <div class="row head">
      <strong class="title">{{ session.task.title }}</strong>
      <span v-if="session.task.stepTotal" class="hint">
        {{ t("task.step", { index: session.task.stepIndex ?? 0, total: session.task.stepTotal }) }}
      </span>
      <span v-if="percent !== null" class="mono">{{ percent }}%</span>
      <button v-if="session.task.cancellable" class="btn outlined small" @click="cancelTask">{{ t("task.cancel") }}</button>
    </div>
    <p v-if="session.task.step" class="step">{{ session.task.step }}</p>
    <div class="bar" :class="{ indeterminate: percent === null }">
      <div class="fill" :style="percent === null ? undefined : { width: `${percent}%` }" />
    </div>
  </section>
</template>

<style scoped>
.task {
  display: grid;
  gap: 8px;
  padding: 16px 20px;
  border-radius: var(--radius-l);
  background: var(--primary-container);
  color: var(--on-primary-container);
}

.head {
  gap: 12px;
}

.title {
  flex: 1;
  font-weight: 500;
}

.hint {
  color: inherit;
  opacity: 0.8;
}

.step {
  margin: 0;
}

.bar {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: color-mix(in srgb, var(--primary) 25%, transparent);
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transition: width 0.2s;
}

.indeterminate .fill {
  position: absolute;
  width: 35%;
  animation: slide 1.4s ease-in-out infinite;
}

@keyframes slide {
  from {
    left: -35%;
  }
  to {
    left: 100%;
  }
}

.btn.outlined {
  border-color: currentColor;
  color: inherit;
}
</style>
