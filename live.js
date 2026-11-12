(() => {
'use strict';
const $=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
const lerp=(a,b,t)=>a+(b-a)*ease(t);
const byId=Object.fromEntries(STATIONS.map(s=>[s.id,s]));
const STEPS=[
{id:'ld',title:'LD/ULD · 装载',duration:14,description:'背面四角承托：90° → 75° → 水平，RGV 取出。'},
{id:'dhp',title:'DHP/CP · 脱水烘烤与冷却',duration:30,description:'下层 DHP 脱水烘烤 → RGV 取出、升层 → 上层 CP 冷却。'},
{id:'coater',title:'Coater · Spin Coating + Dry Step',duration:30,description:'旋转涂布 → 低速旋转 Dry Step（参考 3–6 RPM）→ 停止 → RGV 取出。'},
{id:'ebr',title:'EBR · 两轮边缘除胶',duration:30,description:'左右同时除胶 → 顺时针 90° → 另外两边除胶 → 逆时针 90° 恢复原向。'},
{id:'hp',title:'HP/CP · Soft Bake 与冷却',duration:30,description:'下层 HP 加热烘烤 → RGV 取出、升层 → 上层 CP 冷却。'},
{id:'ld',title:'LD/ULD · 卸载',duration:14,description:'RGV 水平放回，四角承托后翻转至 75°、90°。'}];
let total=0;STEPS.forEach(s=>{s.start=total;total+=s.duration});
const INFO={
ld:['LD / ULD','装载 / 卸载','两侧 Arm 从背面托住四角，支持 90°、75°、0° 姿态；RGV 水平取放。','无外框；Arm 套接与翻转驱动为示意。'],
dhp:['DHP / CP','脱水烘烤 / 冷却','下层 DHP 去除表面水分；RGV 收回、升层，送入上层 CP 冷却。','下层加热，上层冷却；层间搬运由 RGV 完成。'],
coater:['Coater','旋转涂布 / Spin Coating','矩形 Mask 在 Chuck 上旋转涂布，PR 从外缘覆盖至中心。随后留在 Chamber 内，以约 3–6 RPM 低速旋转预干燥；部分溶剂挥发后，停止旋转，由 RGV 取出。','Dry Step 不属于 HP 加热。转速为工艺参考；覆盖前沿为示意，不代表离心流向。'],
ebr:['EBR','边缘除胶 / Edge Bead Removal','左右两边同时除胶 → 顺时针 90° → 另外两边除胶 → 逆时针 90° 回位 → RGV 取出。','作用带为示意；角点标记方向，旋向按 Mask 正面俯视定义。'],
hp:['HP / CP','加热烘烤 / Soft Bake','EBR 后进入下层 HP 烘烤，再由 RGV 送入上层 CP 冷却，最后返回装卸位。','下层加热，上层冷却；区别于 Coater 内的 Dry Step。'],
stocker:['Mask Stocker','辅助存储','辅助存放 Mask，不进入六步主流程。','槽位与机柜细节为示意。']};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let time=0,playing=false,selected=null,modal=null,modalTime=0,modalPlaying=false,resumeLine=false,last=0,inView=true;
let prevStamp='',inspectStamp='';
const ui={play:$('#play'),prev:$('#prev'),next:$('#next'),mask:$('#mask'),fork:$('#fork'),car:$('#carriage'),effects:$('#effects'),thermal:$('#thermal')};
$('.timeline').innerHTML=STEPS.map((s,i)=>`<button class="step" data-step="${i}" aria-label="第 ${i+1} 步 ${s.title}"><em>STEP ${String(i+1).padStart(2,'0')}</em><b>${s.id==='ld'?'LD / ULD':INFO[s.id][0]}</b><small>${['装载','脱水烘烤 / 冷却','Spin Coating + Dry','边缘除胶','Soft Bake / 冷却','卸载'][i]}</small><i class="progress"></i></button>`).join('');
const LOW=57.5,UPPER=146.3,CARRY=66;
const ZEMPTY=z=>z-6, ZFORK=z=>z-3.5;
const THERMALS=['dhp','hp'],DETAILS=['ld','coater','ebr','dhp','hp'];
function coatingAt(p){
 p=clamp(p);const coat=ease(p/.62),dryStart=.68,stopStart=.96,finish=2520;
 // Main process: 21 visual seconds. 27 degrees/s illustrates 4.5 RPM; local playback shares this curve.
 const lowSlope=27*21,spinEnd=finish-lowSlope*(stopStart-dryStart+(1-stopStart)/2);
 let angle;if(p<dryStart){const q=p/dryStart;angle=spinEnd*ease(q)+lowSlope*dryStart*(q*q*q-q*q);}
 else if(p<stopStart)angle=spinEnd+lowSlope*(p-dryStart);
 else{const q=(p-stopStart)/(1-stopStart);angle=finish-lowSlope*(1-stopStart)/2*(1-q)*(1-q);}
 return {coat,angle,dry:p>=dryStart&&p<stopStart,holeRadius:29*(1-coat)};
}
function ebrAt(p){
 const ebrA=ease((p-.08)/.24),ebrB=ease((p-.46)/.26);
 const angle=p<.32?0:p<.46?90*ease((p-.32)/.14):p<.72?90:p<.86?90*(1-ease((p-.72)/.14)):0;
 const ebrPhase=p<.32?'round1':p<.46?'cw90':p<.72?'round2':p<.86?'ccw90':'ready';
 return {ebrA,ebrB,angle,ebrPhase,ebrRound:p>=.08&&p<.32?1:p>=.46&&p<.72?2:0,edge:(ebrA+ebrB)/2};
}
function loadTilt(t){return t<1.5?90:t<2.5?lerp(90,75,t-1.5):t<3.5?75:t<5.5?lerp(75,0,(t-3.5)/2):0;}
function unloadTilt(t){return t<6?0:t<8?lerp(0,75,(t-6)/2):t<10?75:t<12?lerp(75,90,(t-10)/2):90;}
function stateAt(t){
 t=clamp(t,0,total);let i=STEPS.findIndex(s=>t<s.start+s.duration);if(i<0)i=5;
 const step=STEPS[i],s=byId[step.id],local=t-step.start,prev=byId[STEPS[Math.max(0,i-1)].id];
 const fromCP=i>0&&THERMALS.includes(prev.id),arrivalHeight=fromCP?UPPER+8.5:CARRY,cpToCoater=fromCP&&s.id==='coater';
 const st={i,id:s.id,t:local,x:s.x,fy:0,fz:ZEMPTY(LOW),mx:s.x,my:s.y,mz:LOW,onRobot:false,phase:'',p:0,processing:false,coat:i>=3?1:0,edge:i>=4?1:0,angle:0,visible:true,localTray:false,chamber:null,thermalMode:null,dry:false,holeRadius:i>=3?0:29,status:'未处理',tilt:0,ldTilt:0,ldSupported:false,ebrA:i>=4?1:0,ebrB:i>=4?1:0,ebrPhase:'ready',ebrRound:0};
 const pickup=(u,z)=>{
  st.mz=z;st.fz=ZEMPTY(z);st.phase='RGV 伸入取 Mask';
  if(u<1)st.fy=lerp(0,s.y,u);
  else if(u<2){st.fy=s.y;st.fz=lerp(ZEMPTY(z),ZFORK(z+8.5),u-1);st.mz=Math.max(z,st.fz+3.5);st.onRobot=st.mz>z;st.phase='RGV 承托并抬升';}
  else{st.fz=ZFORK(z+8.5);st.fy=lerp(s.y,0,(u-2)/2);st.my=st.fy;st.mz=z+8.5;st.onRobot=true;st.phase='RGV 托架收回';}
 };
 const putUpper=u=>{
  st.fz=ZFORK(UPPER+8.5);st.mz=UPPER+8.5;st.onRobot=true;st.phase='RGV 放入上层 CP';
  if(u<1){st.fy=lerp(0,s.y,u);st.my=st.fy;}
  else if(u<1.5){st.fy=s.y;st.my=s.y;st.mz=lerp(UPPER+8.5,UPPER,(u-1)/.5);st.fz=ZFORK(st.mz);}
  else if(u<2){st.fy=s.y;st.my=s.y;st.mz=UPPER;st.onRobot=false;st.fz=lerp(ZFORK(UPPER),ZEMPTY(UPPER),(u-1.5)/.5);}
  else{st.fy=lerp(s.y,0,u-2);st.my=s.y;st.mz=UPPER;st.onRobot=false;st.fz=ZEMPTY(UPPER);}
 };
 if(i===0){
  st.x=lerp(-420,s.x,local/4);st.mx=s.x;st.my=s.y;st.ldTilt=loadTilt(local);st.tilt=st.ldTilt;st.ldSupported=true;
  if(local<1.5)st.phase='背面四角承托 · 垂直 90°';
  else if(local<2.5)st.phase='Size arm 翻转 · 90° → 75°';
  else if(local<3.5)st.phase='背面四角承托 · 保持 75°';
  else if(local<5.5)st.phase='Size arm 翻转 · 75° → 0°';
  else if(local<6)st.phase='水平 0° · 等待 RGV 交接';
  else if(local<10){pickup(local-6,LOW);st.ldSupported=!st.onRobot;st.phase='保持水平 0° · RGV 取出';}
  else{st.fz=ZFORK(CARRY);st.onRobot=true;st.ldSupported=false;st.my=0;st.mz=CARRY;st.phase='RGV 承载 · 水平转运';}
 }else if(local<5){
  st.phase=fromCP?'RGV 保持 CP 高度 · 沿轨道转运':'RGV 沿中央轨道转运';st.onRobot=true;st.my=0;st.mz=arrivalHeight;st.fz=ZFORK(arrivalHeight);
  if(local<2){st.x=lerp(prev.x,s.x,local/2);st.mx=st.x;}
  else if(fromCP&&!cpToCoater&&local<2.5){st.mz=lerp(arrivalHeight,CARRY,(local-2)/.5);st.fz=ZFORK(st.mz);st.phase='到达目标工位 · 下降至放片对接高度';}
  else if(local<3){const start=fromCP&&!cpToCoater?2.5:2;st.mz=cpToCoater?arrivalHeight:CARRY;st.fz=ZFORK(st.mz);st.fy=lerp(0,s.y,(local-start)/(3-start));st.my=st.fy;st.phase=cpToCoater?'保持 CP 高度 · 水平伸入 Coater':THERMALS.includes(s.id)?'RGV 伸入下层 Chamber':'RGV 前后方向伸出';}
  else if(local<3.5){st.fy=s.y;st.my=s.y;st.mz=lerp(cpToCoater?arrivalHeight:CARRY,LOW,(local-3)/.5);st.fz=ZFORK(st.mz);st.phase='RGV 放置 Mask';}
  else if(local<4){st.fy=s.y;st.my=s.y;st.onRobot=false;st.mz=LOW;st.fz=lerp(ZFORK(LOW),ZEMPTY(LOW),(local-3.5)/.5);st.phase='释放承托';}
  else{st.fy=lerp(s.y,0,local-4);st.fz=ZEMPTY(LOW);st.onRobot=false;st.my=s.y;st.mz=LOW;st.phase='空托架收回';}
  if(THERMALS.includes(s.id))st.chamber=st.onRobot?null:'lower';
 }else if(i===5){
  st.ldSupported=true;st.ldTilt=unloadTilt(local);st.tilt=st.ldTilt;
  st.phase=local<6?'水平交接完成 · 四角承托':local<8?'Size arm 翻转 · 0° → 75°':local<10?'背面四角承托 · 保持 75°':local<12?'Size arm 翻转 · 75° → 90°':local<13.5?'背面四角承托 · 垂直 90°':'全流程完成';
 }else if(THERMALS.includes(s.id)){
  const hotName=s.id==='dhp'?'DHP':'HP';
  if(local<11){st.processing=true;st.thermalMode='heat';st.chamber='lower';st.p=(local-5)/6;st.phase='下层 '+hotName+(s.id==='dhp'?' · 脱水烘烤':' · 加热烘烤');}
  else if(local<15){pickup(local-11,LOW);st.chamber=st.onRobot?null:'lower';st.phase='下层 '+hotName+' → RGV 取出';}
  else if(local<17){st.my=0;st.onRobot=true;st.mz=lerp(CARRY,UPPER+8.5,(local-15)/2);st.fz=ZFORK(st.mz);st.phase='RGV 收回后升层 · 下层 → 上层';}
  else if(local<20){putUpper(local-17);st.chamber=st.onRobot?null:'upper';}
  else if(local<25){st.mz=UPPER;st.fz=ZEMPTY(UPPER);st.processing=true;st.thermalMode='cool';st.chamber='upper';st.p=(local-20)/5;st.phase='上层 CP · 冷却';}
  else if(local<29){pickup(local-25,UPPER);st.chamber=st.onRobot?null:'upper';st.phase='上层 CP → RGV 取回';}
  else{st.onRobot=true;st.my=0;st.mz=UPPER+8.5;st.fz=ZFORK(st.mz);st.phase='RGV 收回 · 保持 CP 高度等待转运';}
 }else if(local<step.duration-4){
  st.processing=true;st.p=clamp((local-5)/(step.duration-9));
  if(i===2){Object.assign(st,coatingAt(st.p));st.phase=st.p<.12?'Spin Coating · PR 从外缘开始覆盖':st.p<.62?'旋转涂布 · 圆形未覆盖区缩小':st.p<.68?'PR 覆盖完成 · 减速进入 Dry Step':st.p<.96?'Dry Step · 低速旋转预干燥':'预干燥结束 · 减速停止';}
  if(i===3){Object.assign(st,ebrAt(st.p));st.phase=st.p<.08?'定位 · 准备第一轮除胶':st.ebrPhase==='round1'?'第一轮 · 左右两边同时除胶':st.ebrPhase==='cw90'?'Mask 顺时针旋转 90°':st.ebrPhase==='round2'?'第二轮 · 另外两边同时除胶':st.ebrPhase==='ccw90'?'Mask 逆时针旋转 90°':'恢复原向 · 等待 RGV 取出';}
 }else{pickup(local-(step.duration-4),LOW);st.coat=i>=2?1:0;st.edge=i>=3?1:0;}
 if(i===1)st.status=local<5?'未处理 · 转运至 DHP':local<11?'脱水烘烤中':local<20?'脱水烘烤后':local<25?'脱水后 · CP 冷却中':'脱水后 · 冷却完成';
 else if(i===2)st.status=local<5?'脱水后 · 冷却完成':local>=26?'涂胶完成 · 预干燥后':st.dry?'Dry Step · 低速旋转（参考 3–6 RPM）':st.p>=.96?'预干燥完成 · 减速停止':st.coat>=1?'涂胶完成':st.coat>0?'PR 覆盖中':'脱水后 · 冷却完成';
 else if(i===3)st.status=st.edge===1?'EBR 完成':st.edge>0?'边缘除胶中':'涂胶完成 · 预干燥后';
 else if(i===4)st.status=local<5?'EBR 完成':local<11?'HP 加热烘烤中':local<20?'Bake 完成':local<25?'Bake 后 · CP 冷却中':'Bake 后 · 冷却完成';
 else if(i===5)st.status='最终冷却完成 · 待卸载';
 if(i===5&&local>=13.5)st.status='完成工艺 · 已卸载';
 if(i===5&&local>=3.5&&local<5)st.ldSupported=true;
 if(i===3&&local>=26){st.ebrA=1;st.ebrB=1;st.ebrPhase='ready';}
 if(i!==2||!st.processing)st.holeRadius=st.coat>=1?0:29;
 return st;
}
const LD_CORNERS=[[-34,-26],[-34,26],[34,-26],[34,26]];
function ldWorld([u,v,t],cx,cy,cz,tilt){const a=-tilt*Math.PI/180;return [cx+u,cy+v*Math.cos(a)-t*Math.sin(a),cz+v*Math.sin(a)+t*Math.cos(a)];}
function planeMatrix(x,y,z,P,tilt=0){
 const o=iso([x,y,z],P),u=iso([x+1,y,z],P),a=-tilt*Math.PI/180,v=iso([x,y+Math.cos(a),z+Math.sin(a)],P);
 return `matrix(${u[0]-o[0]} ${u[1]-o[1]} ${v[0]-o[0]} ${v[1]-o[1]} ${o[0]} ${o[1]})`;
}
function boxTilt(x,y,w,d,z,h,cx,cy,cz,tilt,P,tint=false){
 const p=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]].map(q=>ldWorld(q,cx,cy,cz,tilt));
 const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],colors=tint?['#74b3bf','#caeaf0','#a6d4de','#90beca','#b6dce4','#87b7c4']:['#6b8593','#dce8ed','#c0d2db','#93aeba','#a9c1cc','#86a2b1'];
 return faces.map((f,i)=>({key:f.reduce((v,n)=>v+depthOf(p[n],P)/4,0),svg:`<path d="${pathOf(f.map(n=>iso(p[n],P)),true)}" fill="${colors[i]}" stroke="#5b7e8e" stroke-width=".65" stroke-linejoin="round"/>`})).sort((a,b)=>a.key-b.key).map(f=>f.svg).join('');
}
function ldArmArt(cx,cy,cz,tilt,P){
 const pieces=[];const put=(x,y,w,d,z,h,tint=false,corner=false)=>pieces.push({depth:depthOf(ldWorld([x+w/2,y+d/2,z+h/2],cx,cy,cz,tilt),P),svg:corner?`<g class="ld-corner-pad" data-support-side="back">${boxTilt(x,y,w,d,z,h,cx,cy,cz,tilt,P,tint)}</g>`:boxTilt(x,y,w,d,z,h,cx,cy,cz,tilt,P,tint)});
 for(const side of [-1,1]){
  const x=side<0?-37:31;
  put(x,-30,6,60,-7,3.5);
  put(side<0?-57:43,-5,14,10,-8,4);
  put(side<0?-43:34,-2.5,9,5,-7,2.8,true);
  for(const [x,y] of LD_CORNERS.filter(q=>Math.sign(q[0])===side))put(x-4,y-4,8,8,-3.5,2,true,true);
 }
 return `<g class="size-arms" data-tilt="${tilt}" data-support-corners="4" data-support-side="back">${pieces.sort((a,b)=>a.depth-b.depth).map(p=>p.svg).join('')}</g>`;
}
function ldAssembly(x,y,z,P,tilt,coat,edge,key){
 const arms=ldArmArt(x,y,z,tilt,P),glass=maskArt(x,y,z,P,coat,edge,0,key,1,tilt);
 const a=-tilt*Math.PI/180,camera=cameraOf(P),frontFacing=-Math.sin(a)*camera.sinA*camera.cosE+Math.cos(a)*camera.sinE;
 return `<g data-ld-tilt="${tilt}">${frontFacing>=0?arms+glass:glass+arms}</g>`;
}
function ebrFilm(w,h,a,b){
 const core=`<rect x="${-w/2+6}" y="${-h/2+6}" width="${w-12}" height="${h-12}" fill="#ad8cdb"/>`;
 const lr=6*(1-a),tb=6*(1-b);
 return `<g data-ebr-left-right="${a}" data-ebr-top-bottom="${b}">${core}<rect x="${-w/2+6-lr}" y="${-h/2}" width="${lr}" height="${h}" fill="#ad8cdb"/><rect x="${w/2-6}" y="${-h/2}" width="${lr}" height="${h}" fill="#ad8cdb"/><rect x="${-w/2+6}" y="${-h/2+6-tb}" width="${w-12}" height="${tb}" fill="#ad8cdb"/><rect x="${-w/2+6}" y="${h/2-6}" width="${w-12}" height="${tb}" fill="#ad8cdb"/></g>`;
}

