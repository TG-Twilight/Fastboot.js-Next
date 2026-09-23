<script setup lang="ts">
import { computed, ref } from "vue";
import { useCopy } from "@/app/clipboard";
import { factGroups, factsToText, notices } from "@/app/deviceFacts";
import { isBusy, isConnected, profile, refresh, session } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const filter = ref("");
const summary = useCopy();
const raw = useCopy();

const groups = computed(() => (profile.value ? factGroups(profile.value, session.manufacturer) : []));
const alerts = computed(() => (profile.value ? notices(profile.value) : []));

const rows = computed(() => {
  const query = filter.value.trim().toLowerCase();
  if (!query) return session.variables;
  return session.variables.filter(([name, value]) => name.toLowerCase().includes(query) || value.toLowerCase().includes(query));
});

const bannerClass = { bad: "error", warn: "", info: "info" } as const;
</script>

<template>
  <p v-if="!profile" class="hint empty">{{ t("info.empty") }}</p>

  <template v-else>
    <div class="toolbar">
      <button class="btn tonal small" @click="summary.copy(factsToText(groups))">
        <AppIcon :name="summary.copied.value ? 'check' : 'copy'" :size="18" />
        {{ t(summary.copied.value ? "info.copied" : "info.copySummary") }}
      </button>
      <button class="btn outlined small" :disabled="!isConnected || isBusy" @click="refresh">
        <AppIcon name="refresh" :size="18" />{{ t("info.refresh") }}
      </button>
    </div>

    <div v-for="(alert, i) in alerts" :key="i" class="banner" :class="bannerClass[alert.tone]">
      <AppIcon :name="alert.tone === 'info' ? 'info' : 'warning'" />
      <span>{{ alert.text }}</span>
    </div>

    <div class="groups">
      <section v-for="group in groups" :key="group.title" class="group">
        <h3 class="group-title">{{ t(group.title) }}</h3>
        <dl>
          <div v-for="fact in group.facts" :key="fact.label" class="fact">
            <dt>{{ t(fact.label) }}</dt>
            <dd :data-tone="fact.tone">{{ fact.value }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <details class="raw">
      <summary>{{ t("info.allVariables", { count: session.variables.length }) }}</summary>
      <div class="raw-body">
        <p class="hint">{{ t("info.allVariablesHint") }}</p>
        <div class="row">
          <input v-model="filter" class="input filter" type="search" :placeholder="t('info.filter')" :aria-label="t('info.filter')" />
          <button class="btn outlined small" @click="raw.copy(session.variables.map(([n, v]) => `${n}: ${v}`).join('\n'))">
            <AppIcon :name="raw.copied.value ? 'check' : 'copy'" :size="18" />
            {{ t(raw.copied.value ? "info.copied" : "info.copy") }}
          </button>
        </div>
        <div class="table-wrap">
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
    </details>
  </template>
</template>

<style scoped>
.empty {
  padding: var(--space-5) 0;
  text-align: center;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-3);
}

.group {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-control);
  background: var(--surface);
  overflow: hidden;
}

.group-title {
  padding: var(--space-3) var(--space-3) var(--space-2);
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 600;
}

.group dl {
  margin: 0;
}

.fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--outline-variant);
}

.fact dt {
  flex: none;
  color: var(--on-surface-variant);
}

.fact dd {
  min-width: 0;
  margin: 0;
  font-weight: 500;
  text-align: right;
  overflow-wrap: anywhere;
}

.fact dd[data-tone="good"] {
  color: var(--success);
}

.fact dd[data-tone="warn"] {
  color: var(--warn);
}

.fact dd[data-tone="bad"] {
  color: var(--error);
}

.raw {
  border-top: 1px solid var(--outline-variant);
}

.raw summary {
  padding-top: var(--space-3);
  color: var(--on-surface-variant);
  cursor: pointer;
}

.raw-body {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
}

.filter {
  flex: 1;
  min-width: 160px;
}

.table-wrap {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius-control);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: var(--space-2) var(--space-3);
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
