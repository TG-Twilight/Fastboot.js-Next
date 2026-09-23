<script setup lang="ts">
import { computed, ref } from "vue";
import { isBusy, isConnected, refresh, session } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const filter = ref("");

const rows = computed(() => {
  const query = filter.value.trim().toLowerCase();
  if (!query) return session.variables;
  return session.variables.filter(([name, value]) => name.toLowerCase().includes(query) || value.toLowerCase().includes(query));
});

function copyAll() {
  void navigator.clipboard.writeText(session.variables.map(([name, value]) => `${name}: ${value}`).join("\n"));
}
</script>

<template>
  <div class="stack">
    <div class="row">
      <input v-model="filter" class="input filter" type="search" :placeholder="t('info.filter')" :aria-label="t('info.filter')" />
      <button class="btn tonal" :disabled="!isConnected || isBusy" @click="refresh">
        <AppIcon name="refresh" />{{ t("info.refresh") }}
      </button>
      <button class="btn outlined" :disabled="session.variables.length === 0" @click="copyAll">
        <AppIcon name="copy" />{{ t("info.copy") }}
      </button>
    </div>

    <p v-if="session.variables.length === 0" class="hint empty">{{ t("info.empty") }}</p>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t("info.name") }}</th>
            <th>{{ t("info.value") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[name, value] in rows" :key="name">
            <td class="mono">{{ name }}</td>
            <td class="mono">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.filter {
  flex: 1;
  min-width: 160px;
}

.empty {
  padding: 32px 0;
  text-align: center;
}

.table-wrap {
  max-height: 480px;
  overflow: auto;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-m);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 6px 12px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

th {
  position: sticky;
  top: 0;
  background: var(--surface-high);
  font-weight: 500;
}

tbody tr:nth-child(even) {
  background: var(--surface-mid);
}

td:first-child {
  width: 40%;
  color: var(--on-surface-variant);
}
</style>
