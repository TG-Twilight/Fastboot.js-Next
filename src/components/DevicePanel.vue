<script setup lang="ts">
import { computed } from "vue";
import { lockFact, modeFact, slotFact } from "@/app/deviceFacts";
import { connect, disconnect, isBusy, isConnected, profile, reboot, session, setActiveSlot } from "@/app/session";
import type { RebootTarget } from "@/fastboot/device";
import { t } from "@/i18n";
import AppCard from "./AppCard.vue";
import AppIcon from "./AppIcon.vue";

defineProps<{ supported: boolean }>();

const targets: RebootTarget[] = ["system", "bootloader", "fastboot", "recovery"];

const chips = computed(() => {
  const p = profile.value;
  return p ? [modeFact(p), lockFact(p), slotFact(p)] : [];
});
</script>

<template>
  <AppCard :title="t('device.title')" icon="usb">
    <template #actions>
      <span class="status" :data-state="session.state">{{ t(`device.state.${session.state}`) }}</span>
    </template>

    <template v-if="!isConnected">
      <p v-if="session.state !== 'reconnecting'" class="hint">{{ t("device.hint") }}</p>
      <button class="btn block" :disabled="!supported || isBusy" @click="connect">
        <AppIcon name="usb" />{{ t("device.connect") }}
      </button>
    </template>

    <template v-else>
      <div class="section">
        <div class="identity">
          <strong class="codename mono">{{ profile?.codename ?? t("info.unknown") }}</strong>
          <span v-if="session.manufacturer" class="hint">{{ session.manufacturer }}</span>
        </div>
        <dl class="chips">
          <div v-for="chip in chips" :key="chip.label" class="chip" :data-tone="chip.tone">
            <dt>{{ t(chip.label) }}</dt>
            <dd>{{ chip.value }}</dd>
          </div>
        </dl>
      </div>

      <div class="section">
        <h3 class="section-title"><AppIcon name="power" :size="18" />{{ t("device.reboot") }}</h3>
        <div class="grid-2">
          <button v-for="target in targets" :key="target" class="btn tonal small" :disabled="isBusy" @click="reboot(target)">
            {{ t(`device.reboot.${target}`) }}
          </button>
        </div>
      </div>

      <div v-if="profile?.slot" class="section">
        <h3 class="section-title">{{ t("device.setActive") }}</h3>
        <div class="segmented">
          <button
            v-for="slot in ['a', 'b'] as const"
            :key="slot"
            :aria-pressed="profile.slot === slot"
            :disabled="isBusy || profile.slot === slot"
            @click="setActiveSlot(slot)"
          >
            {{ t("info.slotValue", { slot: slot.toUpperCase() }) }}
          </button>
        </div>
      </div>

      <div class="section">
        <button class="btn outlined block" :disabled="isBusy" @click="disconnect">{{ t("device.disconnect") }}</button>
      </div>
    </template>
  </AppCard>
</template>

<style scoped>
.status {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface-high);
  color: var(--on-surface-variant);
  font-size: 0.85em;
  white-space: nowrap;
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

.block {
  width: 100%;
}

.identity {
  display: grid;
  gap: 2px;
}

.codename {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.chips {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  background: var(--surface-mid);
}

.chip dt {
  color: var(--on-surface-variant);
}

.chip dd {
  margin: 0;
  font-weight: 500;
  text-align: right;
}

.chip[data-tone="good"] {
  background: var(--primary-container);
  color: var(--on-primary-container);
}

.chip[data-tone="warn"] {
  background: var(--warn-container);
  color: var(--on-warn-container);
}

.chip[data-tone] dt {
  color: inherit;
  opacity: 0.8;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
</style>
