<script setup lang="ts">
import { shallowRef, watch, type Component } from "vue";
import "@/app/theme";
import { isWebUsbSupported } from "@/fastboot/transport";
import { t, type MessageKey } from "@/i18n";
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
  <div class="app">
    <AppHeader />

    <div v-if="!secure" class="banner error" role="alert">
      <AppIcon name="warning" />{{ t("support.insecure") }}
    </div>
    <div v-else-if="!supported" class="banner error" role="alert">
      <AppIcon name="warning" />{{ t("support.noWebUsb") }}
    </div>

    <main class="layout">
      <DevicePanel :supported="supported && secure" />

      <div class="stack main">
        <TaskPanel />
        <section class="card workspace">
          <div class="tabs" role="tablist">
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
          </div>
          <div role="tabpanel" class="panel">
            <KeepAlive>
              <component :is="active.component" />
            </KeepAlive>
          </div>
        </section>
      </div>

      <LogPanel class="logs" />
    </main>

    <footer class="hint footer">
      {{ t("footer.license") }} {{ t("footer.warning") }}
    </footer>

    <ConfirmDialog />
    <ReconnectDialog />
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 20px 24px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  grid-template-areas:
    "device main"
    "logs logs";
  align-items: start;
  gap: 16px;
}

.layout > :first-child {
  grid-area: device;
}

.main {
  grid-area: main;
  gap: 16px;
}

.logs {
  grid-area: logs;
}

@media (max-width: 820px) {
  .app {
    padding: 0 12px 24px;
  }

  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "device"
      "main"
      "logs";
  }
}

.workspace {
  padding: 8px 20px 20px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin: 0 -8px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--outline-variant);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
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
  text-align: center;
}
</style>
