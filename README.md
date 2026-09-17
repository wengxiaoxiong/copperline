# Copperline

**One more drive before sunset.**

A single-player browser sandbox set in a low-poly coastal city. Walk through the neighborhood, borrow a set of wheels, fly over the harbor, or follow the coast until the city gives way to the sea. Warm evening light, weathered storefronts and palm-lined streets give it the feel of an early-2000s console game.

[Play in your browser](https://copperline-rosy.vercel.app/) · [简体中文](README.zh-CN.md) · [Development guide](docs/DEVELOPMENT.md) · [Architecture](docs/ARCHITECTURE.md)

![Copperline: a player and an orange sedan beside the sea at sunset](docs/screenshots/coast.png)

*Rendered in Ego Lite from the local development build. The coastal scene is held still with the pause overlay hidden for the screenshot; this is the actual WebGL scene, not concept art.*

## A city to wander through

- **Choose your ride.** Drive a sedan or convertible, ride a motorcycle or bicycle, or take the helicopter above the rooftops. Take over moving traffic and return to the same vehicle after stepping out. Decorative bicycles in street racks are separate, static props.
- **Explore beyond the main street.** A seeded world connects residential blocks, shops, old town, downtown, harbor, riverside, hills and coast with roads and bridges. Walk into houses, shops and apartment lobbies through their open doors.
- **Find your own route.** Use the minimap or open the city atlas to pan, zoom and set a destination on the road network. Start in the neighborhood or jump straight to the sunset coast from the title screen.
- **Collect and equip.** Pick up coins on foot or while driving, then visit the weapon shop. Six weapons span rifle, pistol, SMG, shotgun, sniper rifle and light machine gun, with separate magazines and reload progress.
- **Stir up the street.** Pedestrians react to conflict, including gunfire, attacks and vehicle theft. Hostile NPCs can shoot back; defeated NPCs drop coins. Switch between first- and third-person views, shoulder aim or use the sniper scope.
- **Play with a keyboard or touch.** Desktop uses mouse aiming; mobile has a movement joystick, camera gestures, held fire, a scope toggle and contextual vehicle/shop actions.

![Copperline title screen with the neighborhood, traffic and helicopter](docs/screenshots/menu.png)

*Title screen captured in Ego Lite with the default seed, `PALM-GROVE-2026`. The game interface is currently in Chinese.*

## Run locally

Use **Node.js 22.13+**, npm and a modern browser with **WebGL 2**. Chrome or Edge is recommended for desktop play. No backend, account or API keys are required.

```sh
git clone https://github.com/wengxiaoxiong/copperline.git
cd copperline
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`.

1. Keep the default world seed or enter your own before starting.
2. Choose **进入街区** (enter the neighborhood) or **海滨漫游** (coastal roam).
3. On desktop, allow the browser to lock the mouse. If it fails, use the retry button or open the page directly in Chrome or Edge. Press **Esc** to release the cursor and pause.

On a phone, use landscape orientation. For local testing, connect to the same network as the development machine and open Vite's Network URL. Touch controls do not require mouse lock.

## Controls

| Action | Desktop |
| --- | --- |
| Walk / drive / steer the helicopter | **W A S D** |
| Sprint on foot | **Shift** |
| Jump / vehicle handbrake / helicopter climb | **Space** |
| Helicopter descent | **Shift** |
| Enter, exit or take over a nearby vehicle | **F**; slow down before entering and stop before exiting |
| Fire / aim or sniper scope | **Left / right mouse button** |
| Reload | **R** |
| Equip an owned weapon | **1–6** |
| Inventory | **Tab** or **I** |
| Weapon shop, when nearby | **E** |
| First-/third-person view | **C** |
| City atlas | **M**; drag to pan, scroll to zoom, click a road to navigate |
| Recover to a nearby road | **V** |
| Mute / unmute | **N** |
| Pause / release cursor | **Esc** |

On touch devices, move with the **left joystick** and drag the open **right side** to look around. Hold **开火** to aim and fire; **开镜** toggles the sniper scope when equipped. Nearby vehicles and the weapon shop show a contextual action. Smaller buttons change with the current mode: jump/reload, handbrake, or helicopter climb/descent.

Opening the map, inventory or pause screen stops gameplay. Returning on desktop requires mouse lock again.

## Under the hood

**TypeScript · Three.js · Rapier WASM · Vite · HTML/CSS**

The city, characters and vehicles are largely built from procedural geometry. A shared `WorldPlan` supplies terrain, roads, traffic and maps. The renderer streams a nearby **7 × 7** window of **72-meter** chunks, while origin shifts keep rendering and physics coordinates close to the player. Physics advances at a fixed 60 Hz; seeded generation is reproducible, but the entire game simulation is not deterministic.

The npm package still has the historical name `react-gta`; the application does **not** use React.

| Area | Source |
| --- | --- |
| Startup and session orchestration | [`main.ts`](src/main.ts), [`game.ts`](src/game.ts) |
| World planning and land use | [`generation.ts`](src/generation.ts), [`parcels.ts`](src/parcels.ts) |
| Terrain, buildings and streaming | [`world.ts`](src/world.ts), [`landscape.ts`](src/landscape.ts), [`interiors.ts`](src/interiors.ts) |
| NPCs, vehicle ownership and driving | [`population.ts`](src/population.ts), [`vehicle-dynamics.ts`](src/vehicle-dynamics.ts) |
| Weapons, inventory and hit detection | [`inventory.ts`](src/inventory.ts), [`combat.ts`](src/combat.ts), [`targeting.ts`](src/targeting.ts) |
| Camera, maps, touch and UI | [`camera-rig.ts`](src/camera-rig.ts), [`atlas.ts`](src/atlas.ts), [`mobile-controls.ts`](src/mobile-controls.ts), [`hud.ts`](src/hud.ts), [`equipment-panel.ts`](src/equipment-panel.ts) |

See the [architecture guide](docs/ARCHITECTURE.md) for module ownership, coordinates and resource lifecycles, and [AGENTS.md](AGENTS.md) for contribution conventions.

## Build and check

```sh
npm test          # Node test runner + tsx
npm run build    # Strict TypeScript check, then Vite build
npm run preview  # Serve the production build locally
```

The build produces `dist/` for static hosting. Regression tests cover world generation, roads and collisions, building entry, vehicle physics and takeover, combat, inventory, camera behavior and input state transitions. Vite currently warns about the large JavaScript bundle, which includes Rapier WASM.

Browser scenario scripts and the dev-only `window.__game` handle are documented in the [development guide](docs/DEVELOPMENT.md). Those scripts can reset or reposition the session. Automated tests and staged screenshots are not a substitute for a full keyboard/mouse playthrough, mobile device testing or sustained frame-rate measurements.

## Prototype boundaries

- **Single player, session only.** No multiplayer or cross-refresh saves. Some changes survive chunk unloading within a run; refreshing or restarting resets progress. Respawning preserves collected money and owned weapons.
- **A bounded city.** The road network spans roughly two kilometers. Terrain can continue beyond it; the roads do not extend forever. Offshore island silhouettes are scenery, not destinations.
- **Simplified simulation.** Handling and animation are experimental. No police pursuit, story campaign, swimming or in-vehicle shooting. Deep water recovers the player to a road. Warehouses remain closed; markets, courts and traffic lights are scenery rather than complete gameplay systems.
- **Performance depends on the device.** Streaming limits nearby geometry, but claimed vehicles and changed NPC records can accumulate during a session. The on-screen clock is decorative, not a day/night cycle.

## Credits and licensing

Weapon geometry, effects and audio include adaptations from [BLACKWATER — Silent Harbor](https://github.com/Hiraeth010/blackwater), under its retained [MIT license](src/vendor/blackwater/LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and adaptation details. Three.js is MIT-licensed; Rapier is Apache-2.0-licensed. Other dependencies retain their own terms.

Copperline is an independent prototype, unaffiliated with Rockstar Games or Take-Two Interactive. No extracted GTA assets or original-game screenshots are bundled. **No project-wide license has been selected for the original code**; public visibility does not itself grant reuse rights. See the [legal and attribution notes](docs/LEGAL.md).
