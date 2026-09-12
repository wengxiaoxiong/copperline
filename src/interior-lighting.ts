import * as T from "three";

export type InteriorLight = { marker: T.Object3D; color: number };

// WebGL forward lighting evaluates every scene light for every lit material.
// Keep the shader light count stable even when chunks load or no room is nearby.
export class InteriorLighting {
  private lights: T.PointLight[];
  private position = new T.Vector3();

  constructor(scene: T.Scene) {
    this.lights = Array.from({ length: 4 }, () => {
      const light = new T.PointLight(0xffffff, 0, 12, 1.4);
      scene.add(light);
      return light;
    });
  }

  update(camera: T.Vector3, sources: Iterable<InteriorLight>) {
    const nearest: { position: T.Vector3; color: number; distance: number }[] = [];
    for (const source of sources) {
      source.marker.getWorldPosition(this.position);
      const distance = this.position.distanceTo(camera);
      if (distance >= 24) continue;
      nearest.push({ position: this.position.clone(), color: source.color, distance });
      nearest.sort((a, b) => a.distance - b.distance);
      if (nearest.length > this.lights.length) nearest.pop();
    }
    this.lights.forEach((light, i) => {
      const source = nearest[i];
      light.intensity = source ? 0.7 * Math.min(1, (24 - source.distance) / 6) : 0;
      if (source) {
        light.position.copy(source.position);
        light.color.setHex(source.color);
      }
    });
  }
}
