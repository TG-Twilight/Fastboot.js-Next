<script setup lang="ts">
import { cycleTheme, themeMode } from "@/app/theme";
import { t, toggleLocale } from "@/i18n";
import AppIcon from "./AppIcon.vue";

const REPOSITORY = "https://github.com/TG-Twilight/Fastboot.js-Next";
const logo = `${import.meta.env.BASE_URL}favicon.svg`;
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <div class="brand">
        <img :src="logo" alt="" width="32" height="32" />
        <div class="titles">
          <h1>Fastboot.js Next</h1>
          <p class="hint">{{ t("app.tagline") }}</p>
        </div>
      </div>
      <nav class="actions">
        <button class="icon-btn" :title="t(`header.theme.${themeMode}`)" :aria-label="t(`header.theme.${themeMode}`)" @click="cycleTheme">
          <AppIcon :name="themeMode" />
        </button>
        <button class="btn outlined small" @click="toggleLocale">
          <AppIcon name="translate" :size="18" />{{ t("header.language") }}
        </button>
        <a class="icon-btn" :href="REPOSITORY" target="_blank" rel="noopener" :title="t('header.source')" :aria-label="t('header.source')">
          <AppIcon name="github" />
        </a>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--outline-variant);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(12px);
}

.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: 1280px;
  height: 64px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.titles {
  min-width: 0;
}

h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}

.titles .hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-1);
}

@media (max-width: 560px) {
  .inner {
    padding: 0 var(--space-3);
  }

  .titles .hint {
    display: none;
  }
}
</style>
