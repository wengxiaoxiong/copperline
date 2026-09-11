import * as T from "three";
export function surfaceTexture(
  kind: "road" | "grass" | "wall" | "roof",
  seed = 71,
) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  let n = seed;
  const rand = () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
  ctx.fillStyle =
    kind === "road"
      ? "#a2957e"
      : kind === "grass"
        ? "#85904a"
        : kind === "roof"
          ? "#88806b"
          : "#d5c5a1";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 13000; i++) {
    const v = Math.floor(rand() * 140);
    ctx.fillStyle = `rgba(${v + 50},${v + 42},${v + 26},${kind === "wall" ? 0.1 : 0.27})`;
    ctx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 2, 1 + rand() * 2);
  }
  if (kind === "wall") {
    for (let y = 0; y < 128; y += 12) {
      ctx.fillStyle = "rgba(55,40,23,.1)";
      ctx.fillRect(0, y, 128, 1);
    }
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = "rgba(72,48,22,.06)";
      ctx.fillRect(
        rand() * 128,
        rand() * 128,
        2 + rand() * 12,
        10 + rand() * 25,
      );
    }
  }
  if (kind === "roof") {
    for (let y = 0; y < 128; y += 10) {
      ctx.fillStyle = "#4a423450";
      ctx.fillRect(0, y, 128, 2);
      for (let x = (y / 10) % 2 ? 7 : 0; x < 128; x += 14)
        ctx.fillRect(x, y, 1, 10);
    }
  }
  if (kind === "road") {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = "rgba(45,36,23,.22)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      let x = rand() * 128,
        y = rand() * 128;
      ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) {
        x += rand() * 12 - 6;
        y += rand() * 12;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.LinearFilter;
  t.anisotropy = 2;
  t.repeat.set(
    kind === "road" ? 16 : kind === "grass" ? 5 : kind === "roof" ? 2 : 1,
    kind === "road" ? 16 : kind === "grass" ? 5 : kind === "roof" ? 2 : 1,
  );
  return t;
}
export function palmAssets() {
  const points: number[] = [];
  const tri = (a: T.Vector3, b: T.Vector3, c: T.Vector3) =>
    points.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (let f = 0; f < 11; f++) {
    const angle = (f * Math.PI * 2) / 11,
      dir = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      side = new T.Vector3(-dir.z, 0, dir.x);
    const center = (t: number) =>
      dir
        .clone()
        .multiplyScalar(t * 5.2)
        .add(new T.Vector3(0, Math.sin(t * Math.PI) * 1.3 - t * t * 1.5, 0));
    for (let j = 0; j < 14; j++) {
      const t = j / 14,
        a = center(t),
        b = center((j + 1) / 14);
      const width = Math.sin((0.12 + t * 0.88) * Math.PI) * 0.75;
      for (const sign of [-1, 1]) {
        const tip = center(Math.min(1, t + 0.14)).addScaledVector(
          side,
          width * sign,
        );
        tip.y -= 0.25;
        tri(a, b, tip);
      }
    }
  }
  const leaves = new T.BufferGeometry();
  leaves.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  leaves.computeVertexNormals();
  const bark = new T.CylinderGeometry(0.18, 0.36, 1, 7, 5);
  const p = bark.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin((y + 0.5) * 2) * 0.08);
  }
  bark.computeVertexNormals();
  return { leaves, bark };
}
