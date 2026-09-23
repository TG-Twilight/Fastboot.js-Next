import { FastbootImageError } from "./errors";

// Android sparse image format, see system/core/libsparse/sparse_format.h in AOSP.

export const SPARSE_MAGIC = 0xed26ff3a;
const FILE_HEADER_SIZE = 28;
const CHUNK_HEADER_SIZE = 12;
const DEFAULT_BLOCK_SIZE = 4096;

export const ChunkType = {
  Raw: 0xcac1,
  Fill: 0xcac2,
  DontCare: 0xcac3,
  Crc32: 0xcac4
} as const;
export type ChunkType = (typeof ChunkType)[keyof typeof ChunkType];

export interface SparseHeader {
  blockSize: number;
  totalBlocks: number;
  totalChunks: number;
  fileHeaderSize: number;
  chunkHeaderSize: number;
}

export interface SparseChunk {
  type: ChunkType;
  blocks: number;
  /** Payload: blocks * blockSize bytes for Raw, 4 bytes for Fill, none otherwise. */
  data: Blob | null;
}

/** A chunk placed at an absolute block offset of the output image. */
interface Extent {
  start: number;
  chunk: SparseChunk;
}

/** Serves small reads from a window so that walking thousands of chunk headers stays cheap. */
class WindowedReader {
  private windowStart = 0;
  private window = new Uint8Array(0);

  constructor(
    private readonly blob: Blob,
    private readonly windowSize = 64 * 1024
  ) {}

  async read(offset: number, length: number): Promise<DataView> {
    const end = offset + length;
    if (end > this.blob.size) {
      throw new FastbootImageError("Sparse image is truncated");
    }
    if (offset < this.windowStart || end > this.windowStart + this.window.byteLength) {
      const size = Math.max(length, this.windowSize);
      this.window = new Uint8Array(await this.blob.slice(offset, offset + size).arrayBuffer());
      this.windowStart = offset;
    }
    return new DataView(this.window.buffer, offset - this.windowStart, length);
  }
}

export async function parseSparseHeader(blob: Blob): Promise<SparseHeader | null> {
  if (blob.size < FILE_HEADER_SIZE) return null;
  const view = new DataView(await blob.slice(0, FILE_HEADER_SIZE).arrayBuffer());
  if (view.getUint32(0, true) !== SPARSE_MAGIC) return null;

  const major = view.getUint16(4, true);
  if (major !== 1) {
    throw new FastbootImageError(`Unsupported sparse image version ${major}`);
  }
  const header: SparseHeader = {
    fileHeaderSize: view.getUint16(8, true),
    chunkHeaderSize: view.getUint16(10, true),
    blockSize: view.getUint32(12, true),
    totalBlocks: view.getUint32(16, true),
    totalChunks: view.getUint32(20, true)
  };
  if (header.fileHeaderSize < FILE_HEADER_SIZE || header.chunkHeaderSize < CHUNK_HEADER_SIZE) {
    throw new FastbootImageError("Sparse image has invalid header sizes");
  }
  if (header.blockSize === 0 || header.blockSize % 4 !== 0) {
    throw new FastbootImageError(`Sparse image has invalid block size ${header.blockSize}`);
  }
  return header;
}

export async function readSparseChunks(blob: Blob, header: SparseHeader): Promise<SparseChunk[]> {
  const reader = new WindowedReader(blob);
  const chunks: SparseChunk[] = [];
  let offset = header.fileHeaderSize;

  for (let i = 0; i < header.totalChunks; i++) {
    const view = await reader.read(offset, CHUNK_HEADER_SIZE);
    const type = view.getUint16(0, true) as ChunkType;
    const blocks = view.getUint32(4, true);
    const totalSize = view.getUint32(8, true);
    const dataStart = offset + header.chunkHeaderSize;
    const dataSize = totalSize - header.chunkHeaderSize;

    if (dataSize < 0 || dataStart + dataSize > blob.size) {
      throw new FastbootImageError(`Sparse chunk ${i} is truncated`);
    }

    switch (type) {
      case ChunkType.Raw:
        if (dataSize !== blocks * header.blockSize) {
          throw new FastbootImageError(`Sparse raw chunk ${i} has size ${dataSize}, expected ${blocks * header.blockSize}`);
        }
        chunks.push({ type, blocks, data: blob.slice(dataStart, dataStart + dataSize) });
        break;
      case ChunkType.Fill:
        if (dataSize !== 4) throw new FastbootImageError(`Sparse fill chunk ${i} is malformed`);
        chunks.push({ type, blocks, data: blob.slice(dataStart, dataStart + 4) });
        break;
      case ChunkType.DontCare:
        chunks.push({ type, blocks, data: null });
        break;
      case ChunkType.Crc32:
        // Checksums only cover the original file and are meaningless once the image is split.
        break;
      default:
        throw new FastbootImageError(`Sparse chunk ${i} has unknown type 0x${(type as number).toString(16)}`);
    }
    offset += totalSize;
  }

  const blocks = chunks.reduce((sum, c) => sum + c.blocks, 0);
  if (blocks !== header.totalBlocks) {
    throw new FastbootImageError(`Sparse image covers ${blocks} blocks but its header declares ${header.totalBlocks}`);
  }
  return chunks;
}

/** Size of the partition content described by the image, as fastboot reports to resize-logical-partition. */
export async function imageSize(blob: Blob): Promise<number> {
  const header = await parseSparseHeader(blob);
  return header ? header.totalBlocks * header.blockSize : blob.size;
}

