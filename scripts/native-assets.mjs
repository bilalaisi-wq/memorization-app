import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('assets',{recursive:true});
const svg=await readFile('assets/native/icon.svg');
await sharp(svg).resize(1024,1024).png().toFile('assets/icon-only.png');
const icon=await sharp(svg).resize(1100,1100).png().toBuffer();
for(const name of ['splash','splash-dark'])await sharp({create:{width:2732,height:2732,channels:4,background:'#101831'}}).composite([{input:icon,gravity:'centre'}]).png().toFile(`assets/${name}.png`);
await writeFile('assets/native/README.md','Original in-project SVG artwork for Ayah A Day. Rebuild PNG masters with npm run native:art, then regenerate platform icons/splashes with npm run native:icons. Artwork contains no Qur’anic text or external images.\n');
