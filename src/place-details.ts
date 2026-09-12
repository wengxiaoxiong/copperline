import * as T from "three";
import type { Building } from "./generation";
import type { Parcel } from "./parcels";
import { VENUES, VENUE_TYPES, type Venue } from "./venues";

type Box = (material: number, w: number, h: number, d: number, x: number, y: number, z: number) => void;
type Solid = (x: number, y: number, z: number, w: number, h: number, d: number) => void;

function sign(background: string, title: string, subtitle: string, width=1024, height=256) {
  const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
  const c=canvas.getContext("2d")!;
  c.fillStyle=background; c.fillRect(0,0,width,height);
  c.strokeStyle="#f5e9cc"; c.lineWidth=4; c.strokeRect(12,12,width-24,height-24);
  c.textAlign="center"; c.fillStyle="#fff2d4";
  c.font=`900 ${Math.round(height*.42)}px sans-serif`; c.fillText(title,width/2,height*.58,width-55);
  c.font=`600 ${Math.round(height*.11)}px sans-serif`; c.fillText(subtitle,width/2,height*.83,width-50);
  const texture=new T.CanvasTexture(canvas); texture.colorSpace=T.SRGBColorSpace; texture.anisotropy=8;
  return new T.MeshBasicMaterial({map:texture});
}

