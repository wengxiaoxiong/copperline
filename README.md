# react-gta · Copperline

[简体中文](README.zh-CN.md) · [Legal & attribution notes](docs/LEGAL.md)

A small third-person browser sandbox with driving, shooting, collectible coins, and a seeded neighborhood that streams around the player. **Copperline** is the game's name; `react-gta` is the repository name.

The visual direction draws on early-2000s console games: warm evening light, weathered low-resolution textures, detached houses, palm trees, and a compact HUD. This is an independent prototype, not an official GTA product or a reproduction of an original game's assets or map.

> **Stack note:** despite the repository name, the current implementation uses **Three.js + TypeScript + Vite + Rapier**, with HTML/CSS for the interface. React is not currently a dependency.

![Copperline running in a browser](docs/screenshots/menu.png)

*Actual browser screenshot of this project's title screen and rendered neighborhood. It is not a screenshot from GTA or a generated promotional image.*

## Play locally

Requires Node.js **22.13+**, npm, and a desktop browser with WebGL 2.

```sh
git clone https://github.com/wengxiaoxiong/react-gta.git
cd react-gta
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://localhost:5173/`. Click **进入街区** to start. The current game interface is in Chinese.

The game starts only after the browser grants **Pointer Lock**, which hides the mouse cursor and enables relative aiming. If an embedded browser rejects the request, open the same address in Chrome or Edge and click again. Esc pauses and releases the mouse. Browser or operating-system restrictions cannot be overridden by this page.

## Controls

| Action | Control |
| --- | --- |
| Move / accelerate, reverse, steer | WASD |
| Sprint (about 2.5× walking speed) | Shift |
| Jump / handbrake while driving | Space |
| Enter, exit or take over a nearby car | F; wait for low speed before entering, stop before exiting |
| Fire / shoulder aim | Left / right mouse button |
| Reload | R |
| Pause / release mouse | Esc |
| Return to a nearby road | V |
| World map | M; wheel to zoom, drag to pan, click a road to navigate |
| First-/third-person view | C |
| Mute / unmute | N |

The orange sedan is ahead of the spawn point. Walk or drive through gold coins to collect them. Defeated pedestrians also spill coins, so drive over or walk through the drop before it streams out. Red roadside practice targets take three ordinary hits. The MR-17 has a 30-round magazine and unlimited reserve ammunition, with a reload delay.

The street is hostile: pedestrians within about 34 metres charge the player and land melee hits, draining the health bar above the ammo bar. At zero health the player is returned to a nearby road with health restored. Traffic and the player's own car will run pedestrians down, which kills them and drops their loot.

## What's implemented

- Third-person movement, camera obstruction, shoulder aiming and vehicle follow camera. Sprinting is roughly 2.5× walking speed.
- Nearby vehicles share one ownership and driving model. Taking over traffic opens a door and makes its driver flee, preserving the vehicle body, paint and parked position.
- Pedestrians react to gunshots, take damage and fall when defeated, dropping collectible coins. Nearby pedestrians turn hostile, chase the player and attack in melee; a moving vehicle knocks them down on contact. Camera and muzzle rays resolve the closest obstruction, including traffic and pedestrians.
- A seeded coast, river and hills determine connected roads, bridges, roadside building placement and eight districts. Landmarks include a water tower, lighthouse, harbor crane and plaza.
- 72-meter streaming tiles with a nearby 7 × 7 window. Curved roads cross tile boundaries; terrain and bridge colliders match road elevation.
- A shared world atlas and minimap, with zoom, pan, player and driven-vehicle markers, and road-based navigation. Opening the atlas pauses gameplay; returning requests pointer lock again.
- Changed NPCs, driven vehicles, collected coins and defeated targets persist during a run, including across streaming and origin shifts. Restarting or refreshing resets progress.

## Scope and limitations

The current seed generates one coastal city roughly 1.5 km wide. Terrain continues outside the city, but its road network is bounded. Police pursuit, multiplayer, interiors, story missions, swimming and in-car shooting are not implemented. Entering deep water recovers the player to a nearby road.

Traffic follows the road graph, brakes and waits at intersections. Character animation and vehicle handling remain simplified. The clock and decorative bars are visual elements. M now opens the map; mute moved to N.

Nearby geometry is streamed out; driven vehicles and changed NPC records accumulate during the run. Unlimited session memory is not guaranteed. Gameplay needs no backend; external fonts have local fallbacks.

## Build and validation

```sh
npm test
npm run build
npm run preview
```

`npm run build` runs TypeScript checking and creates `dist/` for static hosting.

18 automated tests cover deterministic generation, road connectivity and routing, road clearance, landmark placement, bridge colliders, reachable coins, signed coordinates, swept pickups, weapon timing, NPC hits and persistence, vehicle identity and streaming, map pause and pointer-lock failure/retry, and camera stability during firing.

`scripts/city-scenario.js` runs actual Game methods and Rapier physics through the dev-only `window.__game` handle. `cityScenario(game)` checks entry, driving, exit, takeover, driver flight, shooting and navigation. `roadDrivingScenario(game)` traverses a 155 m slope and 139 m bridge. `cityRouteScenario(game)` advances a route in batches; pass `true` on subsequent calls until `done: true`. A roughly 1.55 km residential-to-harbor-to-coast route passed with 49 nearby chunks. Ordinary traffic is cleared for this road-clearance scenario.

These developer scripts reposition the scene. They are **not real-time FPS or complete keyboard/mouse acceptance tests**. The embedded browser rejected pointer lock; its failure/retry handling is covered, and Chrome or Edge is recommended for play. The older `scripts/browser-scenario.js` retains checks for the previous grid world and does not apply to this road network.

## Project layout

```text
src/game.ts                 Input, physics, gameplay and HUD
src/camera-rig.ts           Camera boom, aim transition and recoil
src/world.ts                Tile rendering, streaming and resource lifecycle
src/generation.ts           Geography, road graph, lots and navigation
src/landscape.ts            Terrain, bridges, landmarks and colliders
src/population.ts           NPC state and vehicle ownership
src/atlas.ts                World map, minimap and navigation UI
src/models.ts               Procedural character and vehicle
src/retro.ts                Surface textures and palm geometry
src/combat.ts               Weapon state and timing
src/vendor/blackwater/      Attributed upstream weapon and audio code
tests/                      Automated regression tests
docs/screenshots/           Screenshots of this project
```

## Attribution, licensing and legal status

- [BLACKWATER — Silent Harbor](https://github.com/Hiraeth010/blackwater): weapon geometry, effects and audio under MIT. Its copyright and license are retained in [`src/vendor/blackwater/LICENSE`](src/vendor/blackwater/LICENSE). Adaptations are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Three.js is MIT-licensed; Rapier is Apache-2.0-licensed. Dependencies retain their own terms.
- The city, vehicle and character are generated by this project's code. No extracted GTA models, textures, music, dialogue, maps or original-game screenshots are bundled.
- This project is not affiliated with, endorsed by, or sponsored by Rockstar Games or Take-Two Interactive. Their names and game titles are used only to describe the reference context; third-party trademarks remain with their respective owners.
- **No project-wide open-source license has been selected for the project's original code.** Repository visibility does not grant a license. The retained third-party licenses continue to apply to their respective components.

The repository name and similarity to a recognizable game can still create legal risk. A disclaimer or noncommercial release does not eliminate it. See the [bilingual legal notes](docs/LEGAL.md), and obtain jurisdiction-specific advice before a commercial release.
