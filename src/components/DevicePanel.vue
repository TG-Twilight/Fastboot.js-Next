<script setup lang="ts">
import { computed } from "vue";
import { lockFact, modeFact, slotFact } from "@/app/deviceFacts";
import { connect, disconnect, isBusy, isConnected, profile, reboot, session, setActiveSlot } from "@/app/session";
import type { RebootTarget } from "@/fastboot/device";
import { t } from "@/i18n";
import AppIcon from "./AppIcon.vue";

defineProps<{ supported: boolean }>();

const targets: RebootTarget[] = ["system", "bootloader", "fastboot", "recovery"];

const chips = computed(() => {
  const p = profile.value;
  return p ? [modeFact(p), lockFact(p), slotFact(p)] : [];
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

    <div v-if="profile" class="identity">
      <strong class="codename mono">{{ profile.codename ?? t("info.unknown") }}</strong>
      <span v-if="session.manufacturer" class="hint">{{ session.manufacturer }}</span>
    </div>
    <dl v-if="chips.length" class="chips">
      <div v-for="chip in chips" :key="chip.label" class="chip" :data-tone="chip.tone">
        <dt>{{ t(chip.label) }}</dt>
        <dd>{{ chip.value }}</dd>
      </div>
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

      <div v-if="profile?.slot" class="stack section">
        <h3>{{ t("device.setActive") }}</h3>
        <div class="segmented">
          <button
            v-for="slot in ['a', 'b'] as const"
            :key="slot"
            :aria-pressed="profile.slot === slot"
            :disabled="isBusy || profile.slot === slot"
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

.identity {
  display: grid;
}

.codename {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.chips {
  display: grid;
  gap: 6px;
  margin: 0;
}

.chip {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--radius-m);
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

.chip[data-tone="good"] dt,
.chip[data-tone="warn"] dt {
  color: inherit;
  opacity: 0.8;
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
