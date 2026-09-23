/** What a person flashing the device wants to know, derived from fastboot variables. */
export interface DeviceProfile {
  mode: "bootloader" | "fastbootd";
  codename: string | null;
  serial: string | null;
  /** SoC or platform reported in `variant`, e.g. "SM8250" or "MTK". */
  platform: string | null;
  storage: "UFS" | "eMMC" | null;
  hwRevision: string | null;
  unlocked: boolean | null;
  secureBoot: boolean | null;
  /** Active slot, or null on A-only devices. */
  slot: "a" | "b" | null;
  layout: { ab: boolean; dynamic: boolean; virtualAb: boolean };
  /** Millivolts. */
  batteryVoltage: number | null;
  batteryOk: boolean | null;
  bootloaderVersion: string | null;
  basebandVersion: string | null;
  androidVersion: string | null;
  vndkVersion: string | null;
  /** Xiaomi anti-rollback index. */
  antiRollback: number | null;
  /** Virtual A/B merge state; anything but "none" blocks flashing dynamic partitions. */
  snapshotStatus: string | null;
  maxDownloadSize: number | null;
}

function flag(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const v = value.toLowerCase();
  if (v === "yes" || v === "true" || v === "1") return true;
  if (v === "no" || v === "false" || v === "0") return false;
  return null;
}

function text(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function number(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = /^0x/i.test(value.trim()) ? Number(value.trim()) : parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function profileFromVariables(vars: ReadonlyMap<string, string>): DeviceProfile {
  const get = (name: string) => vars.get(name);
  const has = (predicate: (name: string, value: string) => boolean) => [...vars].some(([n, v]) => predicate(n, v));

  // Xiaomi and others: "variant: SM8250 UFS", "variant: MTK EMMC".
  const variant = text(get("variant"));
  const storageMatch = variant ? /\b(UFS|EMMC)\b/i.exec(variant) : null;
  const storage = storageMatch ? (storageMatch[1].toUpperCase() === "UFS" ? "UFS" : "eMMC") : null;
  const platform = variant ? text(variant.replace(/\b(UFS|EMMC)\b/gi, "").replace(/\s+/g, " ")) : null;

  const rawSlot = get("current-slot")?.trim().replace(/^_/, "").toLowerCase();
  const slot = rawSlot === "a" || rawSlot === "b" ? rawSlot : null;
  const slotCount = number(get("slot-count")) ?? 0;
  const snapshotStatus = text(get("snapshot-update-status"));

  return {
    mode: flag(get("is-userspace")) ? "fastbootd" : "bootloader",
    codename: text(get("product")),
    serial: text(get("serialno")),
    platform,
    storage,
    hwRevision: text(get("hw-revision")),
    unlocked: flag(get("unlocked")),
    secureBoot: flag(get("secure")),
    slot,
    layout: {
      ab: slot !== null || slotCount >= 2,
      dynamic: vars.has("super-partition-name") || has((n, v) => n === "partition-size:super" || (n.startsWith("is-logical:") && v === "yes")),
      virtualAb: snapshotStatus !== null
    },
    batteryVoltage: number(get("battery-voltage")),
    batteryOk: flag(get("battery-soc-ok")),
    bootloaderVersion: text(get("version-bootloader")),
    basebandVersion: text(get("version-baseband")),
    androidVersion: text(get("version-os")),
    vndkVersion: text(get("version-vndk")),
    antiRollback: number(get("anti")),
    snapshotStatus,
    maxDownloadSize: number(get("max-download-size"))
  };
}
