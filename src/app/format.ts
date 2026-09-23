export function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Accepts fastboot CLI syntax and turns it into a protocol command:
 * `fastboot getvar product` → `getvar:product`, `reboot bootloader` → `reboot-bootloader`.
 */
export function normalizeCommand(input: string): string {
  const text = input.trim().replace(/^fastboot\s+/, "");
  const [verb, ...rest] = text.split(/\s+/);
  if (rest.length === 0) return text;
  if (verb === "reboot" && rest.length === 1 && ["bootloader", "fastboot", "recovery"].includes(rest[0])) {
    return `reboot-${rest[0]}`;
  }
  if (["getvar", "erase", "set_active", "format"].includes(verb) && rest.length === 1) {
    return `${verb}:${rest[0]}`;
  }
  return text;
}

/** Commands that can change or wipe the device and deserve a confirmation. */
export function isDangerousCommand(command: string): boolean {
  return /^(flash|erase|format|flashing|oem\s+(un)?lock|set_active|update-super|delete-logical-partition|resize-logical-partition|create-logical-partition|snapshot-update|wipe)/i.test(
    command.trim()
  );
}
