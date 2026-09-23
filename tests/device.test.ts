import { describe, expect, it } from "vitest";
import { FastbootCommandError, FastbootDevice, parseVariableLine } from "../src/fastboot";
import { FakeDevice } from "./fakeDevice";

function setup() {
  const fake = new FakeDevice();
  return { fake, device: new FastbootDevice(fake) };
}

describe("FastbootDevice", () => {
  it("returns the value of getvar and collects INFO lines", async () => {
    const { fake, device } = setup();
    fake.variables.set("product", "husky");
    expect(await device.getVariable("product")).toBe("husky");
    expect(await device.command("oem device-info")).toEqual({ value: "", info: ["working"] });
  });

  it("throws FastbootCommandError on FAIL", async () => {
    const { fake, device } = setup();
    fake.failing.set("flashing unlock", "not allowed");
    await expect(device.command("flashing unlock")).rejects.toThrow(FastbootCommandError);
    // The device is still usable afterwards.
    fake.variables.set("product", "husky");
    expect(await device.getVariable("product")).toBe("husky");
  });

  it("serializes concurrent commands", async () => {
    const { fake, device } = setup();
    fake.variables.set("a", "1");
    fake.variables.set("b", "2");
    expect(await Promise.all([device.getVariable("a"), device.getVariable("b")])).toEqual(["1", "2"]);
  });

  it("parses getvar all", async () => {
    const { fake, device } = setup();
    fake.variables.set("partition-size:boot_a", " 0x4000000");
    fake.variables.set("version-bootloader", "ripcurrent-14.0");
    const all = await device.getAllVariables();
    expect(all?.get("partition-size:boot_a")).toBe("0x4000000");
    expect(all?.get("version-bootloader")).toBe("ripcurrent-14.0");
  });

  it("splits getvar lines on the right colon", () => {
    expect(parseVariableLine("has-slot:boot:yes")).toEqual(["has-slot:boot", "yes"]);
    expect(parseVariableLine("date: 2024-01-01 10:00")).toEqual(["date", "2024-01-01 10:00"]);
    expect(parseVariableLine("garbage")).toBeNull();
  });

  it("resolves slotted partitions", async () => {
    const { fake, device } = setup();
    fake.variables.set("has-slot:boot", "yes");
    fake.variables.set("has-slot:modem_st1", "no");
    fake.variables.set("current-slot", "b");
    expect(await device.resolvePartition("boot")).toBe("boot_b");
    expect(await device.resolvePartition("boot", "other")).toBe("boot_a");
    expect(await device.resolvePartition("boot_a")).toBe("boot_a");
    expect(await device.resolvePartition("modem_st1")).toBe("modem_st1");
  });

  it("flashes an image that fits in one download", async () => {
    const { fake, device } = setup();
    const image = new Uint8Array(3 * 1024 * 1024 + 7).map((_, i) => i % 251);
    fake.variables.set("max-download-size", String(8 * 1024 * 1024));
    const progress: number[] = [];
    await device.flash("boot_a", new Blob([image]), { onProgress: (p) => progress.push(p) });
    expect(fake.flashed).toHaveLength(1);
    expect(fake.flashed[0].partition).toBe("boot_a");
    expect(fake.flashed[0].data).toEqual(image);
    expect(progress.at(-1)).toBe(1);
  });

  it("falls back to a default download size", async () => {
    const { device } = setup();
    expect(await device.getMaxDownloadSize()).toBe(256 * 1024 * 1024);
  });
});
