import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BLOCK, chunkAt, type WorldPlan } from "./generation";
import { STREET_NAMES, ROAD_NOTICES, roadSignIndex } from "./road-signs";
import type { Parcel } from "./parcels";

const ADS = [
  ["#124c51", "海风咖啡", "SEA BREEZE COFFEE", "慢一点，喝一杯。"],
  ["#b9432f", "今晚有现场", "COPPER LIVE / 20:00", "音乐不停 · 海岸不眠"],
  ["#244a86", "骑去看海", "RIDE THE COAST", "下一站，自由。"],
  ["#e5b742", "幸运便利店", "LUCKY MARKET / 24H", "冰饮 · 零食 · 好心情"],
];

// A small fixed texture palette belongs to City, and survives chunk eviction.
export function streetMaterials() {
  const ads = ADS.map(([background, title, subtitle, footer]) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = "#fff1cf"; ctx.lineWidth = 6; ctx.strokeRect(24, 24, 976, 464);
    ctx.fillStyle = "#fff1cf"; ctx.textAlign = "center";
    ctx.font = "bold 100px sans-serif"; ctx.fillText(title, 512, 214);
    ctx.font = "bold 38px sans-serif"; ctx.fillText(subtitle, 512, 306);
    ctx.font = "32px sans-serif"; ctx.fillText(footer, 512, 421);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
    return new T.MeshBasicMaterial({ map });
  });
  const streetSigns = STREET_NAMES.map(name => {
    const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=160;
    const c=canvas.getContext("2d")!;c.fillStyle="#245c48";c.fillRect(0,0,1024,160);
    c.strokeStyle="#eef2e7";c.lineWidth=6;c.strokeRect(10,10,1004,140);
    c.fillStyle="#fff7df";c.textAlign="center";c.font="bold 65px sans-serif";c.fillText(name,512,106,940);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    return new T.MeshBasicMaterial({map});
  });
  const notices=ROAD_NOTICES.map(([title,detail],i)=>{
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=640;
    const c=canvas.getContext("2d")!;c.fillStyle=i===2?"#efca55":"#eee9dc";c.fillRect(0,0,512,640);
    c.strokeStyle=i===1?"#b13b31":"#273733";c.lineWidth=15;c.strokeRect(15,15,482,610);
    c.fillStyle=c.strokeStyle;c.textAlign="center";c.font="bold 57px sans-serif";c.fillText(title,256,165,460);
    c.font=`900 ${i===0?260:66}px sans-serif`;c.fillText(detail,256,i===0?470:360,450);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;return new T.MeshBasicMaterial({map});
  });
  return [...ads, ...[0xff4235, 0x684826, 0x184e3a].map(color => new T.MeshBasicMaterial({ color })), ...streetSigns, ...notices];
}

type Solid = (x: number, y: number, z: number, w: number, h: number, d: number) => void;

