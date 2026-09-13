import "./style.css";
import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./game";
document.body.classList.add("menu-open");
const start = document.getElementById("start") as HTMLButtonElement;
start.disabled = true;
async function boot() {
  try {
    await RAPIER.init();
    const game = new Game(document.getElementById("game") as HTMLCanvasElement);
    if (import.meta.env.DEV)
      (window as unknown as { __game: Game }).__game = game;
    document.getElementById("loading")!.textContent = game.mobile.enabled
      ? "已就绪 · 触屏操作"
      : "已就绪 · 键鼠操作";
    start.disabled = false;
    (document.getElementById("start-coast") as HTMLButtonElement).disabled = false;
  } catch (e) {
    console.error(e);
    const fatal = document.getElementById("fatal")!;
    fatal.hidden = false;
    fatal.textContent =
      "城市暂时无法启动。请使用支持 WebGL 2 的现代浏览器并刷新页面。\n" +
      String(e);
  }
}
void boot();
