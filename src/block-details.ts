import type { Building } from "./generation";
import type { Parcel } from "./parcels";

type Box = (material: number, w: number, h: number, d: number, x: number, y: number, z: number) => void;
type Solid = (x: number, y: number, z: number, w: number, h: number, d: number) => void;

// Plot-local output goes through City's existing instance/collision ownership.
export function buildBlockInterior(p: Parcel, add: Box, solid: Solid, palm: (x: number, z: number, h: number) => void) {
  const { x, z } = p, half = p.w / 2;
  const object: Box = (m,w,h,d,px,py,pz) => { add(m,w,h,d,px,py,pz); solid(px,py,pz,w,h,d); };
  const bench = (bx: number, bz: number) => {
    object(13,2.4,.18,.65,bx,.55,bz);
    add(13,2.4,.5,.12,bx,.95,bz+.3);
    for (const side of [-1,1]) add(15,.15,.5,.55,bx+side*.85,.25,bz);
  };
  const planter = (px: number, pz: number, tree: boolean) => {
    object(1,2.6,.45,2.6,px,.225,pz);
    add(17,2.25,.08,2.25,px,.48,pz);
    if (tree) palm(px,pz,7 + Math.abs(p.along % 4));
    else add(11,2.1,.6,2.1,px,.8,pz);
  };
  const bin = (px: number,pz: number) => {
    object(12,.7,1,.7,px,.5,pz); add(15,.8,.12,.8,px,1.06,pz);
    add(10,.3,.16,.02,px,.73,pz-.36);
  };
  object(1,p.w,.5,p.d,x,-.25,z);
  // An unobstructed perimeter and a through path make the spaces traversable.
  add(p.use === "depot" ? 18 : p.use === "market" ? 19 : 17,p.w-5,.045,p.d-5,x,.025,z);
  for (const side of [-1,1]) {
    add(19,p.w,.025,.035,x,.02,z+side*(half-2));
    add(19,.035,.025,p.d,x+side*(half-2),.02,z);
  }
  if (p.use === "apartments") {
    add(1,3,.06,p.d,x,.05,z);
    for (const side of [-1,1]) {
      planter(x+side*(half-5),z-half+5,true);
      planter(x+side*(half-5),z+half-5,true);
      bench(x+side*7,z-half+3.8);
    }
    bin(x+half-4,z-5);
    // Service cabinets at the rear, clear of the apartment and its front door.
    for (let i=0;i<3;i++) { object(12,1.1,1.2,1.1,x-3+i*1.6,.6,z+half-4); add(15,1.2,.1,1.2,x-3+i*1.6,1.25,z+half-4); }
  } else if (p.use === "court") {
    add(16,22,.06,34,x,.065,z);
    add(20,15,.03,28,x,.115,z);
    for (const side of [-1,1]) {
      const end=z+side*14;
      object(15,.18,4,.18,x,2,end+side*1.2);
      add(15,.14,.14,1.3,x,3.5,end+side*.6);
      object(10,1.8,1.1,.1,x,3.45,end);
      add(16,.65,.45,.12,x,3.3,end-side*.07);
      // Octagonal hoop and hanging net threads, below the backboard.
      for(let i=0;i<12;i++) {
        const a=i*Math.PI/6, hx=x+Math.cos(a)*.24, hz=end-side*.4+Math.sin(a)*.24;
        add(16,.13,.06,.13,hx,3.05,hz);
        add(10,.025,.38,.025,hx,2.83,hz);
      }
      // End fencing catches balls; both long sides have open pedestrian access.
      for(let dx=-10;dx<=10;dx+=2) object(15,.075,3,.075,x+dx,1.5,z+side*18);
      for(let y=.6;y<=3;y+=.6) add(15,20,.025,.025,x,y,z+side*18);
      bench(x+side*15,z-4); bench(x+side*15,z+4);
      planter(x+side*16,z+half-5,true);
    }
    bin(x-16,z-half+4);
  } else if (p.use === "market") {
    add(1,4,.06,p.d,x,.055,z);
    for (const side of [-1,1]) for(const dz of [-5,5]) {
      const sx=x+side*7, sz=z+dz, color=side===1?16:12;
      object(13,4,.95,2,sx,.475,sz);
      for(const dx of [-1.8,1.8]) object(15,.1,2.8,.1,sx+dx,1.4,sz);
      add(color,4.5,.18,3.5,sx,2.85,sz);
      for(let stripe=-1.8;stripe<2;stripe+=.75) add(10,.3,.035,3.5,sx+stripe,2.96,sz);
      add(color,4.5,.35,.08,sx,2.62,sz-1.75);
      for(let i=0;i<4;i++) {
        add(13,.7,.25,1.3,sx-1.4+i*.9,1.08,sz);
        add(i%2?14:11,.55,.3,1.05,sx-1.4+i*.9,1.3,sz);
      }
    }
    bench(x-6,z+half-3); bin(x+half-3,z+half-3);
  } else if (p.use === "depot") {
    // Corrugated containers, pallets and utility tanks leave a central service lane.
    const rows = p.d>30 ? [-10,4] : [-3];
    for(const side of [-1,1]) for(const dz of rows) {
      const cx=x+side*(half-6), cz=z+dz, color=side===1?12:16;
      object(color,5,2.8,10,cx,1.4,cz);
      for(let rib=-4.6;rib<5;rib+=.65) for(const edge of [-1,1]) add(10,.045,2.55,.09,cx+edge*2.52,1.4,cz+rib);
      add(15,.06,2.6,.08,cx,1.4,cz-5.04);
      for(const dx of [-1.2,1.2]) add(10,.055,2.4,.08,cx+dx,1.4,cz-5.06);
      add(10,1.3,.45,.06,cx-1.1,2.1,cz-5.08);
    }
    for(let i=0;i<3;i++) {
      const px=x-2+i*2,pz=z+half-4;
      object(13,1.6,.65,1.8,px,.325,pz);
      for(let slat=0;slat<4;slat++) add(14,.22,.08,1.8,px-.55+slat*.36,.7,pz);
    }
    for(const side of [-1,1]) add(14,.12,.02,p.d-4,x+side*3,.06,z);
  } else {
    add(1,2.8,.055,p.d,x,.05,z); add(1,p.w,.055,2.8,x,.05,z);
    if(p.w>20) {
      // A shaded picnic garden, with raised beds on the opposite side.
      const px=x-6,pz=z-6;
      for(const dx of [-2,2]) for(const dz of [-2,2]) object(13,.16,3,.16,px+dx,1.5,pz+dz);
      for(let dx=-2.4;dx<=2.5;dx+=.6) add(13,.16,.18,5,px+dx,3.1,pz);
      object(13,2.6,.16,1.3,px,.85,pz); bench(px,pz-1.5); bench(px,pz+1.5);
      planter(x+6,z-6,true); planter(x-6,z+6,true);
      bin(x+half-3,z+half-3);
    } else {
      planter(x-3.8,z-3.8,true); planter(x+3.8,z+3.8,false); bench(x+3.6,z-3.6);
    }
  }
}

