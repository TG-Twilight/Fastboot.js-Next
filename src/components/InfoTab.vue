<script setup lang="ts">
import { computed, ref } from "vue";
import { factGroups, notices } from "@/app/deviceFacts";
import { isBusy, isConnected, profile, refresh, session } from "@/app/session";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const filter = ref("");

const groups = computed(() => (profile.value ? factGroups(profile.value, session.manufacturer) : []));
const alerts = computed(() => (profile.value ? notices(profile.value) : []));

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
    <p v-if="!profile" class="hint empty">{{ t("info.empty") }}</p>

    <template v-else>
      <div class="row toolbar">
        <button class="btn tonal small" :disabled="!isConnected || isBusy" @click="refresh">
          <AppIcon name="refresh" :size="18" />{{ t("info.refresh") }}
        </button>
      </div>

      <div v-for="(alert, i) in alerts" :key="i" class="banner" :class="alert.tone === 'bad' ? 'error' : alert.tone === 'info' ? 'info' : ''">
        <AppIcon :name="alert.tone === 'info' ? 'info' : 'warning'" />
        <span>{{ alert.text }}</span>
      </div>

      <div class="groups">
        <section v-for="group in groups" :key="group.title" class="group">
          <h3>{{ t(group.title) }}</h3>
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
        <div class="stack">
          <p class="hint">{{ t("info.allVariablesHint") }}</p>
          <div class="row">
            <input v-model="filter" class="input filter" type="search" :placeholder="t('info.filter')" :aria-label="t('info.filter')" />
            <button class="btn outlined small" @click="copyAll"><AppIcon name="copy" :size="18" />{{ t("info.copy") }}</button>
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
  </div>
</template>

<style scoped>
.empty {
  padding: 32px 0;
  text-align: center;
}

.toolbar {
  justify-content: flex-end;
}

.banner.info {
  background: var(--surface-high);
  color: var(--on-surface);
}

.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.group {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 16px;
  border-radius: var(--radius-m);
  background: var(--surface-mid);
}

.group h3 {
  color: var(--primary);
  font-size: 0.9rem;
}

.group dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.fact {
  display: grid;
  gap: 1px;
}

.fact dt {
  color: var(--on-surface-variant);
  font-size: 0.85em;
}

.fact dd {
  margin: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.fact dd[data-tone="good"] {
  color: var(--success);
}

.fact dd[data-tone="warn"] {
  color: #b86e00;
}

:root[data-theme="dark"] .fact dd[data-tone="warn"] {
  color: #ffb95c;
}

.fact dd[data-tone="bad"] {
  color: var(--error);
}

.raw summary {
  padding: 8px 0;
  color: var(--on-surface-variant);
  cursor: pointer;
}

.raw[open] summary {
  margin-bottom: 8px;
}

.filter {
  flex: 1;
  min-width: 160px;
}

.table-wrap {
  max-height: 420px;
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
