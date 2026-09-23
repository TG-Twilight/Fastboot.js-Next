<script setup lang="ts">
import { shallowRef, watch, type Component } from "vue";
import "@/app/theme";
import { isWebUsbSupported } from "@/fastboot/transport";
import { t, type MessageKey } from "@/i18n";
import AppCard from "./components/AppCard.vue";
import AppHeader from "./components/AppHeader.vue";
import AppIcon, { type IconName } from "./components/AppIcon.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ConsoleTab from "./components/ConsoleTab.vue";
import DevicePanel from "./components/DevicePanel.vue";
import FactoryTab from "./components/FactoryTab.vue";
import FlashTab from "./components/FlashTab.vue";
import InfoTab from "./components/InfoTab.vue";
import LogPanel from "./components/LogPanel.vue";
import ReconnectDialog from "./components/ReconnectDialog.vue";
import TaskPanel from "./components/TaskPanel.vue";

const supported = isWebUsbSupported();
const secure = window.isSecureContext;

const tabs: { id: string; label: MessageKey; icon: IconName; component: Component }[] = [
  { id: "info", label: "tabs.info", icon: "info", component: InfoTab },
  { id: "flash", label: "tabs.flash", icon: "flash", component: FlashTab },
  { id: "factory", label: "tabs.factory", icon: "archive", component: FactoryTab },
  { id: "console", label: "tabs.console", icon: "terminal", component: ConsoleTab }
];
// The hash keeps the tab across reloads and makes it linkable, e.g. #factory.
const active = shallowRef(tabs.find((tab) => `#${tab.id}` === location.hash) ?? tabs[0]);
watch(active, (tab) => history.replaceState(null, "", `#${tab.id}`));
</script>

<template>
  <AppHeader />

  <div class="page">
    <div v-if="!secure" class="banner error" role="alert">
      <AppIcon name="warning" /><span>{{ t("support.insecure") }}</span>
    </div>
    <div v-else-if="!supported" class="banner error" role="alert">
      <AppIcon name="warning" /><span>{{ t("support.noWebUsb") }}</span>
    </div>

    <main class="layout">
      <aside class="sidebar">
        <DevicePanel :supported="supported && secure" />
      </aside>

      <div class="content">
        <TaskPanel />

        <AppCard class="workspace">
          <template #header>
            <nav class="tabs" role="tablist">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                role="tab"
                class="tab"
                :aria-selected="active.id === tab.id"
                @click="active = tab"
              >
                <AppIcon :name="tab.icon" :size="18" />{{ t(tab.label) }}
              </button>
            </nav>
          </template>
          <KeepAlive>
            <component :is="active.component" />
          </KeepAlive>
        </AppCard>

        <LogPanel />
      </div>
    </main>

    <footer class="hint footer">{{ t("footer.license") }} {{ t("footer.warning") }}</footer>
  </div>

  <ConfirmDialog />
  <ReconnectDialog />
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-4);
}

.layout {
  display: grid;
  grid-template-columns: var(--sidebar) minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
}

.sidebar {
  position: sticky;
  top: calc(64px + var(--space-4));
}

.content {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-3);
  }

  .layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .content {
    gap: var(--space-3);
  }

  .sidebar {
    position: static;
  }
}

/* The tab strip replaces the card title, so it spans the header edge to edge. */
.workspace :deep(.app-card-head) {
  padding: 0 var(--space-2);
}

.tabs {
  display: flex;
  align-self: stretch;
  gap: var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: -1px;
  padding: 0 var(--space-3);
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--on-surface-variant);
  font: inherit;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.tab:hover {
  color: var(--on-surface);
}

.tab[aria-selected="true"] {
  border-bottom-color: var(--primary);
  color: var(--primary);
}

.footer {
  padding-bottom: var(--space-2);
  text-align: center;
}
</style>
