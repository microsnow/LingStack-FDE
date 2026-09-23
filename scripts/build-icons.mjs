import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const projectRoot = join(import.meta.dirname, "..");
const source = join(projectRoot, "public", "favicon.svg");
const buildDirectory = join(projectRoot, "build");
const sizes = [16, 24, 32, 48, 64, 128, 256];
await mkdir(buildDirectory, { recursive: true });
const svg = await readFile(source);
await sharp(svg, { density: 512 }).resize(512, 512).png().toFile(join(projectRoot, "public", "icon.png"));
await sharp(svg, { density: 512 }).resize(512, 512).png().toFile(join(buildDirectory, "icon.png"));
const images = await Promise.all(sizes.map(size => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16; const size = sizes[index];
  header.writeUInt8(size === 256 ? 0 : size, entry); header.writeUInt8(size === 256 ? 0 : size, entry + 1);
  header.writeUInt8(0, entry + 2); header.writeUInt8(0, entry + 3); header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6); header.writeUInt32LE(image.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(join(buildDirectory, "icon.ico"), Buffer.concat([header, ...images]));
const macIconSpecs = [[16, "icp4"], [32, "icp5"], [64, "icp6"], [128, "ic07"], [256, "ic08"], [512, "ic09"]];
const macIcons = await Promise.all(macIconSpecs.map(async ([size, type]) => {
  const png = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  const chunk = Buffer.alloc(8 + png.length);
  chunk.write(type, 0, 4, "ascii");
  chunk.writeUInt32BE(chunk.length, 4);
  png.copy(chunk, 8);
  return chunk;
}));
const icnsBody = Buffer.concat(macIcons);
const icnsHeader = Buffer.alloc(8);
icnsHeader.write("icns", 0, 4, "ascii");
icnsHeader.writeUInt32BE(icnsHeader.length + icnsBody.length, 4);
await writeFile(join(buildDirectory, "icon.icns"), Buffer.concat([icnsHeader, icnsBody]));
console.log(`Built 灵栈 FDE icons: ${sizes.join(", ")} px`);
