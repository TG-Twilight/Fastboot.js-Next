import { describe, expect, it } from "vitest";
import { profileFromVariables } from "../src/app/deviceProfile";

describe("profileFromVariables", () => {
  it("describes a Xiaomi device in the bootloader", () => {
    const p = profileFromVariables(
      new Map([
        ["product", "chopin"],
        ["unlocked", "yes"],
        ["variant", "MTK UFS"],
        ["current-slot", "a"],
        ["slot-count", "2"],
        ["partition-size:super", "0x220000000"],
        ["anti", "1"],
        ["max-download-size", "0x10000000"]
      ])
    );
    expect(p).toMatchObject({
      mode: "bootloader",
      codename: "chopin",
      unlocked: true,
      platform: "MTK",
      storage: "UFS",
      slot: "a",
      layout: { ab: true, dynamic: true, virtualAb: false },
      antiRollback: 1,
      maxDownloadSize: 0x10000000
    });
  });

  it("describes an A-only device in fastbootd", () => {
    const p = profileFromVariables(
      new Map([
        ["is-userspace", "yes"],
        ["super-partition-name", "super"],
        ["unlocked", "no"],
        ["variant", "SDM EMMC"],
        ["battery-voltage", "3650"],
        ["battery-soc-ok", "no"],
        ["snapshot-update-status", "merging"]
      ])
    );
    expect(p).toMatchObject({
      mode: "fastbootd",
      unlocked: false,
      storage: "eMMC",
      slot: null,
      layout: { ab: false, dynamic: true, virtualAb: true },
      batteryVoltage: 3650,
      batteryOk: false,
      snapshotStatus: "merging"
    });
  });

  it("leaves what the device does not report unknown", () => {
    const p = profileFromVariables(new Map([["product", "husky"]]));
    expect(p.unlocked).toBeNull();
    expect(p.storage).toBeNull();
    expect(p.antiRollback).toBeNull();
  });
});
