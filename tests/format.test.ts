import { describe, expect, it } from "vitest";
import { isDangerousCommand, normalizeCommand } from "../src/app/format";

describe("normalizeCommand", () => {
  it("converts fastboot CLI syntax", () => {
    expect(normalizeCommand("fastboot getvar product")).toBe("getvar:product");
    expect(normalizeCommand("reboot bootloader")).toBe("reboot-bootloader");
    expect(normalizeCommand("set_active b")).toBe("set_active:b");
    expect(normalizeCommand("  getvar:all ")).toBe("getvar:all");
  });

  it("keeps commands that contain spaces on the wire", () => {
    expect(normalizeCommand("oem device-info")).toBe("oem device-info");
    expect(normalizeCommand("flashing unlock")).toBe("flashing unlock");
  });
});

describe("isDangerousCommand", () => {
  it("flags commands that modify the device", () => {
    expect(isDangerousCommand("flashing unlock")).toBe(true);
    expect(isDangerousCommand("erase:userdata")).toBe(true);
    expect(isDangerousCommand("oem unlock")).toBe(true);
    expect(isDangerousCommand("getvar:all")).toBe(false);
    expect(isDangerousCommand("oem device-info")).toBe(false);
  });
});