function dataSize(chunk: SparseChunk): number {
  return chunk.data?.size ?? 0;
}

function takeBlocks(chunk: SparseChunk, from: number, count: number, blockSize: number): SparseChunk {
  if (chunk.type !== ChunkType.Raw || !chunk.data) return { ...chunk, blocks: count };
  return { type: chunk.type, blocks: count, data: chunk.data.slice(from * blockSize, (from + count) * blockSize) };
}

function encodeHeader(blockSize: number, totalBlocks: number, totalChunks: number): Uint8Array {
  const bytes = new Uint8Array(FILE_HEADER_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, SPARSE_MAGIC, true);
  view.setUint16(4, 1, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, FILE_HEADER_SIZE, true);
  view.setUint16(10, CHUNK_HEADER_SIZE, true);
  view.setUint32(12, blockSize, true);
  view.setUint32(16, totalBlocks, true);
  view.setUint32(20, totalChunks, true);
  view.setUint32(24, 0, true);
  return bytes;
}

function encodeChunkHeader(type: ChunkType, blocks: number, payload: number): Uint8Array {
  const bytes = new Uint8Array(CHUNK_HEADER_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, type, true);
  view.setUint32(4, blocks, true);
  view.setUint32(8, CHUNK_HEADER_SIZE + payload, true);
  return bytes;
}

/**
 * Builds a sparse image containing only `extents`. Every output file describes the whole
 * partition; blocks outside the extents are DONT_CARE, which is how libsparse resparses.
 */
function encodeSparse(extents: Extent[], totalBlocks: number, blockSize: number): Blob {
  const parts: BlobPart[] = [];
  let position = 0;
  let count = 0;

  const skip = (blocks: number) => {
    parts.push(encodeChunkHeader(ChunkType.DontCare, blocks, 0) as BlobPart);
    count++;
  };

  for (const { start, chunk } of extents) {
    if (start > position) skip(start - position);
    parts.push(encodeChunkHeader(chunk.type, chunk.blocks, dataSize(chunk)) as BlobPart);
    if (chunk.data) parts.push(chunk.data);
    count++;
    position = start + chunk.blocks;
  }
  if (position < totalBlocks) skip(totalBlocks - position);

  return new Blob([encodeHeader(blockSize, totalBlocks, count) as BlobPart, ...parts]);
}

/** Groups extents into sparse files that are each at most `maxSize` bytes. */
export function splitExtents(extents: Extent[], totalBlocks: number, blockSize: number, maxSize: number): Blob[] {
  // Every file may need a leading and a trailing DONT_CARE chunk.
  const budget = maxSize - FILE_HEADER_SIZE - 2 * CHUNK_HEADER_SIZE;
  if (budget < CHUNK_HEADER_SIZE + blockSize) {
    throw new FastbootImageError(`Download size ${maxSize} is too small to split a sparse image`);
  }

  const files: Blob[] = [];
  let group: Extent[] = [];
  let used = 0;
  let end = 0;

  const flush = () => {
    files.push(encodeSparse(group, totalBlocks, blockSize));
    group = [];
    used = 0;
  };

  for (const extent of extents) {
    let { start, chunk } = extent;
    for (;;) {
      const gap = group.length > 0 && start > end ? CHUNK_HEADER_SIZE : 0;
      const cost = gap + CHUNK_HEADER_SIZE + dataSize(chunk);
      if (used + cost <= budget) {
        group.push({ start, chunk });
        used += cost;
        end = start + chunk.blocks;
        break;
      }
      if (chunk.type === ChunkType.Raw) {
        const fit = Math.floor((budget - used - gap - CHUNK_HEADER_SIZE) / blockSize);
        if (fit > 0) {
          group.push({ start, chunk: takeBlocks(chunk, 0, fit, blockSize) });
          flush();
          chunk = takeBlocks(chunk, fit, chunk.blocks - fit, blockSize);
          start += fit;
          continue;
        }
      }
      if (group.length === 0) throw new FastbootImageError("Sparse chunk does not fit in a single download");
      flush();
    }
  }
  if (group.length > 0 || files.length === 0) flush();
  return files;
}

function extentsOf(chunks: SparseChunk[]): Extent[] {
  const extents: Extent[] = [];
  let position = 0;
  for (const chunk of chunks) {
    if (chunk.type !== ChunkType.DontCare) extents.push({ start: position, chunk });
    position += chunk.blocks;
  }
  return extents;
}

/**
 * Returns the payloads to download and flash, in order. Images that fit are sent untouched;
 * larger ones, raw or sparse, are cut into sparse images no bigger than `maxDownloadSize`.
 */
export async function splitImage(blob: Blob, maxDownloadSize: number): Promise<Blob[]> {
  if (blob.size <= maxDownloadSize) return [blob];

  const header = await parseSparseHeader(blob);
  if (header) {
    const chunks = await readSparseChunks(blob, header);
    return splitExtents(extentsOf(chunks), header.totalBlocks, header.blockSize, maxDownloadSize);
  }

  const blockSize = DEFAULT_BLOCK_SIZE;
  const totalBlocks = Math.ceil(blob.size / blockSize);
  const padding = totalBlocks * blockSize - blob.size;
  const data = padding > 0 ? new Blob([blob, new Uint8Array(padding)]) : blob;
  const raw: SparseChunk = { type: ChunkType.Raw, blocks: totalBlocks, data };
  return splitExtents([{ start: 0, chunk: raw }], totalBlocks, blockSize, maxDownloadSize);
}