function maskArt(x,y,z,P,coat=0,edge=0,angle=0,key='mask',size=1,tilt=0,ebr=null){
 const w=76*size,h=60*size,bd=6*size,per=2*(w-bd+h-bd),r=29*size*(1-coat);
 return `<g transform="${planeMatrix(x,y-1.5*Math.sin(tilt*Math.PI/180),z-1.5*Math.cos(tilt*Math.PI/180),P,tilt)}"><g transform="rotate(${angle})"><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="#7ba8b8" stroke="#577c8a" stroke-width="1"/></g></g><g transform="${planeMatrix(x,y,z,P,tilt)}"><g transform="rotate(${angle})"><defs><mask id="${key}-pr" maskUnits="userSpaceOnUse" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}"><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="white"/><circle data-hole-radius="${r}" r="${r}" fill="black"/></mask><clipPath id="${key}-clip"><rect x="${-w/2+1}" y="${-h/2+1}" width="${w-2}" height="${h-2}"/></clipPath></defs><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="url(#glass)" stroke="#6a99ad" stroke-width="1"/><g clip-path="url(#${key}-clip)">${ebr?ebrFilm(w,h,ebr.ebrA,ebr.ebrB):edge>0?`<rect x="${-w/2+bd}" y="${-h/2+bd}" width="${w-bd*2}" height="${h-bd*2}" fill="#ad8cdb"/><rect x="${-w/2+bd/2}" y="${-h/2+bd/2}" width="${w-bd}" height="${h-bd}" fill="none" stroke="#ad8cdb" stroke-width="${bd}" stroke-dasharray="${per*(1-edge)} ${per*edge+.001}" stroke-dashoffset="${-per*edge}"/>`:`<rect data-pr-coverage="${coat}" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" fill="#ad8cdb" opacity="${Math.min(1,coat*18)}" mask="url(#${key}-pr)"/>`}</g><path d="M${-w/2+3},${h/2-4} L${-w/2+3},${-h/2+3} L${w/2-4},${-h/2+3}" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1"/>${ebr?`<circle cx="${-w/2+7}" cy="${-h/2+7}" r="2" fill="#376c87"/>`:''}${!ebr&&edge>0&&edge<1?`<rect x="${-w/2+bd/2}" y="${-h/2+bd/2}" width="${w-bd}" height="${h-bd}" fill="none" stroke="#22b3bc" stroke-width="${bd+1}" stroke-opacity=".6" stroke-dasharray="${per*.045} ${per*.955}" stroke-dashoffset="${-per*edge}"/>`:''}</g></g>`;
}
function slabArt(x,y,w,d,z,h,P,tone='mid'){return solidSvg(slabOf({x,y,w,d,r:1},z,h,P,3,.3),{tone})}
function forkArt(st){
 const len=Math.abs(st.fy),y0=Math.min(0,st.fy),h=st.fz;
 return slabArt(st.x-20,-27,40,54,44,Math.max(.5,h-44),LINE_P,'mid')+
 [-24,17].map(dx=>slabArt(st.x+dx,y0-22,7,len+44,h,2,LINE_P,'hi')).join('');
}
function processEffects(id,p,x,y,z,P,scale=1,mode=null){
 let out='';const pt=(xx,yy,zz)=>iso([xx,yy,zz],P);
 if(id==='ebr'){const e=ebrAt(p);if(e.ebrRound){const half=e.ebrRound===1?38:30,reach=e.ebrRound===1?30:38;out+=`<g data-ebr-round="${e.ebrRound}" transform="${topMatrix([x,y],z+.2,P)}">${[-1,1].map(side=>`<rect x="${side*half-2}" y="${-reach}" width="4" height="${reach*2}" rx="1" fill="#35acb6" opacity=".65"/>`).join('')}</g>`;}}else if(id==='coater'&&p<.2){
  const a=Math.sin(Math.PI*clamp(p/.2));
  for(let j=0;j<4;j++){const yy=j<2?-27:27,xx=j%2?-34:34,q=(p*12+j/4)%1,pos=pt(x+xx,y+yy,z+22*(1-q));out+=`<circle cx="${pos[0]}" cy="${pos[1]}" r="2.3" fill="#9c73c9" opacity="${a}"/>`;}
 }else if((id==='coater'&&p>=.68&&p<.96)||mode==='heat'){
  const dry=id==='coater',q=dry?(p-.68)/.28:p,color=dry?'#8a91a5':'#dc9a52';
  for(let j=0;j<8;j++){const v=(q*2+j/8)%1,pos=pt(x+(j%3-1)*22,y+(Math.floor(j/3)-1)*17,z+v*32);out+=`<ellipse cx="${pos[0]}" cy="${pos[1]}" rx="1.7" ry="3.3" fill="${color}" opacity="${Math.sin(Math.PI*v)*.55}"/>`;}
 }else if(mode==='cool'){
  for(let j=0;j<8;j++){const v=(p*2+j/8)%1,pos=pt(x+(j%3-1)*22,y+(Math.floor(j/3)-1)*17,z+(1-v)*28);out+=`<circle cx="${pos[0]}" cy="${pos[1]}" r="1.9" fill="#54a9c3" opacity="${Math.sin(Math.PI*v)*.65}"/>`;}
 }
 return out;
}
const localBounds=[...boxCorners({x:-77,y:-77,w:154,d:154,r:1},-18,0),[0,0,58]];
const localP=fitProjection(localBounds,360,240,{pad:18,azimuth:65,elevation:40});
const detailP=fitProjection(localBounds,760,430,{pad:28,azimuth:65,elevation:40});
const chamberBounds=[...boxCorners({x:-80,y:-180,w:160,d:245,r:1},6,174)];
const chamberLocalP=fitProjection(chamberBounds,360,240,{pad:14,azimuth:57,elevation:32});
const chamberDetailP=fitProjection(chamberBounds,760,430,{pad:24,azimuth:57,elevation:32});
function chamberStructure(P){
 const parts=[];const put=(x,y,w,d,z,h,tone)=>parts.push({key:depthOf([x+w/2,y+d/2,z+h/2],P),svg:slabArt(x,y,w,d,z,h,P,tone)});
 put(-75,-60,150,120,6,12,'lo');put(-70,-55,140,110,18,29,'hi');put(-52,-43,104,86,47,5,'lo');put(-46,-37,92,74,52,4,'hi');
 for(const x of [-62,54])for(const y of [-48,40]){put(x,y,8,8,47,93,'mid');put(x,y,8,8,144,20,'mid');}
 put(-62,-48,124,96,140,4,'mid');put(-46,-37,92,74,144,.8,'hi');
 for(const x of [-70,62])put(x,52,8,6,47,117,'hi');for(const x of [-74,66])put(x,-56,8,114,164,5,'hi');
 return parts.sort((a,b)=>a.key-b.key).map(p=>p.svg).join('');
}
function chip(P,point,label,active,color){const [x,y]=iso(point,P);return `<g transform="translate(${x},${y})" class="chamber-chip"><rect x="-38" y="-10" width="76" height="20" rx="4" fill="${active?color:'#f7fafb'}" stroke="${color}" stroke-opacity=".6"/><text text-anchor="middle" y="3" font-size="10" fill="${active?'#fff':'#476773'}" font-weight="650">${label}</text></g>`;}
function thermalPicture(id,p,P,key){
 const i=id==='dhp'?1:4,s=byId[id],st=stateAt(STEPS[i].start+5+Math.min(.999999,p)*25),factor=.76;
 let out=slabArt(-82,-170,164,80,0,3,P,'lo')+[-157,-109].map(y=>slabArt(-78,y,156,6,3,3,P,'mid')).join('')+chamberStructure(P);
 const z=st.mz,fy=st.fy*factor-130,mY=(st.my-s.y)*factor;
 out+=slabArt(-36,-158,72,56,6,12,P,'lo')+slabArt(-23,-150,46,40,18,30,P,'mid');
 out+=slabArt(-16,-148,32,36,48,Math.max(.5,st.fz-48),P,'mid');
 out+=[-24,17].map(x=>slabArt(x,Math.min(-130,fy)-22,7,Math.abs(fy+130)+44,st.fz,2,P,'hi')).join('');
 out+=maskArt(0,mY,z,P,id==='hp'?1:0,id==='hp'?1:0,0,key);
 if(st.processing)out+=processEffects(id,st.p,0,mY,z,P,1,st.thermalMode);
 out+=chip(P,[58,50,UPPER+10],'上层 CP',st.chamber==='upper','#409ebc')+chip(P,[58,50,LOW+10],'下层 '+(id==='dhp'?'DHP':'HP'),st.chamber==='lower','#cf9150');
 const q=iso([-34,-163,27],P);out+=`<text x="${q[0]}" y="${q[1]}" fill="#286f7d" font-size="11" font-weight="600">RGV</text>`;
 return out;
}
const ldBounds=boxCorners({x:-85,y:-175,w:170,d:245,r:1},6,UPPER+8.5);
const ldMiniP=fitProjection(ldBounds,360,240,{pad:16,azimuth:63,elevation:28});
const ldDetailP=fitProjection(ldBounds,760,430,{pad:26,azimuth:63,elevation:28});
function ldDetailModel(p){const t=clamp(p)*28;return t<14?stateAt(Math.min(13.999999,t)):stateAt(STEPS[5].start+Math.min(13.999999,t-14));}
function ldPicture(p,P,key,source=null){
 const st=source||ldDetailModel(p),y=(st.my-byId.ld.y)*.76,fy=st.fy*.76-130;
 let out=slabArt(-78,-65,156,130,6,12,P,'lo')+slabArt(-72,-59,144,118,18,4,P,'hi')+slabArt(-78,-65,156,130,22,3,P,'mid');
 for(const x of [-64,52])out+=slabArt(x,-14,12,28,25,32.5,P,'mid');
 out+=slabArt(-82,-170,164,80,0,3,P,'lo')+[-157,-109].map(v=>slabArt(-78,v,156,6,3,3,P,'mid')).join('');
 out+=slabArt(-36,-158,72,56,6,12,P,'mid')+slabArt(-23,-150,46,40,18,26,P,'hi')+slabArt(-16,-148,32,36,44,Math.max(.5,st.fz-44),P,'mid');
 out+=[-24,17].map(x=>slabArt(x,Math.min(-130,fy)-22,7,Math.abs(fy+130)+44,st.fz,2,P,'hi')).join('');
 if(st.ldSupported)out+=ldAssembly(0,0,LOW,P,st.ldTilt,st.coat,st.edge,key);
 else out+=ldArmArt(0,0,LOW,st.ldTilt,P)+maskArt(0,y,st.mz,P,st.coat,st.edge,0,key);
 const tag=iso([-64,64,30],P),tip=iso([0,-174,27],P);
 out+=`<text x="${tag[0]}" y="${tag[1]}" fill="#237d87" font-size="12" font-weight="650">SIZE ARM · 背面四角</text><text x="${tip[0]}" y="${tip[1]}" fill="#237d87" font-size="11">RGV</text>`;
 return out;
}

