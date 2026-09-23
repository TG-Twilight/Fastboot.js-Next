<script setup lang="ts">
import AppIcon, { type IconName } from "./AppIcon.vue";

defineProps<{ title?: string; icon?: IconName }>();
</script>

<template>
  <section class="app-card">
    <header class="app-card-head">
      <slot name="header">
        <AppIcon v-if="icon" :name="icon" />
        <h2>{{ title }}</h2>
      </slot>
      <div v-if="$slots.actions" class="app-card-actions"><slot name="actions" /></div>
    </header>
    <div class="app-card-body"><slot /></div>
  </section>
</template>

<style>
.app-card {
  min-width: 0;
  border-radius: var(--radius-card);
  background: var(--surface-low);
}

.app-card-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--card-head);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--outline-variant);
  color: var(--on-surface-variant);
}

.app-card-head h2 {
  flex: 1;
  min-width: 0;
  color: var(--on-surface);
  font-size: 1rem;
  font-weight: 600;
}

.app-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
}

.app-card-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  padding: var(--space-4);
}
</style>
