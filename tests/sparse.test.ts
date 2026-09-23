import { describe, expect, it } from "vitest";
import { ChunkType, FastbootDevice, SPARSE_MAGIC, imageSize, parseSparseHeader, splitImage } from "../src/fastboot";
import { FakeDevice, sameBytes } from "./fakeDevice";

const BLOCK = 4096;

/** Writes a sparse image onto `target`, the way a bootloader does. */
function applySparse(target: Uint8Array, sparse: Uint8Array) {
  const view = new DataView(sparse.buffer, sparse.byteOffset, sparse.byteLength);
  expect(view.getUint32(0, true)).toBe(SPARSE_MAGIC);
  const blockSize = view.getUint32(12, true);
  const totalBlocks = view.getUint32(16, true);
  const chunks = view.getUint32(20, true);
  expect(totalBlocks * blockSize).toBe(target.byteLength);

  let offset = view.getUint16(8, true);
  let block = 0;
  for (let i = 0; i < chunks; i++) {
    const type = view.getUint16(offset, true);
    const blocks = view.getUint32(offset + 4, true);
    const size = view.getUint32(offset + 8, true);
    const data = sparse.subarray(offset + 12, offset + size);
    if (type === ChunkType.Raw) target.set(data, block * blockSize);
    if (type === ChunkType.Fill) {
      for (let b = 0; b < (blocks * blockSize) / 4; b++) target.set(data, block * blockSize + b * 4);
    }
    block += blocks;
    offset += size;
  }
  expect(block).toBe(totalBlocks);
  expect(offset).toBe(sparse.byteLength);
}

function chunk(type: number, blocks: number, data: Uint8Array = new Uint8Array(0)): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(12 + data.byteLength);
  const view = new DataView(out.buffer);
  view.setUint16(0, type, true);
  view.setUint32(4, blocks, true);
  view.setUint32(8, out.byteLength, true);
  out.set(data, 12);
  return out;
}

function sparseImage(totalBlocks: number, chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(28);
  const view = new DataView(header.buffer);
  view.setUint32(0, SPARSE_MAGIC, true);
  view.setUint16(4, 1, true);
  view.setUint16(8, 28, true);
  view.setUint16(10, 12, true);
  view.setUint32(12, BLOCK, true);
  view.setUint32(16, totalBlocks, true);
  view.setUint32(20, chunks.length, true);
  const out = new Uint8Array(28 + chunks.reduce((n, c) => n + c.byteLength, 0));
  out.set(header);
  let offset = 28;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function pattern(size: number, seed: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(size).map((_, i) => (i * 31 + seed) % 256);
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("splitImage", () => {
  it("leaves images that fit untouched", async () => {
    const blob = new Blob([pattern(1000, 1)]);
    expect(await splitImage(blob, 4096)).toEqual([blob]);
  });

  it("resparses a raw image that is too large", async () => {
    const raw = pattern(10 * BLOCK + 123, 7);
    const max = 3 * BLOCK + 64;
    const parts = await splitImage(new Blob([raw]), max);
    expect(parts.length).toBeGreaterThan(3);

    const result = new Uint8Array(11 * BLOCK);
    for (const part of parts) {
      expect(part.size).toBeLessThanOrEqual(max);
      applySparse(result, await bytes(part));
    }
    expect(sameBytes(result.subarray(0, raw.byteLength), raw)).toBe(true);
    expect(result.subarray(raw.byteLength).every((b) => b === 0)).toBe(true);
  });

  it("splits a sparse image along and inside chunks", async () => {
    const a = pattern(5 * BLOCK, 3);
    const b = pattern(2 * BLOCK, 9);
    const fill = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const image = sparseImage(20, [
      chunk(ChunkType.Raw, 5, a),
      chunk(ChunkType.DontCare, 4),
      chunk(ChunkType.Fill, 6, fill),
      chunk(ChunkType.Crc32, 0, new Uint8Array(4)),
      chunk(ChunkType.Raw, 2, b),
      chunk(ChunkType.DontCare, 3)
    ]);
    const blob = new Blob([image]);

    expect(await imageSize(blob)).toBe(20 * BLOCK);
    expect((await parseSparseHeader(blob))?.totalChunks).toBe(6);

    const expected = new Uint8Array(20 * BLOCK);
    applySparse(expected, image);

    const max = 2 * BLOCK + 100;
    const parts = await splitImage(blob, max);
    const result = new Uint8Array(20 * BLOCK);
    for (const part of parts) {
      expect(part.size).toBeLessThanOrEqual(max);
      applySparse(result, await bytes(part));
    }
    expect(sameBytes(result, expected)).toBe(true);
  });

  it("flashes every split payload to the same partition", async () => {
    const fake = new FakeDevice();
    fake.variables.set("max-download-size", String(2 * BLOCK + 100));
    const device = new FastbootDevice(fake);
    const raw = pattern(6 * BLOCK, 5);
    await device.flash("system_a", new Blob([raw]));

    expect(fake.flashed.length).toBeGreaterThan(1);
    const result = new Uint8Array(raw.byteLength);
    for (const { partition, data } of fake.flashed) {
      expect(partition).toBe("system_a");
      applySparse(result, data);
    }
    expect(sameBytes(result, raw)).toBe(true);
  });
});
