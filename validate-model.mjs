import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('live.js',import.meta.url),'utf8');
const stations=JSON.parse(readFileSync(new URL('geometry.json',import.meta.url),'utf8')).stations;
const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context=vm.createContext({STATIONS:stations});
vm.runInContext(extract('const clamp=','const INFO=')+extract('const LOW=','function maskArt(')+';globalThis.D={model:stateAt,steps:STEPS,total,corners:LD_CORNERS,world:ldWorld};',context);
const {model,steps,total}=context.D;const failures=new Set();let samples=0;
const check=(value,label)=>{if(!value)failures.add(label)};
check(steps.map(x=>x.id).join(',')==='ld,dhp,coater,ebr,hp,ld','main station order');
for(let t=0;t<total;t+=.01){samples++;const s=model(t),n=model(Math.min(total,t+.0001));
 check(s.id!=='stocker','stocker in main flow');
 check(Math.hypot(s.mx-n.mx,s.my-n.my,s.mz-n.mz)<.2,'mask position discontinuity');
 if(s.onRobot){check(Math.abs(s.my-s.fy)<1e-6&&Math.abs(s.mx-s.x)<1e-6,'mask/fork planar alignment');check(Math.abs(s.mz-s.fz-3.5)<1e-6,'mask/fork support height');}
 if(Math.abs(n.x-s.x)>1e-5&&s.i>0)check(s.onRobot&&Math.abs(s.fy)<1e-6,'rail move before fork retraction');
 if(s.id==='ld'&&Math.abs(s.my)>1e-6)check(s.mx===-280,'LD lateral loading');
 if(s.id==='ld'&&(s.onRobot||s.fy!==0))check(s.tilt===0&&s.ldTilt===0,'RGV LD handoff not horizontal');
 if(s.tilt!==0)check(s.ldSupported&&!s.onRobot&&s.id==='ld','tilt without size-arm support');
 if(s.ldSupported)check(s.mx===-280&&s.my===172&&s.mz===57.5,'LD mask drifts off arms');
 if(s.id==='ebr'&&s.processing){
  if(s.ebrB>0)check(s.ebrA===1,'second round before first');
  if(s.ebrRound===1)check(s.angle===0&&s.ebrB===0,'round1 angle or four-edge treatment');
  if(s.ebrRound===2)check(s.angle===90&&s.ebrA===1,'round2 angle');
  if(s.ebrPhase==='ready')check(s.angle===0&&s.ebrA===1&&s.ebrB===1,'EBR takeout before return');
 }
 if(s.dry){check(s.coat===1&&s.holeRadius===0&&!s.onRobot&&s.processing,'dry prior to full coverage');const da=((n.angle-s.angle)%360+360)%360;check(da>0&&da<.01,'dry fails to rotate slowly');}
 const maskMoves=Math.hypot(s.mx-n.mx,s.my-n.my,s.mz-n.mz)>1e-5;
 if(maskMoves)check(s.onRobot||n.onRobot||s.localTray||n.localTray,'mask moves without a carrier');
}
for(const step of steps.slice(1)){const a=model(step.start-1e-6),b=model(step.start);check(Math.hypot(a.mx-b.mx,a.my-b.my,a.mz-b.mz)<.001,'mask boundary discontinuity');check(a.coat===b.coat&&a.edge===b.edge,'coating state boundary discontinuity');}
for(const index of [1,4]){const start=steps[index].start,a=model(start+8),b=model(start+16),c=model(start+22),d=model(start+29.9);check(a.chamber==='lower'&&a.thermalMode==='heat'&&a.mz===57.5,'lower chamber heating');check(b.onRobot&&b.my===0&&b.mz>66,'RGV retracted layer change');check(c.chamber==='upper'&&c.thermalMode==='cool'&&c.mz===146.3,'upper chamber cooling');check(d.onRobot&&d.my===0,'cooled mask return');check(d.mz===154.8,'CP exit descended');const travel=model(steps[index+1].start+1),arrival=model(steps[index+1].start+2.25);check(travel.mz===154.8&&travel.fy===0,'CP horizontal travel changed height');check(arrival.x===stations.find(s=>s.id===steps[index+1].id).x,'CP arrival position');if(index===1){
 for(let u=0;u<=3;u+=.01){const v=model(steps[2].start+u);check(v.mz===154.8,'CP to Coater lowered before full insertion');}
 const inserted=model(steps[2].start+3),lowering=model(steps[2].start+3.25),placed=model(steps[2].start+3.5);
 check(inserted.my===stations.find(s=>s.id==='coater').y&&inserted.mz===154.8,'Coater full insertion height');
 check(lowering.my===inserted.my&&lowering.mz<154.8&&lowering.mz>57.5,'Coater descent before internal position');
 check(placed.my===inserted.my&&placed.mz===57.5&&!placed.onRobot,'Coater placement');
}else check(arrival.mz<154.8&&arrival.mz>66&&arrival.fy===0,'CP to LD arrival changed');}
let prior=29;for(let i=0;i<=1000;i++){const s=model(steps[2].start+5+i/1000*20.999);check(s.holeRadius<=prior+1e-8,'PR hole not monotonic');prior=s.holeRadius;}check(prior===0,'PR hole does not reach zero');
for(const [t,a] of [[0,90],[3,75],[5.8,0],[steps[5].start+8.5,75],[total,90]])check(model(t).tilt===a,'LD named pose '+a);
check(context.D.world([0,26,0],0,0,57.5,75)[2]<57.5,'LD flip direction reversed incorrectly');
const eb=steps[3].start;check(model(eb+27).angle===0&&model(eb+27).edge===1,'EBR retrieval not in original orientation');
for(let angle=0;angle<=90;angle+=.1){for(const [u,v] of context.D.corners){const p=context.D.world([u,v,-1.5],0,0,57.5,angle),q=context.D.world([u,v,0],0,0,57.5,angle);check(Math.abs(Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])-1.5)<1e-8,'rear pad contact');check(p[2]>25,'LD substrate/base intersection');}}
console.log(JSON.stringify({pass:failures.size===0,samples,steps:steps.map(x=>x.id),animationDuration:total,failures:[...failures]},null,2));
if(failures.size)process.exitCode=1;
