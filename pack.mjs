import {readFileSync,writeFileSync} from 'node:fs';
import {ISO_CSS} from '/Users/aaron/.agents/skills/anatomy/kit/iso-kit.mjs';
import {kitScript} from '/Users/aaron/.agents/skills/anatomy/scripts/inline-kit.mjs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const {projection,stations}=JSON.parse(read('geometry.json'));
const script=kitScript()+`\nconst LINE_P=${JSON.stringify(projection)};const STATIONS=${JSON.stringify(stations)};\n`+read('live.js');
const html=read('template.html').replace('/*ANATOMY_CSS*/',()=>ISO_CSS).replace('<!--SCENE-->',()=>read('scene.svg')).replace('/*SCRIPT*/',()=>script.replace(/<\/(script)/gi,'<\\/$1'));
writeFileSync(new URL('Photomask-Coater-Line.html',import.meta.url),html);
console.log(`Packed ${Buffer.byteLength(html)} bytes, no external assets.`);
