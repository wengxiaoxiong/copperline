import * as T from "three";
import type { WorldPlan } from "./generation";

export const SUN_DIRECTION = new T.Vector3(-55, 19, 55).normalize();

// Camera-relative background: one draw, no textures, lights or shadow casters.
export class CoastalAtmosphere {
  readonly sky = new T.Mesh(new T.SphereGeometry(100, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { sunDirection: { value: SUN_DIRECTION } },
    vertexShader: `varying vec3 direction;
      void main() {
        direction = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `uniform vec3 sunDirection; varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        float h = max(d.y, 0.0);
        vec3 sky = mix(vec3(.72,.39,.20), vec3(.19,.37,.46), smoothstep(0.0,.65,h));
        float facing = max(dot(d, sunDirection), 0.0);
        sky += vec3(.65,.26,.06) * pow(facing, 14.0);
        sky += vec3(2.8,1.9,.85) * smoothstep(.9993,.9997,facing);
        sky = mix(vec3(.32,.43,.42), sky, smoothstep(-.08,.015,d.y));
        // Distant offshore silhouettes belong to the sky, not traversable terrain.
        float a = atan(d.x, d.z);
        float island = exp(-pow((a + .55)*3.2,2.0));
        float ridge = island * (.045 + .017*sin(a*23.0) + .009*sin(a*49.0));
        float mountain = (1.0-smoothstep(ridge-.002,ridge+.002,d.y))
          * smoothstep(-.002,.008,d.y) * smoothstep(.05,.2,island);
        sky = mix(sky,vec3(.33,.40,.39),mountain*.7);
        gl_FragColor = vec4(sky,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  constructor(scene: T.Scene) {
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    scene.add(this.sky);
  }
  update(camera: T.Camera, time: number, offset: T.Vector3) {
    this.sky.position.copy(camera.position);
    coastalWater.uniforms.time.value = time;
    coastalWater.uniforms.origin.value.copy(offset);
  }
  dispose() {
    this.sky.removeFromParent();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
  }
}

// Shared across streamed chunks; no render targets or real-time reflections.
export const coastalWater = new T.ShaderMaterial({
  fog: true,
  uniforms: {
    ...T.UniformsUtils.clone(T.UniformsLib.fog),
    time: { value: 0 }, origin: { value: new T.Vector3() },
    sunDirection: { value: SUN_DIRECTION },
  },
  vertexShader: `varying vec3 worldPosition;
    #include <fog_pars_vertex>
    void main() {
      worldPosition = (modelMatrix * vec4(position,1.0)).xyz;
      vec4 mvPosition = viewMatrix * vec4(worldPosition,1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform float time; uniform vec3 origin; uniform vec3 sunDirection;
    varying vec3 worldPosition;
    #include <fog_pars_fragment>
    void main() {
      vec2 p = (worldPosition + origin).xz;
      vec3 view = normalize(cameraPosition - worldPosition);
      float ripple = sin(p.x*.48 + p.y*.31 + time*.8);
      float detail = 1.0-smoothstep(25.0,150.0,length(cameraPosition-worldPosition));
      vec3 normal = normalize(vec3(ripple*.035*detail,1.0,
        sin(p.y*.7 + sin(p.x*.21)*2.0-time)*.055*detail));
      float fresnel = pow(1.0-max(dot(view,normal),0.0),3.0);
      float glitter = pow(max(dot(reflect(-sunDirection,normal),view),0.0),90.0);
      vec3 color = mix(vec3(.035,.18,.19),vec3(.32,.43,.40),fresnel);
      color += vec3(1.0,.53,.19)*glitter*.9;
      gl_FragColor = vec4(color,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

export function coastalArrival(plan: WorldPlan) {
  const road = plan.roads.filter(r => !r.bridge && r.points.every(p =>
    Math.abs(p.z - plan.coastAt(p.x)) < 65))
    .sort((a,b) => Math.abs(a.points[4].x + 400) - Math.abs(b.points[4].x + 400))[0];
  if (!road) throw new Error("Coastal road unavailable");
  const p = plan.sampleRoad(road, road.length * .5);
  const next = plan.sampleRoad(road, road.length * .5 + 4);
  return { ...p, yaw: Math.atan2(p.x - next.x, p.z - next.z) };
}