// All output uses chunk-local coordinates, with one merged mesh per material.
export function buildStreetProps(root: T.Group, plan: WorldPlan, cx: number, cz: number,
  parcels: Parcel[], metal: T.Material, paint: T.Material, paper: T.Material[], solid: Solid) {
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const pose = new T.Object3D();
  const part = (g: T.BufferGeometry, material: T.Material, x: number, y: number, z: number,
    transform: T.Matrix4, rotation = new T.Quaternion()) => {
    pose.position.set(x, y, z); pose.quaternion.copy(rotation); pose.updateMatrix();
    g.applyMatrix4(pose.matrix).applyMatrix4(transform);
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material)!.push(flat);
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material, t: T.Matrix4) =>
    part(new T.BoxGeometry(w, h, d), m, x, y, z, t);
  const bar = (a: number[], b: number[], radius: number, m: T.Material, t: T.Matrix4) => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), dir = end.clone().sub(start);
    const mid = start.add(end).multiplyScalar(0.5);
    part(new T.CylinderGeometry(radius, radius, dir.length(), 6), m, mid.x, mid.y, mid.z, t,
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()));
  };
  const at = (x: number, y: number, z: number, yaw: number) => new T.Matrix4().compose(
    new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), yaw), new T.Vector3(1, 1, 1));
  // Collision boxes are conservative world-aligned bounds of each prop.
  const obstacle = (t: T.Matrix4, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const bounds = new T.Box3(new T.Vector3(x-w/2,y-h/2,z-d/2), new T.Vector3(x+w/2,y+h/2,z+d/2)).applyMatrix4(t);
    const c = bounds.getCenter(new T.Vector3()), s = bounds.getSize(new T.Vector3());
    solid(c.x, c.y, c.z, s.x, s.y, s.z);
  };
  for (const p of parcels) {
    if (p.building?.venue) continue; // Venue-specific frontage already has menus and furnishings.
    if (p.infill) continue; // Interior courts own their furnishings and perimeter walk.
    if (p.use !== "shops" && p.use !== "parking" && p.use !== "apartments") continue;
    const t = at(p.x, p.y, p.z, p.yaw), front = -p.d / 2;
    const x = -p.w / 2 + 4.2, z = front + 1.2;
    // Keep a wide approach corridor aligned with the actual offset doorway.
    if (p.building?.entrance && Math.abs(p.building.entrance.x - x) < 2.3 + p.building.entrance.w / 2 + .7) continue;
    // Raised two-sided advertising leaves the middle of the frontage open.
    for (const dx of [-1.5, 1.5]) box(.12, 4.5, .12, x+dx, 2.25, z, metal, t);
    box(4.2, 2.2, .18, x, 3.55, z, metal, t);
    const ad = paper[Math.abs(Math.floor(p.along)) % ADS.length];
    for (const side of [-1, 1]) part(new T.PlaneGeometry(4, 2), ad, x, 3.55, z + side * .101, t,
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), side === -1 ? Math.PI : 0));
    for (const dx of [-1.5, 1.5]) obstacle(t, x+dx, 2.25, z, .16, 4.5, .16);
    obstacle(t, x, 3.55, z, 4.2, 2.2, .2);
    // Two parked diamond-frame bicycles, parallel to the curb beneath the board.
    for (let n = 0; n < 2; n++) {
      const bt = t.clone().multiply(at(x, .05, z + n * .65, 0));
      for (const wx of [-.64, .64]) {
        part(new T.TorusGeometry(.34, .045, 6, 16), metal, wx, .37, 0, bt);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 4;
          bar([wx-Math.cos(a)*.31,.37-Math.sin(a)*.31,0], [wx+Math.cos(a)*.31,.37+Math.sin(a)*.31,0], .009, metal, bt);
        }
      }
      const rear = [-.64,.37,0], crank = [-.08,.35,0], seat = [-.25,.91,0], head = [.43,.91,0], wheel = [.64,.37,0];
      for (const [a,b] of [[rear,crank],[rear,seat],[crank,seat],[seat,head],[crank,head],[head,wheel]]) bar(a,b,.035,paint,bt);
      bar(seat,[-.25,1.04,0],.025,metal,bt); box(.29,.07,.19,-.28,1.06,0,metal,bt);
      bar(head,[.45,1.12,0],.025,metal,bt); bar([.45,1.12,-.23],[.45,1.12,.23],.025,metal,bt);
      bar(crank,[-.08,.35,.2],.025,metal,bt); box(.16,.05,.12,-.08,.35,.23,metal,bt);
      obstacle(bt,0,.58,0,2,1.16,.5);
    }
    bar([x-1.2,.1,z+.4],[x-1.2,.85,z+.4],.045,metal,t);
    bar([x+1.2,.1,z+.4],[x+1.2,.85,z+.4],.045,metal,t);
    bar([x-1.2,.85,z+.4],[x+1.2,.85,z+.4],.045,metal,t);
  }
  for (const node of plan.nodes) {
    const roads = plan.adjacency.get(node.id) ?? [];
    if (roads.length < 3 || roads.some(r => r.bridge)) continue;
    for (const road of roads) {
      const fromStart = road.a === node.id;
      const sample = plan.sampleRoad(road, fromStart ? 15 : road.length - 15, (fromStart ? 1 : -1) * (road.width / 2 + 1));
      const owner = chunkAt(sample.x, sample.z);
      if (owner.x !== cx || owner.z !== cz) continue;
      const t = at(sample.x-cx*BLOCK, sample.y, sample.z-cz*BLOCK, sample.yaw + (fromStart ? Math.PI : 0));
      box(.16, 4.4, .16, 0, 2.2, 0, metal, t);
      box(.64, 1.6, .42, 0, 3.9, 0, metal, t);
      for (let i = 0; i < 3; i++) {
        part(new T.CircleGeometry(.18, 12), paper[4+i], 0, 4.4-i*.5, .221, t);
        box(.5,.06,.28,0,4.64-i*.5,.25,metal,t);
      }
      obstacle(t,0,2.2,0,.2,4.4,.2);
      // Reuse the traffic-light pole: English street names and a legible notice.
      box(.12,1.3,.12,0,4.9,0,metal,t);
      const cross=roads.find(candidate=>candidate.id!==road.id && roadSignIndex(candidate)!==roadSignIndex(road)) ?? road;
      for(const [index,street] of [road,cross].entries()) {
        const st=t.clone().multiply(at(0,5+index*.48,0,index*Math.PI/2));
        box(3.7,.5,.07,0,0,0,metal,st);
        for(const side of [-1,1]) part(new T.PlaneGeometry(3.6,.46),paper[7+roadSignIndex(street)],0,0,side*.041,st,
          new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),side===-1?Math.PI:0));
      }
      box(.74,.95,.08,0,2.2,.06,metal,t);
      part(new T.PlaneGeometry(.7,.88),paper[7+STREET_NAMES.length+road.id%ROAD_NOTICES.length],0,2.2,.111,t);

    }
  }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries)!;
    geometries.forEach(g => g.dispose());
    const mesh = new T.Mesh(merged, material); mesh.name = "street-props";
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
}
