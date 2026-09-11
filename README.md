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
| Sprint | Shift |
| Jump / handbrake while driving | Space |
| Enter or exit the nearby car | F; slow down before exiting |
| Fire / shoulder aim | Left / right mouse button |
| Reload | R |
| Pause / release mouse | Esc |
| Return to a nearby road | V |
| Mute / unmute | M |

The orange sedan is ahead of the spawn point. Walk or drive through gold coins to collect them. Red roadside practice targets take three ordinary hits. The MR-17 has a 30-round magazine and unlimited reserve ammunition, with a reload delay.

## What's implemented

- Third-person character movement, camera collision avoidance, shoulder aiming, and vehicle follow camera.
- One arcade-style sedan with rigid-body collisions and continuous collision detection.
- BLACKWATER's procedural MR-17 weapon and synthesized audio, adapted for third-person use. Camera aiming and muzzle obstruction use separate ray origins.
- Deterministic 72-meter neighborhood tiles, seeded by world name and signed tile coordinates.
- A nearby 5 × 5 tile window; distant geometry and physics bodies are unloaded. Local coordinates are rebased during long trips.
- Collected coins and defeated targets stay removed when revisiting a tile in the same run. Refreshing or restarting clears progress.
- Houses, yards, porches, palm trees, utility wires, procedural textures, minimap, ammunition and coin counters.

## Scope and limitations

This is a functional low-poly demo. There is no traffic simulation, pedestrian/enemy AI, police pursuit, multiplayer, interior exploration, story campaign, or shooting from inside the car. Character animation and vehicle handling are simplified. The clock and decorative HUD bars are visual elements, not a day/night cycle or damage system.

Visible world resources are limited to the neighborhood window. Collected-ID history grows with exploration, so unlimited total-session memory is not guaranteed. Google Fonts is requested for interface typography, with local fallback fonts; gameplay does not require a backend.

## Build and validation

```sh
npm test
npm run build
npm run preview
```

`npm run build` runs TypeScript checking and creates `dist/` for static hosting.

The 10 automated tests cover deterministic generation, reachable coin placement, negative tile coordinates, swept pickups, weapon timing and reloads, high-speed collision, pointer-lock failure/retry behavior, and camera stability during sustained shooting. One regression test invokes the actual `Game.fire()` and `Game.updateCamera()` methods and verifies that firing never overwrites the camera position.

A previous browser scenario advanced approximately 3.8 km of driving using fixed physics steps, checking streaming, rebasing, pickups and obstruction. This is a simulation check, **not a real-time FPS benchmark**. The residential visual update has passed the automated tests and build; the full long-distance browser scenario has not been repeated after that update.

`scripts/browser-scenario.js` exports `browserScenario` for a developer-controlled browser page. Its scene positioning is intentional, and it requires the dev-only `window.__game` handle. It is not included in the production API.

## Project layout

```text
src/game.ts                 Input, physics, gameplay and HUD
src/camera-rig.ts           Camera boom, aim transition and recoil
src/world.ts                Tile rendering, streaming and resource lifecycle
src/generation.ts           Deterministic layout and pickup geometry
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
