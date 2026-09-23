import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { describe, expect, it } from "vitest";
import { FactoryRequirementError, FastbootDevice, flashFactoryZip, parseAndroidInfo, parseFastbootInfo } from "../src/fastboot";
import { FakeDevice } from "./fakeDevice";

async function zip(files: Record<string, string | Blob>): Promise<Blob> {
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  for (const [name, content] of Object.entries(files)) {
    await writer.add(name, typeof content === "string" ? new TextReader(content) : new BlobReader(content));
  }
  return writer.close();
}

function image(size: number): Blob {
  return new Blob([new Uint8Array(size).fill(0x5a)]);
}

/** A Pixel-like device that switches to fastbootd and back when asked to. */
function pixel() {
  const fake = new FakeDevice();
  const vars = fake.variables;
  vars.set("product", "husky");
  vars.set("version-bootloader", "old");
  vars.set("current-slot", "a");
  vars.set("is-userspace", "no");
  vars.set("max-download-size", String(64 * 1024));
  for (const p of ["bootloader", "radio", "boot", "vbmeta", "system", "vendor"]) vars.set(`has-slot:${p}`, "yes");
  vars.set("has-slot:userdata", "no");

  let device = new FastbootDevice(fake);
  const reboots: string[] = [];
  const host = {
    device: () => device,
    rebootInto: async (target: "bootloader" | "fastboot") => {
      reboots.push(target);
      if (fake.flashed.some((f) => f.partition === "bootloader_a")) vars.set("version-bootloader", "new");
      vars.set("is-userspace", target === "fastboot" ? "yes" : "no");
      for (const p of ["system_a", "vendor_a"]) vars.set(`is-logical:${p}`, target === "fastboot" ? "yes" : "no");
      device = new FastbootDevice(fake);
    }
  };
  return { fake, host, reboots };
}

async function factoryZip(androidInfo: string, extra: Record<string, string | Blob> = {}) {
  const inner = await zip({
    "android-info.txt": androidInfo,
    "boot.img": image(1000),
    "vbmeta.img": image(100),
    "super_empty.img": image(50),
    "system.img": image(200 * 1024),
    ...extra
  });
  return zip({
    "husky-1.0/bootloader-husky-new.img": image(300),
    "husky-1.0/radio-husky-g5300.img": image(400),
    "husky-1.0/image-husky-1.0.zip": inner,
    "husky-1.0/flash-all.sh": "#!/bin/sh"
  });
}

describe("flashFactoryZip", () => {
  it("flashes a Google factory image end to end", async () => {
    const { fake, host, reboots } = pixel();
    const file = await factoryZip("require board=husky\nrequire version-bootloader=new\n");
    await flashFactoryZip(file, host, { wipe: true, reboot: true });

    const flashes = fake.commands.filter((c) => /^(flash|update-super|resize|erase|reboot)/.test(c));
    expect(flashes).toEqual([
      "flash:bootloader_a",
      "flash:radio_a",
      "flash:boot_a",
      "flash:vbmeta_a",
      "update-super:super:wipe",
      `resize-logical-partition:system_a:${200 * 1024}`,
      ...Array(fake.flashed.filter((f) => f.partition === "system_a").length).fill("flash:system_a"),
      "erase:userdata",
      "erase:metadata",
      "reboot"
    ]);
    // system.img is bigger than max-download-size and had to be split.
    expect(fake.flashed.filter((f) => f.partition === "system_a").length).toBeGreaterThan(1);
    expect(reboots).toEqual(["bootloader", "bootloader", "fastboot"]);
  });

  it("refuses an image for another device before flashing anything", async () => {
    const { fake, host } = pixel();
    const file = await factoryZip("require board=shiba\n");
    await expect(flashFactoryZip(file, host, { wipe: false, reboot: false })).rejects.toThrow(FactoryRequirementError);
    expect(fake.flashed).toHaveLength(0);
  });

  it("follows fastboot-info.txt when present", async () => {
    const { fake, host } = pixel();
    const info = ["version 1", "flash boot", "reboot fastboot", "update-super", "flash system", "if-wipe erase userdata"].join("\n");
    const file = await factoryZip("require board=husky\n", { "fastboot-info.txt": info });
    await flashFactoryZip(file, host, { wipe: false, reboot: false });

    const commands = fake.commands.filter((c) => /^(flash|update-super|erase)/.test(c));
    expect(commands[0]).toBe("flash:bootloader_a");
    expect(commands).toContain("update-super:super");
    expect(commands).not.toContain("flash:vbmeta_a");
    expect(commands).not.toContain("erase:userdata");
  });
});

describe("parsers", () => {
  it("parses android-info.txt", () => {
    expect(parseAndroidInfo("require board=a|b\nrequire-for-product:x version-baseband=1*\nreject foo=bar")).toEqual([
      { variable: "product", values: ["a", "b"], product: null, reject: false },
      { variable: "version-baseband", values: ["1*"], product: "x", reject: false },
      { variable: "foo", values: ["bar"], product: null, reject: true }
    ]);
  });

  it("parses fastboot-info.txt", () => {
    const tasks = parseFastbootInfo("version 1\nflash --apply-vbmeta vbmeta\nflash --slot-other system system_other.img\nif-wipe erase userdata", true);
    expect(tasks).toEqual([
      { op: "flash", source: "image", partition: "vbmeta", file: "vbmeta.img", slot: "current" },
      { op: "flash", source: "image", partition: "system", file: "system_other.img", slot: "other" },
      { op: "erase", partition: "userdata", optional: false }
    ]);
  });
});
