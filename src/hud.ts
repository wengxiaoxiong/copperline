import type { WeaponSpec } from "./inventory";

/** Presentation data only: no Game, physics bodies or scene queries. */
export type HudState = {
  coins: number; health: number; maxHealth: number;
  weapon: WeaponSpec; weaponState: { ammo: number; reloadTime: number };
  speed: number; flying: boolean; driving: boolean; mode: string;
  hitTime: number; collectedCoins: number; hits: number; travel: number;
  nearShop: boolean; nearHelicopter: boolean; nearVehicle: boolean; nearDriver: boolean; nearEntrance: boolean;
  entry: boolean; chunk: { x: number; z: number }; district: string; fps: number; chunks: number;
};

export function renderHud(state: HudState, doc: Pick<Document, "getElementById"> = document) {
  const $ = (id: string) => doc.getElementById(id)!;
  $("coins").textContent = String(state.coins).padStart(7, "0");
  $("health-bar").style.width = `${(state.health / state.maxHealth) * 100}%`;
  $("ammo-bar").style.width = `${(state.weaponState.ammo / state.weapon.capacity) * 100}%`;
  $("ammo").textContent =
    state.weaponState.reloadTime > 0
      ? "—"
      : String(state.weaponState.ammo).padStart(2, "0");
  $("speed").textContent = String(Math.round(Math.abs(state.speed) * 3.6));
  $("gear").textContent = state.flying ? "AIR" :
    state.speed < -0.5 ? "R" : state.speed > 1 ? "D" : "N";
  $("weapon-status").hidden = state.driving || state.flying;
  $("drive-status").hidden = !state.driving && !state.flying;
  $("equipment-label").textContent = state.flying
    ? "COPPER / LIGHT HELICOPTER"
    : state.driving ? "HARBOR / 2.0 SEDAN"
    : state.weapon.name;
  $("equipment-hint").textContent = state.flying
    ? "空格 上升 · Shift 下降 · F 离机"
    : state.driving ? "空格 手刹 · F 下车"
    : state.weaponState.reloadTime > 0
      ? "正在更换弹匣…"
      : "R 换弹 · 1–4 切枪 · Tab 物品栏";
  $("crosshair").hidden = state.driving || state.flying || state.mode !== "playing";
  $("crosshair").classList.toggle("hit", state.hitTime > 0);
  $("progress").style.width = `${Math.min(100, state.collectedCoins * 5)}%`;
  $("mission-progress").textContent =
    state.collectedCoins < 20
      ? `探索目标 · ${state.collectedCoins} / 20 枚金币`
      : `目标完成 · ${state.hits} 个靶标 · ${(state.travel / 1000).toFixed(1)} km`;
  $("mission-title").textContent = state.flying ? "从空中看看这座城。" : state.driving
    ? "下一枚，在下个街角。"
    : "回到街头。";
  $("mission-copy").textContent = state.flying ? "越过山丘和海湾，寻找新的落脚点。" : state.driving
    ? "沿着金色路线前行，或拐进一条陌生的街。"
    : "找到街边的车，沿着金币探索这座城市。";
  $("controls").innerHTML = state.flying
    ? "<kbd>W S</kbd> 前后飞行 <kbd>A D</kbd> 转向 <kbd>SPACE</kbd> 上升 <kbd>SHIFT</kbd> 下降 <kbd>F</kbd> 离机 <kbd>C</kbd> 视角"
    : state.driving ? "<kbd>W S</kbd> 油门 / 倒车 <kbd>A D</kbd> 转向 <kbd>SPACE</kbd> 手刹 <kbd>F</kbd> 下车 <kbd>C</kbd> 视角 <kbd>M</kbd> 地图"
    : "<kbd>W A S D</kbd> 移动 <kbd>SHIFT</kbd> 跑步 <kbd>F</kbd> 上车 <kbd>鼠标</kbd> 射击 <kbd>Tab</kbd> 物品栏 <kbd>1–4</kbd> 切枪 <kbd>C</kbd> 视角 <kbd>M</kbd> 地图";
  $("interaction").style.display = (state.nearShop || state.nearHelicopter || state.nearVehicle || state.nearEntrance) && !state.entry ? "block" : "none";
  $("interaction").innerHTML = state.nearShop ? "<kbd>E</kbd> 武器商店 · 3 枚金币起" : state.nearHelicopter ? "<kbd>F</kbd> 驾驶直升机" : state.nearDriver ? "<kbd>F</kbd> 抢车 · 等车辆停下" : state.nearVehicle ? "<kbd>F</kbd> 上车" : "入口开放 · 直接走入";
  $("location").textContent = `BLOCK ${state.chunk.x} / ${state.chunk.z}`;
  $("district").textContent = state.district;
  $("perf").textContent =
    `${Math.round(state.fps)} FPS · ${state.chunks} BLOCKS`;
}
