import type { Transport } from "../src/fastboot/transport";

/** A scripted fastboot device that speaks the protocol over an in-memory transport. */
export class FakeDevice implements Transport {
  readonly commands: string[] = [];
  /** Payloads received with `download`, as they were when `flash:<partition>` ran. */
  readonly flashed: { partition: string; data: Uint8Array }[] = [];
  variables = new Map<string, string>();
  failing = new Map<string, string>();

  private pending: Uint8Array[] = [];
  private expecting = 0;
  private buffer: Uint8Array[] = [];
  private downloaded = new Uint8Array(0);

  async write(data: Uint8Array | ArrayBuffer): Promise<void> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (this.expecting > 0) {
      this.buffer.push(bytes.slice());
      this.expecting -= bytes.byteLength;
      if (this.expecting < 0) throw new Error("Host sent too much data");
      if (this.expecting === 0) {
        this.downloaded = new Uint8Array(this.buffer.reduce((n, b) => n + b.byteLength, 0));
        let offset = 0;
        for (const b of this.buffer) {
          this.downloaded.set(b, offset);
          offset += b.byteLength;
        }
        this.buffer = [];
        this.reply("OKAY");
      }
      return;
    }

    const command = new TextDecoder().decode(bytes);
    this.commands.push(command);
    const failure = this.failing.get(command);
    if (failure !== undefined) return this.reply(`FAIL${failure}`);

    const [name, ...rest] = command.split(":");
    const arg = rest.join(":");
    switch (name) {
      case "getvar":
        if (arg === "all") {
          for (const [key, value] of this.variables) this.reply(`INFO${key}:${value}`);
          return this.reply("OKAY");
        }
        return this.variables.has(arg) ? this.reply(`OKAY${this.variables.get(arg)}`) : this.reply("FAILunknown variable");
      case "download":
        this.expecting = parseInt(arg, 16);
        return this.reply(`DATA${arg}`);
      case "flash":
        this.flashed.push({ partition: arg, data: this.downloaded });
        return this.reply("OKAY");
      default:
        this.reply("INFOworking");
        return this.reply("OKAY");
    }
  }

  async read(): Promise<Uint8Array> {
    const packet = this.pending.shift();
    if (!packet) throw new Error("Host read with no pending response");
    return packet;
  }

  async close(): Promise<void> {}

  private reply(text: string) {
    this.pending.push(new TextEncoder().encode(text));
  }
}
