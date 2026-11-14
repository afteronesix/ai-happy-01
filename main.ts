/// <reference types="node" />
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

async function validateImage(buffer) {
  // Check PNG signature
  const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (buffer.subarray(0, 8).equals(pngSig)) {
    // IHDR chunk starts at offset 16 (4 bytes length, 4 bytes type 'IHDR')
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { type: 'PNG', width, height };
  }

  // Check JPEG SOI marker
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      const marker = buffer.readUInt16BE(offset);
      if (marker === 0xFFC0 || marker === 0xFFC2) {
        // SOF0/SOF2 marker: 2 bytes marker + 2 bytes length + 1 byte precision + 2 bytes height + 2 bytes width
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { type: 'JPEG', width, height };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
    return { type: 'JPEG', width: 0, height: 0 };
  }

  throw new Error('Unsupported image format');
}

async function run() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let entryPath = join(scriptDir, 'entry.png');
  try {
    await fs.access(entryPath);
  } catch {
    entryPath = resolve(process.cwd(), 'entry.png');
  }
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

  await fs.mkdir(outputDir, { recursive: true });
  
  const buffer = await fs.readFile(entryPath);
  console.log(`File size: ${buffer.length} bytes`);
  if (buffer.length > 1024 * 1024) {
    console.warn('Warning: File exceeds 1 MiB bounty limit');
  }

  const info = await validateImage(buffer);
  console.log(`Dimensions: ${info.width}x${info.height}`);

  if (info.width > 1024 || info.height > 1024) {
    console.error('Error: Dimensions exceed 1024');
    process.exit(1);
  }

  await fs.writeFile(join(outputDir, 'entry.png'), buffer);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
