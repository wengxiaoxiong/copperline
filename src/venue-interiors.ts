import type { Building } from "./generation";
type Box=(m:number,w:number,h:number,d:number,x:number,y:number,z:number)=>void;
type Solid=(x:number,y:number,z:number,w:number,h:number,d:number)=>void;

// Food venues use seating and a kitchen counter instead of supermarket aisles.
export function buildFoodInterior(b:Building,add:Box,solid:Solid) {
  const halfW=b.w/2-.35, halfD=b.d/2-.35, accent=b.venue==="burger"?16:12;
  const object:Box=(m,w,h,d,x,y,z)=>{add(m,w,h,d,x,y,z);solid(x,y,z,w,h,d);};
  object(accent,b.w-3,1,.9,0,.62,halfD-3);
  add(10,b.w-2.8,.13,1.1,0,1.2,halfD-3);
  object(1,b.w-3,1,.65,0,.62,halfD-.6);
  for(let i=-1;i<=1;i++) {
    add(15,1.8,.08,.55,i*2.8,1.15,halfD-.6);
    add(10,1.8,.06,.5,i*2.8,1.28,halfD-.6);
    add(15,.12,1.6,.12,i*2.8,2,halfD-.35);
  }
  if(b.venue==="cafe") {
    add(15,1.4,.7,.6,-halfW+2,1.6,halfD-3);
    add(10,1.3,.15,.7,-halfW+2,1.24,halfD-3);
    for(let i=0;i<5;i++) {add(10,.12,.18,.12,-halfW+3.3+i*.25,1.37,halfD-3);add(14,.7,.13,.4,1+i*.9,1.32,halfD-3);}
  } else {
    add(1,4,.65,1.2,1,2.7,halfD-1);add(15,.8,b.h-3,.8,1,(b.h+3)/2,halfD-1);
    for(let i=0;i<4;i++)add(15,.6,.05,.45,-2+i*1.2,1.34,halfD-.6);
  }
  // Booths hug the side walls; the full middle corridor stays free.
  for(const side of [-1,1]) for(const z of [-halfD+4,-halfD+8]) {
    const x=side*(halfW-1.65);
    if(Math.abs(x-(b.entrance?.x ?? 0)) < (b.entrance?.w ?? 2)/2+1.2) continue;
    object(13,1.6,.12,1.3,x,.88,z);
    for(const dz of [-1.15,1.15]) {
      object(accent,1.8,.5,.65,x,.4,z+dz);object(accent,1.8,.8,.18,x,.9,z+dz+Math.sign(dz)*.28);
    }
    add(10,.2,.18,.2,x,.99,z);add(14,.12,.23,.12,x+.4,1.02,z);
  }
  for(const side of [-1,1])add(14,.55,.1,1.2,side*(halfW-1.6),b.h-.4,-3);
  return [{x:0,y:Math.min(b.h-.35,3.3),z:-3,color:0xffe4b8},{x:0,y:Math.min(b.h-.35,3.3),z:halfD-3,color:0xffebcd}];
}