function processPicture(id,p,P,key,active=true){
 if(id==='ld')return ldPicture(p,key==='mini'?ldMiniP:ldDetailP,key);
 if(THERMALS.includes(id))return thermalPicture(id,p,key==='mini'?chamberLocalP:chamberDetailP,key);
 let out='';const base=id==='coater'?slabArt(-77,-77,154,154,-18,8,P,'lo')+slabArt(-73,-73,146,146,-10,6,P,'hi'):slabArt(-68,-56,136,112,-18,8,P,'lo')+slabArt(-62,-50,124,100,-10,6,P,'hi');out+=base;
 if(id==='coater')out+=solidSvg(cylinder(0,0,68,-4,3,P,64),{tone:'lo'})+solidSvg(cylinder(0,0,21,-1,3,P,48),{tone:'mid'});
 else out+=slabArt(-43,-34,86,68,-4,6,P,'mid');
 const e=id==='ebr'?ebrAt(p):null,coat=id==='coater'?coatingAt(p).coat:(id==='ebr'?1:0),edge=e?e.edge:0,angle=id==='coater'?coatingAt(p).angle:e?e.angle:0;
 out+=maskArt(0,0,3,P,coat,edge,angle,key,1,0,e);if(active)out+=processEffects(id,p,0,0,5,P);
 return out;
}
function miniPicture(id,st){
 if(id==='ld')return ldPicture(0,ldMiniP,'mini',st.id==='ld'?st:null);
 if(id==='stocker')return `<g transform="translate(100,40)"><rect width="155" height="164" rx="5" fill="#e1e9ed" stroke="#9eb1ba"/>${[0,1,2,3,4].map(j=>`<rect x="15" y="${15+j*28}" width="125" height="11" rx="2" fill="#f7fbfc" stroke="#9eb1ba"/>`).join('')}</g>`;
 const live=id===st.id&&st.processing;
 let p=live?st.p:st.i>2&&id==='coater'?1:st.i>3&&id==='ebr'?1:0;
 if(THERMALS.includes(id))p=id===st.id?clamp((st.t-5)/25):0;
 return processPicture(id,p,localP,'mini',live);
}
function setInspection(st){
 const id=selected||st.id,info=INFO[id],stamp=id+'|'+Boolean(selected);
 if(stamp!==inspectStamp){inspectStamp=stamp;$('#inspect-title').textContent=info[0];$('#inspect-cn').textContent=info[1];$('#inspect-description').textContent=info[2];$('#inspect-note').textContent=info[3];$('#inspector-mode').textContent=selected?'STATION GUIDE / 工位原理':'CURRENT STATION / 当前工位';$('#browse-note').classList.toggle('hidden',!selected);$('#inspect-action').textContent=DETAILS.includes(id)?'↗ 查看局部原理':'↩ 跟随当前工位';}
 $('#mini').innerHTML=miniPicture(id,st);
}
function draw(){
 const st=stateAt(time),step=STEPS[st.i];
 ui.car.setAttribute('transform',translateAlong(LINE_P,[st.x,0,0]));ui.fork.innerHTML=forkArt(st);
 const ld=byId.ld;$('#ld-arms').innerHTML=st.ldSupported?'':ldArmArt(ld.x,ld.y,LOW,st.id==='ld'?st.ldTilt:0,LINE_P);
 ui.mask.innerHTML=st.ldSupported?ldAssembly(st.mx,st.my,st.mz,LINE_P,st.tilt,st.coat,st.edge,'main'):maskArt(st.mx,st.my,st.mz,LINE_P,st.coat,st.edge,st.angle,'main',1,st.tilt,st.id==='ebr'&&st.processing?st:null);
 ui.effects.innerHTML=st.processing?processEffects(st.id,st.p,st.mx,st.my,st.mz,LINE_P,1,st.thermalMode):'';
 const s=byId[st.id];ui.thermal.innerHTML=st.processing&&THERMALS.includes(st.id)?`<path d="${planOutline({x:s.x-46,y:s.y-37,w:92,d:74,r:1},st.mz-1.4,LINE_P)}" fill="${st.thermalMode==='heat'?'#e8a253':'#64b5ce'}" opacity=".38"/>`:'';
 $('#chamber-labels').innerHTML=THERMALS.map(id=>{const q=byId[id];return chip(LINE_P,[q.x+74,q.y+42,UPPER+6],'上层 CP',st.id===id&&st.chamber==='upper','#409ebc')+chip(LINE_P,[q.x+74,q.y+42,LOW+6],'下层 '+(id==='dhp'?'DHP':'HP'),st.id===id&&st.chamber==='lower','#cf9150')}).join('');
 $('#mask-state').textContent=st.status;$('#inspect-current').textContent=(selected&&selected!==st.id)?'主流程：该工位待机':'主流程：'+st.phase;
 all('.station-label').forEach(el=>{el.classList.toggle('active',el.dataset.station===st.id);el.classList.toggle('selected',el.dataset.station===selected)});
 all('.station-glow').forEach(el=>el.classList.toggle('active',el.id==='glow-'+st.id));
 all('.step').forEach((el,i)=>{el.classList.toggle('active',i===st.i);el.setAttribute('aria-current',i===st.i?'step':'false');el.querySelector('.progress').style.transform=`scaleX(${clamp((time-STEPS[i].start)/STEPS[i].duration)})`;});
 const stamp=st.i+'|'+st.phase;
 if(stamp!==prevStamp){prevStamp=stamp;$('#step-num').textContent=String(st.i+1).padStart(2,'0');$('#step-title').textContent=step.title;$('#step-explanation').textContent=step.description;$('#phase-label').textContent=st.phase;}
 $('#carrier-readout').textContent=st.onRobot?'RGV 承载 Mask':st.i===5&&st.t>=13.5?'卸载完成':'Mask 位于 '+INFO[st.id][0];
 ui.play.textContent=playing?'Ⅱ Pause / 暂停':time>=total?'↻ 再次播放':'▶ Play / 播放';ui.prev.disabled=st.i===0;ui.next.disabled=st.i===5;
 setInspection(st);$('#line-scene').dataset.step=String(st.i+1);$('#line-scene').dataset.phase=st.phase;
}
function jump(i){i=clamp(i,0,5);time=STEPS[i].start;playing=false;selected=null;draw();}
function toggle(){if(reduced.matches){if(time>=total)time=0;time=Math.min(total,time+2);playing=false;}else{if(time>=total)time=0;playing=!playing;}draw();}
ui.play.addEventListener('click',toggle);ui.prev.addEventListener('click',()=>jump(stateAt(time).i-1));ui.next.addEventListener('click',()=>jump(stateAt(time).i+1));
$('#replay').addEventListener('click',()=>{time=0;selected=null;playing=!reduced.matches;draw()});
all('[data-step]').forEach(el=>el.addEventListener('click',()=>jump(Number(el.dataset.step))));
function choose(id){selected=id;draw();if(DETAILS.includes(id))openDetail(id);}
all('[data-station]').forEach(el=>{el.addEventListener('click',()=>choose(el.dataset.station));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(el.dataset.station)}})});
all('[data-device]').forEach(el=>{if(byId[el.dataset.device]){el.style.cursor='pointer';el.addEventListener('click',()=>choose(el.dataset.device))}});
$('#inspect-action').addEventListener('click',()=>{const id=selected||stateAt(time).id;if(DETAILS.includes(id))openDetail(id);else{selected=null;draw()}});
const SEQUENCES={coater:['外缘开始覆盖','圆形区域缩小','圆形区域归零','Dry Step · 低速旋转预干燥','减速停止 · 等待取片'],ebr:['左右两边同时除胶','顺时针 90°','另外两边除胶','逆时针 90°','原向恢复 · 待取出'],ld:['垂直 90°','倾斜 75°','水平 0°','RGV 水平取出','RGV 水平放回','交接后翻转'],dhp:['下层 DHP 加热','RGV 取出并升层','上层 CP 冷却','冷却完成取回'],hp:['下层 HP 加热','RGV 取出并升层','上层 CP 冷却','冷却完成取回']};
const detailDuration=id=>id==='ld'?28:THERMALS.includes(id)?25:18;
const detailPhase=(id,p)=>id==='ld'?(p*28<1.5?0:p*28<3.5?1:p*28<6?2:p*28<14?3:p*28<20?4:5):THERMALS.includes(id)?(p<6/25?0:p<15/25?1:p<20/25?2:3):id==='coater'?(p<.12?0:p<.62?1:p<.68?2:p<.96?3:4):(p<.32?0:p<.46?1:p<.72?2:p<.86?3:4);
function openDetail(id){resumeLine=playing;playing=false;modal=id;const current=stateAt(time);modalTime=current.id!==id?0:id==='ld'?(current.i===5?14:0)+current.t:THERMALS.includes(id)?clamp(current.t-5,0,25):current.processing?current.p*detailDuration(id):current.t>=STEPS[current.i].duration-4?detailDuration(id):0;modalPlaying=!reduced.matches;$('#detail .eyebrow').textContent=THERMALS.includes(id)?'CHAMBER / 两层腔室原理':'PROCESS / 局部工艺原理';$('#detail-title').textContent=INFO[id][0]+' · '+INFO[id][1];$('#detail-description').textContent=INFO[id][2]+' '+INFO[id][3];$('#detail-sequence').innerHTML=SEQUENCES[id].map(x=>`<span>${x}</span>`).join('');$('#detail').showModal();draw();drawDetail();}
function closeDetail(){if(!modal)return;modal=null;$('#detail').close();playing=resumeLine&&!reduced.matches;selected=null;draw()}
$('#close-detail').addEventListener('click',closeDetail);$('#detail').addEventListener('cancel',e=>{e.preventDefault();closeDetail()});
$('#detail-play').addEventListener('click',()=>{if(reduced.matches)modalTime=(modalTime+2)%(detailDuration(modal)+2);else modalPlaying=!modalPlaying;drawDetail()});
function drawDetail(){if(!modal)return;const p=clamp(modalTime/detailDuration(modal));$('#detail-svg').innerHTML=processPicture(modal,p,detailP,'detail',true);const phase=detailPhase(modal,p);all('#detail-sequence span').forEach((el,i)=>el.classList.toggle('on',i===phase));$('#detail-phase').textContent=modal==='ld'?(p>=.5&&p*28-14<6?'RGV 水平放回 · 机构保持 0°':ldDetailModel(p).phase):SEQUENCES[modal][phase];$('#detail-play').textContent=reduced.matches?'推进局部':modalPlaying?'Ⅱ 暂停局部':'▶ 播放局部';}
function motionSetting(){if(reduced.matches){playing=false;modalPlaying=false;$('#motion-tip').textContent='减少动态：播放按钮分段推进。'}else $('#motion-tip').textContent='Space 播放/暂停 · ← → 切换步骤';draw();}
reduced.addEventListener('change',motionSetting);
document.addEventListener('keydown',e=>{if(modal){if(e.key==='Escape'){e.preventDefault();closeDetail()}return;}if(e.code==='Space'&&!e.target.closest('button,[role="button"]')){e.preventDefault();toggle()}else if(e.key==='ArrowRight'){e.preventDefault();jump(stateAt(time).i+1)}else if(e.key==='ArrowLeft'){e.preventDefault();jump(stateAt(time).i-1)}});
new IntersectionObserver(entries=>{inView=entries.at(-1).isIntersecting}).observe($('.workspace'));
function tick(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!document.hidden&&(inView||modal)){if(modal&&modalPlaying&&!reduced.matches){modalTime=(modalTime+dt)%(detailDuration(modal)+2);drawDetail()}else if(playing&&!reduced.matches){time=Math.min(total,time+dt);if(time===total)playing=false;draw()}}requestAnimationFrame(tick)}
window.CoaterDemo={get state(){return {...stateAt(time),time,total,playing,modal,modalTime}},steps:STEPS,model:stateAt,ldContacts(tilt){return LD_CORNERS.map(([x,y])=>ldWorld([x,y,-1.5],0,0,LOW,tilt))},seek(t){time=clamp(t,0,total);playing=false;draw()},get detailState(){return {modal,modalTime,modalPlaying}},seekDetail(t){modalTime=clamp(t,0,detailDuration(modal)+2);modalPlaying=false;drawDetail()}};
motionSetting();draw();requestAnimationFrame(tick);
})();