// Back-of-house details give buildings a second face when viewed from alleys.
export function buildBuildingDetails(b: Building, add: Box, solid: Solid) {
  const rear=b.z+b.d/2, west=b.x-b.w/2;
  for(const side of [-1,1]) {
    add(15,.09,b.h,.09,b.x+side*(b.w/2-.4),b.h/2,rear+.15);
    add(10,.28,.13,b.d,b.x+side*b.w/2,b.h+.24,b.z);
  }
  if(b.style!=="house") {
    for(let i=0;i<2;i++) {
      const x=b.x-4+i*6,y=b.h+.9;
      add(1,3,1.3,2,x,y,b.z+1);
      for(let vent=0;vent<6;vent++) add(15,2.6,.045,.08,x,y-.45+vent*.17,b.z-.02);
      add(15,2.2,.08,1.4,x,y+.7,b.z+1);
    }
    add(15,b.w*.65,.16,.32,b.x,b.h+.3,b.z+4);
  }
  if(b.style === "shop" || b.style === "warehouse") {
    const x=west+3,z=rear+1.1;
    add(12,2.2,1.35,1.2,x,.675,z); solid(x,.675,z,2.2,1.35,1.2);
    add(15,2.35,.12,1.3,x,1.4,z);
    for(const side of [-1,1]) add(15,.22,.25,.22,x+side*.8,.15,z);
  }
  if(b.style === "apartment") for(let floor=1;floor<Math.floor(b.h/3);floor+=2) {
    const y=1.9+floor*2.8;
    add(1,1.2,.65,.6,west-.3,y-.65,b.z+3);
    for(let i=0;i<4;i++) add(15,.03,.06,.5,west-.92,y-.88+i*.14,b.z+3);
    add(13,2.8,.18,1.1,b.x+3,y-1,rear+.45);
    add(10,2.8,.6,.06,b.x+3,y-.65,rear+1);
    for(let i=0;i<3;i++) add(11,.6,.45,.4,b.x+2.1+i*.85,y-.55,rear+.65);
  }
}
