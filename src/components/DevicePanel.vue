<script setup lang="ts">
import { computed } from "vue";
import { connect, disconnect, isBusy, isConnected, reboot, session, setActiveSlot } from "@/app/session";
import type { RebootTarget } from "@/fastboot/device";
import { t, type MessageKey } from "@/i18n";
import AppIcon from "./AppIcon.vue";

defineProps<{ supported: boolean }>();

const targets: RebootTarget[] = ["system", "bootloader", "fastboot", "recovery"];

const rows = computed(() => {
  const s = session.summary;
  if (!s) return [];
  const flag = (value: boolean | null) => (value === null ? "—" : t(value ? "yes" : "no"));
  const list: [MessageKey, string][] = [
    ["device.product", s.product || "—"],
    ["device.serial", s.serial || "—"],
    ["device.mode", t(s.mode === "fastbootd" ? "device.mode.fastbootd" : "device.mode.bootloader")],
    ["device.unlocked", flag(s.unlocked)]
  ];
  if (s.slot) list.push(["device.slot", s.slot.toUpperCase()]);
  if (s.bootloaderVersion) list.push(["device.bootloaderVersion", s.bootloaderVersion]);
  if (s.basebandVersion) list.push(["device.basebandVersion", s.basebandVersion]);
  return list;
});
</script>

<template>
  <section class="card stack device">
    <header class="row head">
      <AppIcon name="usb" :size="24" />
      <h2>{{ t("device.title") }}</h2>
      <span class="status" :data-state="session.state">{{ t(`device.state.${session.state}`) }}</span>
    </header>

    <p v-if="!isConnected && session.state !== 'reconnecting'" class="hint">{{ t("device.hint") }}</p>

    <dl v-if="rows.length" class="summary">
      <template v-for="[label, value] in rows" :key="label">
        <dt>{{ t(label) }}</dt>
        <dd class="mono">{{ value }}</dd>
      </template>
    </dl>

    <div class="row">
      <button v-if="!isConnected" class="btn" :disabled="!supported || isBusy" @click="connect">
        <AppIcon name="usb" />{{ t("device.connect") }}
      </button>
      <button v-else class="btn outlined" :disabled="isBusy" @click="disconnect">
        {{ t("device.disconnect") }}
      </button>
    </div>

    <template v-if="isConnected">
      <div class="stack section">
        <h3 class="row"><AppIcon name="power" :size="18" />{{ t("device.reboot") }}</h3>
        <div class="row">
          <button v-for="target in targets" :key="target" class="btn tonal small" :disabled="isBusy" @click="reboot(target)">
            {{ t(`device.reboot.${target}`) }}
          </button>
        </div>
      </div>

      <div v-if="session.summary?.slot" class="stack section">
        <h3>{{ t("device.setActive") }}</h3>
        <div class="segmented">
          <button
            v-for="slot in ['a', 'b'] as const"
            :key="slot"
            :aria-pressed="session.summary.slot === slot"
            :disabled="isBusy || session.summary.slot === slot"
            @click="setActiveSlot(slot)"
          >
            {{ slot.toUpperCase() }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.head {
  gap: 10px;
}

.head h2 {
  flex: 1;
}

.status {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface-high);
  color: var(--on-surface-variant);
  font-size: 0.85em;
}

.status[data-state="connected"] {
  background: var(--primary-container);
  color: var(--on-primary-container);
}

.status[data-state="connecting"],
.status[data-state="reconnecting"] {
  background: var(--warn-container);
  color: var(--on-warn-container);
}

.summary {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0;
}

.summary dt {
  color: var(--on-surface-variant);
}

.summary dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.section {
  padding-top: 12px;
  border-top: 1px solid var(--outline-variant);
}

.section h3 {
  gap: 6px;
  color: var(--on-surface-variant);
  font-size: 0.9rem;
}
</style>
