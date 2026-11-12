import {writeFileSync,readFileSync} from 'node:fs';
import * as k from '/Users/aaron/.agents/skills/anatomy/kit/iso-kit.mjs';
import * as A from '/Users/aaron/.agents/skills/anatomy/kit/audit.mjs';
import {kitScript} from '/Users/aaron/.agents/skills/anatomy/scripts/inline-kit.mjs';
const P=k.fitProjection(k.boxCorners({x:-500,y:-300,w:1000,d:655,r:4},0,185),1240,720,{pad:40,azimuth:78,elevation:42});
const R=A.recorder(P);let serial=0;
const stations=[{id:'coater',x:-265,y:-185,w:220,d:178,title:'Coater',cn:'旋转涂布',num:'03'}, {id:'ebr',x:65,y:-185,w:185,d:154,title:'EBR',cn:'边缘除胶',num:'04'}, {id:'stocker',x:340,y:-185,w:140,d:145,title:'Mask Stocker',cn:'辅助存储',num:'AUX'}, {id:'ld',x:-280,y:172,w:205,d:145,title:'LD / ULD',cn:'装载 / 卸载',num:'01 / 06'}, {id:'hp',x:35,y:172,w:190,d:145,title:'HP / CP',cn:'Soft Bake / 冷却',num:'05'}, {id:'dhp',x:340,y:172,w:190,d:145,title:'DHP / CP',cn:'脱水烘烤 / 冷却',num:'02'}];
function add(svg,shape,at,piece='line'){const name=`${piece}.${serial++}`;shape.name=name; R.put({name,piece,at,svg,shapes:[R.solid(shape)]});}
function slab(x,y,w,d,z,h,tone='hi',piece='line',r=2){const p={x,y,w,d,r};add(k.solidSvg(k.slabOf(p,z,h,P,4,.7),{tone}),A.slab(p,z,h,{},4),[x+w/2,y+d/2,z+h/2],piece);}
function cyl(x,y,r,z,h,tone,piece){add(k.solidSvg(k.cylinder(x,y,r,z,h,P,48,.5),{tone}),A.cylinder(x,y,r,z,h),[x,y,z+h/2],piece);}
slab(-485,-280,970,565,0,6,'lo','stand');
slab(-470,-73,940,146,6,9,'mid');
for(const y of [-47,40]) slab(-450,y,900,7,15,8,'mid');
for(const x of [-462,452]) slab(x,-67,10,134,15,27,'lo');
for(const s of stations){const {x,y,w,d,id}=s;
 for(const dx of [-w/2+16,w/2-26])for(const dy of [-d/2+13,d/2-23])slab(x+dx,y+dy,10,10,6,7,'lo',id);
 slab(x-w/2,y-d/2,w,d,13,5,'lo',id);
 if(id==='ld'){
  slab(x-w/2+3,y-d/2+3,w-6,d-6,18,4,'hi',id);
  slab(x-w/2,y-d/2,w,d,22,3,'mid',id);
 }else{
  slab(x-w/2+3,y-d/2+3,w-6,d-6,18,21,'hi',id);
  slab(x-w/2,y-d/2,w,d,39,5,'mid',id);
  slab(x-w/2+10,y-d/2+10,w-20,d-20,44,3,'hi',id);
 }
 if(id==='coater'){
  cyl(x,y,76,47,2,'lo',id);cyl(x,y,27,49,4,'mid',id);cyl(x,y,31,53,3,'hi',id);
  for(const dx of [-94,85])slab(x+dx,y-60,9,120,47,7,'mid',id);
 }else if(id==='stocker'){
  slab(x-60,y-62,120,5,47,48,'mid',id);
  for(const dx of [-60,55])slab(x+dx,y-57,5,110,47,48,'mid',id);
  for(let j=0;j<5;j++)slab(x-55,y-54,110,104,49+j*9,2,'hi',id);
 }else if(id==='dhp'||id==='hp'){
  slab(x-52,y-43,104,86,47,5,'lo',id);
  slab(x-46,y-37,92,74,52,4,'hi',id);
  for(const dx of [-62,54])for(const dy of [-48,40]){slab(x+dx,y+dy,8,8,47,93,'mid',id);slab(x+dx,y+dy,8,8,144,20,'mid',id);}
  slab(x-62,y-48,124,96,140,4,'mid',id);
  slab(x-46,y-37,92,74,144,.8,'hi',id);
  for(const dx of [-70,62])slab(x+dx,y+52,8,6,47,117,'hi',id);
  for(const dx of [-74,66])slab(x+dx,y-56,8,114,164,5,'hi',id);
 }else if(id==='ld'){
  for(const dx of [-64,52])slab(x+dx,y-14,12,28,25,32.5,'mid',id);
 }else{
  slab(x-52,y-43,104,86,47,5,'lo',id);
  slab(x-46,y-37,92,74,52,4,'hi',id);
  for(const dx of [-w/2+16,w/2-24])slab(x+dx,y-45,8,90,47,9,'mid',id);
 }
}
A.settle(R,P);R.items.sort((a,b)=>a.key-b.key);
A.auditOrExit(R,P);
const solids=R.items.map(i=>`<g data-device="${i.piece}">${i.svg}</g>`).join('');
const labels=stations.map(s=>{let [x,y]=k.iso([s.id==='ld'?s.x-140:s.x,s.id==='ld'?s.y+90:s.y+(s.y<0?-s.d/2-28:s.d/2+30),s.y<0?40:6],P);return `<g class="station-label" data-station="${s.id}" role="button" tabindex="0" aria-label="${s.title} ${s.cn}" transform="translate(${x},${y})"><rect x="-94" y="-22" width="188" height="48" rx="9"/><text text-anchor="middle" y="-3">${s.title}<tspan x="0" dy="18">${s.num} · ${s.cn}</tspan></text></g>`}).join('');
const surface=stations.map(s=>{
const p={x:s.x-s.w/2+4,y:s.y-s.d/2+4,w:s.w-8,d:s.d-8,r:3};
const surfaceZ=s.id==='ld'?25:48;
let out=`<path class="station-hit" data-station="${s.id}" d="${k.planOutline(p,surfaceZ,P)}"/><path class="station-glow" id="glow-${s.id}" d="${k.planOutline(p,surfaceZ,P)}"/>`;
const screws=k.corners(p,4).map(([x,y])=>k.iso([x,y,surfaceZ],P));out+=k.dotsSvg(screws,{size:1.2,tone:'lo'});
// Closed ventilation slots on the front cabinet face, plus a genuine panel seam.
const sp={x:s.x-s.w/2+3,y:s.y-s.d/2+3,w:s.w-6,d:s.d-6,r:2};out+=k.lineSvg(k.sideSeam(sp,s.id==='ld'?20:27,P,4),{tone:'faint'});
return out;}).join('');
const railTicks=k.topTicks(-430,430,20,5,-47,23,[3,5],P);
const railMarks=k.lineSvg(railTicks.minor,{tone:'lo'})+k.lineSvg(railTicks.major,{tone:'mid'});
const car=[]; const cs=(x,y,w,d,z,h,tone)=>car.push(k.solidSvg(k.slabOf({x,y,w,d,r:2},z,h,P,4,.6),{tone}));
for(const x of [-31,21])for(const y of [-47,32])cs(x,y,10,15,23,5,'lo');
cs(-39,-47,78,94,28,7,'mid');cs(-29,-33,58,66,35,13,'hi');cs(-43,-37,86,74,48,6,'mid');
const at0=k.iso([0,0,0],P);
const svg=`<svg id="line-scene" class="iso-figure" viewBox="0 0 1240 720" role="group" aria-label="光刻胶涂布产线，点击设备查看原理"><defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#edfaff" stop-opacity=".95"/><stop offset=".55" stop-color="#b7dce8" stop-opacity=".68"/><stop offset="1" stop-color="#e3f5fa"/></linearGradient><radialGradient id="resist"><stop stop-color="#a88de9"/><stop offset="1" stop-color="#7852c2"/></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="9"/></filter></defs><ellipse cx="620" cy="420" rx="460" ry="160" fill="#315366" opacity=".06" filter="url(#soft)"/>${solids}${surface}${railMarks}<g id="chamber-labels"></g><g id="thermal"></g><g id="carriage">${car.join('')}</g><g id="fork"></g><g id="ld-arms"></g><g id="mask"></g><g id="effects"></g>${labels}</svg>`;
writeFileSync(new URL('scene.svg',import.meta.url),svg);
writeFileSync(new URL('geometry.json',import.meta.url),JSON.stringify({projection:P,stations}));
await import('./pack.mjs');
console.log(`Built ${serial} static solids.`);