// City owns this finite palette and the shared shapes. Chunk eviction only
// disposes merged/instanced objects, never these textures or geometries.
export class PlaceDetails {
  materials: T.Material[]=[];
  boards = new Map<Venue,T.Material>();
  menus = new Map<Venue,T.Material>();
  paints = new Map<Venue,T.Material>();
  cream = new T.MeshStandardMaterial({color:0xf5e4c5,roughness:.72});
  metal = new T.MeshStandardMaterial({color:0x28413c,roughness:.55,metalness:.35});
  red = new T.MeshStandardMaterial({color:0xb74132,roughness:.7});
  gold = new T.MeshStandardMaterial({color:0xe7ae51,roughness:.78});
  green = new T.MeshStandardMaterial({color:0x468653,roughness:.9});
  water = new T.MeshStandardMaterial({color:0x68b2b5,roughness:.3,metalness:.25});
  cylinder = new T.CylinderGeometry(1,1,1,20);
  dome = new T.SphereGeometry(1,20,12,0,Math.PI*2,0,Math.PI/2);
  ring = new T.TorusGeometry(1,.12,8,24);
  plane = new T.PlaneGeometry(1,1);
  box = new T.BoxGeometry(1,1,1);
  burgerAd = sign("#a93228","SUNSET BURGER","GOOD TIMES. GREAT BURGERS.",1024,512);
  coffeeAd = sign("#204b43","SLOW MORNINGS","PALM & BEAN  /  FRESHLY ROASTED",1024,512);
  homeAd = sign("#345367","COASTAL LIVING","HOMES FOR RENT  /  555-0187",1024,512);
  harborAd = sign("#bf8b38","HARBOR WORKS","STORAGE  /  SHIPPING  /  LOGISTICS",1024,512);
  parkSign = sign("#285b49","PALM GARDENS","CITY PARKS  /  OPEN DAILY 6 AM - 10 PM");
  parkRules = sign("#345c4b","ENJOY THE PARK","KEEP IT CLEAN  /  DOGS ON LEASH",1024,512);
  constructor() {
    this.materials.push(this.cream,this.metal,this.red,this.gold,this.green,this.water,this.burgerAd,this.coffeeAd,this.homeAd,this.harborAd,this.parkSign,this.parkRules);
    for(const type of VENUE_TYPES) {
      const v=VENUES[type];
      const board=sign(v.color,v.name,v.subtitle,1024,128),paint=new T.MeshStandardMaterial({color:v.color,roughness:.7});
      const c=document.createElement("canvas");c.width=512;c.height=768;
      const ctx=c.getContext("2d")!;
      ctx.fillStyle=v.color;ctx.fillRect(0,0,512,768);ctx.strokeStyle=v.accent;ctx.lineWidth=5;ctx.strokeRect(18,18,476,732);
      ctx.fillStyle=v.accent;ctx.textAlign="center";ctx.font="bold 36px sans-serif";ctx.fillText(v.name,256,84,440);
      ctx.font="bold 25px sans-serif";ctx.fillText("THE NEIGHBORHOOD FAVORITES",256,137,440);
      const items: Record<Venue,string[]>={cafe:["ESPRESSO     2.50","FLAT WHITE     4.00","ICED LATTE     4.50","BUTTER CROISSANT     3.25","FRESHLY BAKED DAILY"],burger:["CLASSIC BURGER     5.95","DOUBLE CHEESE     7.50","GOLDEN FRIES     2.95","VANILLA SHAKE     4.25","GRILLED TO ORDER"],market:["FRESH FRUIT","COLD DRINKS","DAILY ESSENTIALS","OPEN 24 HOURS","WELCOME, NEIGHBOR"],records:["NEW & USED VINYL","SOUL / FUNK / JAZZ","LISTEN BEFORE YOU BUY","LIVE SETS EVERY FRIDAY","KEEP THE MUSIC ALIVE"],pharmacy:["PRESCRIPTIONS","FIRST AID","SUN CARE","HEALTH & BEAUTY","HERE TO HELP"],diner:["PANCAKE STACK     6.50","EGGS & TOAST     5.25","HOUSE COFFEE     2.50","APPLE PIE     4.00","BREAKFAST ALL DAY"]};
      ctx.font="600 26px sans-serif";items[type].forEach((t,i)=>ctx.fillText(t,256,250+i*85,440));
      const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
      const menu=new T.MeshBasicMaterial({map});
      this.boards.set(type,board);this.menus.set(type,menu);this.paints.set(type,paint);this.materials.push(board,menu,paint);
    }
    if(typeof Image!=="undefined") {
      new T.TextureLoader().load(`${import.meta.env.BASE_URL}textures/sunset-burger-20260912.png`, texture=>{
        texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
        this.burgerAd.map?.dispose();this.burgerAd.map=texture;this.burgerAd.needsUpdate=true;
      });
    }
  }
  private shape(root:T.Group, geometry:T.BufferGeometry, material:T.Material, x:number,y:number,z:number,w:number,h:number,d:number, yaw=0) {
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.rotation.y=yaw;
    mesh.castShadow=geometry!==this.plane;mesh.receiveShadow=geometry!==this.plane;mesh.userData.sharedGeometry=true;root.add(mesh);return mesh;
  }
  private face(root:T.Group, material:T.Material,w:number,h:number,x:number,y:number,z:number,yaw=Math.PI) {
    return this.shape(root,this.plane,material,x,y,z,w,h,1,yaw);
  }
  building(root:T.Group,b:Building,add:Box,solid:Solid) {
    const front=b.z-b.d/2,venue=b.venue;
    if(venue) {
      const paint=this.paints.get(venue)!, title=this.boards.get(venue)!, menu=this.menus.get(venue)!;
      const e=b.entrance!, freeSide=e.x>0?-1:1, displayX=b.x+freeSide*(b.w/2-3.2);
      // Deep fascia, repeated ribs and a projecting canopy give each shop a silhouette.
      add(15,b.w+.6,.18,2.8,b.x,3.08,front-1.1);
      this.shape(root,this.box,paint,b.x,3.3,front-.3,b.w,.55,.38);
      this.face(root,title,Math.min(b.w-.5,12),1.3,b.x,3.72,front-.75);
      for(const side of [-1,1]) {
        add(10,.42,3,.5,b.x+side*(b.w/2-.35),1.5,front-.25);
        add(15,.55,.2,.65,b.x+side*(b.w/2-.35),.16,front-.3);
      }
      // Windows are split using the actual door position, not a centred assumption.
      for(const [left,right] of [[-b.w/2+.65,e.x-e.w/2-.18],[e.x+e.w/2+.18,b.w/2-.65]]) {
        if(right-left<.3)continue;
        add(9,right-left,2.05,.14,b.x+(left+right)/2,1.5,front-.11);
        for(let x=left;x<right;x+=1.6)add(10,.07,2.1,.2,b.x+x,1.5,front-.18);
        add(10,right-left,.1,.2,b.x+(left+right)/2,.48,front-.18);
      }
      if(Math.abs(displayX-b.x-e.x)>e.w/2+1.1) {
        this.face(root,menu,1.15,1.75,displayX,1.62,front-.3);
        if(venue!=="cafe" && venue!=="diner") {
        const sx=displayX,sz=front-2.15;
        add(13,1.2,.12,.7,sx,.08,sz);add(13,.09,1.3,.09,sx-.53,.7,sz);add(13,.09,1.3,.09,sx+.53,.7,sz);
        this.face(root,menu,1.05,1.35,sx,.88,sz-.08);solid(sx,.75,sz,1.2,1.5,.75);
        }
      }
      // Upper cornice details differ from the shared residential window kit.
      if(venue==="burger") {
        for(const y of [b.h-.25,b.h+.1])add(16,b.w+.8,.14,b.d+.7,b.x,y,b.z);
        for(let i=0;i<Math.floor(b.w/.55);i++)add(i%2?10:15,.52,.3,.08,b.x-b.w/2+.3+i*.55,.72,front-.26);
        const x=b.x+b.w*.27,y=b.h+1.1,z=b.z-3;
        this.shape(root,this.cylinder,this.gold,x,y,z,1.6,.28,1.6);
        this.shape(root,this.cylinder,this.red,x,y+.26,z,1.58,.23,1.58);
        this.shape(root,this.cylinder,this.green,x,y+.43,z,1.7,.1,1.7);
        this.shape(root,this.dome,this.gold,x,y+.51,z,1.65,.85,1.65);
        for(let i=0;i<9;i++){const a=i*2.4;this.shape(root,this.cylinder,this.cream,x+Math.cos(a)*.9,y+1.2,z+Math.sin(a)*.9,.07,.035,.13);}
      } else if(venue==="cafe" || venue==="diner") {
        for(let dx=-b.w/2+.4;dx<b.w/2;dx+=.75)add(venue==="cafe"?12:16,.4,.08,2.6,b.x+dx,3.22,front-1.1);
        const x=b.x+freeSide*(b.w/2-.95),z=b.z-4,y=b.h+1;
        this.shape(root,this.cylinder,this.cream,x,y,z,.72,1.2,.72);
        this.shape(root,this.cylinder,paint,x,y+.61,z,.61,.03,.61);
        this.shape(root,this.ring,this.cream,x+.78,y,z,.43,.43,.43);
        // Side patio: tables lie inside the shop parcel's front setback.
        for(const dx of [-b.w/2+2.8,b.w/2-2.8]) if(Math.abs(dx-e.x)>e.w/2+2) {
          const tx=b.x+dx,tz=front-2.1;
          this.shape(root,this.cylinder,this.metal,tx,.44,tz,.07,.88,.07);
          this.shape(root,this.cylinder,this.cream,tx,.9,tz,.6,.08,.6);solid(tx,.5,tz,1.2,1,1.2);
          for(const side of [-1,1]) {const cx=tx+side*.95;add(13,.48,.1,.5,cx,.5,tz);add(15,.08,.5,.08,cx,.25,tz);add(13,.08,.5,.5,cx+side*.2,.8,tz);solid(cx,.5,tz,.55,1,.55);}
          this.shape(root,this.cylinder,this.cream,tx+.2,1,tz,.065,.15,.065);
        }
      } else if(venue==="pharmacy") {
        add(12,.45,2.2,.4,b.x,b.h+1.4,b.z-3);add(12,2.2,.45,.4,b.x,b.h+1.4,b.z-3);
      } else if(venue==="records") {
        this.shape(root,this.cylinder,this.metal,b.x,b.h+1.7,b.z-3,1.5,.22,1.5).rotation.x=Math.PI/2;
        this.shape(root,this.cylinder,this.gold,b.x,b.h+1.7,b.z-3.13,.42,.04,.42).rotation.x=Math.PI/2;
      } else {
        for(const side of [-1,1]) {if(Math.abs(side*(b.w/2-1.7)-e.x)<e.w/2+1.5)continue;add(12,2,1,.8,b.x+side*(b.w/2-1.7),.5,front-1.7);for(let i=0;i<4;i++)add(i%2?14:16,.3,.25,.5,b.x+side*(b.w/2-1.7)-.6+i*.4,1.12,front-1.7);}
      }
    }
    // Every building type supports advertising, at a scale appropriate to it.
    if(b.style==="house") {
      this.face(root,this.homeAd,2.8,1.4,b.x-b.w/2-.13,2.4,b.z+3,-Math.PI/2);
    } else {
      const ad=b.style==="warehouse"?this.harborAd:venue==="cafe"?this.coffeeAd:venue==="burger"?this.burgerAd:[this.burgerAd,this.coffeeAd,this.homeAd][b.color%3];
      const w=Math.min(b.w-3,7.5),z=b.z+b.d/2-2,y=b.h+2.4;
      for(const side of [-1,1])add(15,.12,3.8,.12,b.x+side*w*.35,b.h+1.9,z);
      add(15,w+.3,w/2+.3,.2,b.x,y,z);
      solid(b.x,y,z,w+.3,w/2+.3,.2);
      this.face(root,ad,w,w/2,b.x,y,z-.115);
      this.face(root,ad,w,w/2,b.x,y,z+.115,0);
      for(const side of [-1,1]) {add(15,.12,.12,1.1,b.x+side*w*.35,b.h+.6,z-.5);add(14,.4,.12,.28,b.x+side*w*.35,b.h+.7,z-1);}
    }
  }
  park(root:T.Group,p:Parcel,add:Box,solid:Solid) {
    if(p.use!=="garden" || p.w<26)return;
    const front=p.z-p.d/2;
    // Open gateway; columns stay away from the existing cross-shaped walk.
    for(const side of [-1,1]) {const x=p.x+side*2.4;add(13,.22,3.5,.22,x,1.75,front+2.4);solid(x,1.75,front+2.4,.22,3.5,.22);}
    add(12,5.8,.85,.25,p.x,3.45,front+2.4);
    this.face(root,this.parkSign,5.6,.7,p.x,3.45,front+2.25);
    const sx=p.x+p.w/2-4,sz=front+4;
    add(13,.12,2.1,.12,sx,1.05,sz);solid(sx,1.05,sz,.12,2.1,.12);
    this.face(root,this.parkRules,2,1,sx,1.8,sz-.09);
    // Fountain sits in the southeast planted quadrant, leaving both walks open.
    const x=p.x+6,z=p.z+6;
    this.shape(root,this.cylinder,this.cream,x,.24,z,2.1,.48,2.1);solid(x,.24,z,4.2,.48,4.2);
    this.shape(root,this.cylinder,this.water,x,.49,z,1.85,.04,1.85);
    this.shape(root,this.cylinder,this.cream,x,.92,z,.27,.85,.27);
    this.shape(root,this.cylinder,this.cream,x,1.3,z,.8,.12,.8);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;this.shape(root,this.dome,this.red,x+Math.cos(a)*3,.32,z+Math.sin(a)*3,.17,.2,.17);}
  }
}
