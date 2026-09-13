# 开发与验证

架构与模块职责见 [ARCHITECTURE.md](ARCHITECTURE.md)。本页说明当前开发入口与验证边界。

## 本地命令

在仓库根目录执行，使用 Node.js 22.13+ 与 npm：

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

`dev` 使用 Vite 并监听 `0.0.0.0`。`build` 先运行 `tsc --noEmit`，再生成 `dist/`；输出可部署到静态托管。`preview` 用于检查构建产物。没有独立服务端启动步骤。

`tsconfig.json` 开启 strict，只包含 `src`；测试由 `tsx --test tests/*.test.ts` 执行，不包含在构建的 TypeScript 检查范围中。当前 package scripts 没有独立 lint 命令。

## 自动测试入口

| 测试 | 关注内容 |
| --- | --- |
| [targeting.test.ts](../tests/targeting.test.ts) | 枪口遮挡、射程限制、可复现散布及相机位置保护 |
| [presentation.test.ts](../tests/presentation.test.ts) | HUD 模式呈现、商店价格可用状态与渲染无购买副作用 |
| [game.test.ts](../tests/game.test.ts) | 确定性布局、道路空间、金币可达性、扫掠拾取、武器时序、Rapier CCD |
| [world-plan.test.ts](../tests/world-plan.test.ts) | 道路连通、导航、桥面碰撞、地形接缝、地标避让 |
| [population.test.ts](../tests/population.test.ts) | 区域差异、车流、接管、NPC 命中身份、伤害、掉落、流式边界 |
| [inventory.test.ts](../tests/inventory.test.ts) | 购买扣款、独立弹药与换弹、武器节奏、商店坐标 |
| [camera.test.ts](../tests/camera.test.ts) | 后坐力不漂移、仰视、瞄准过渡、第一人称姿态 |
| [game-camera.test.ts](../tests/game-camera.test.ts) | Game 射击与相机更新组合回归 |
| [pointer-lock.test.ts](../tests/pointer-lock.test.ts) | 锁定失败重试、地图暂停和恢复条件 |
| [mobile-controls.test.ts](../tests/mobile-controls.test.ts) | 摇杆死区、向量归一化、触屏设备判定与无 Pointer Lock 启动 |

可通过 `npx tsx --test tests/inventory.test.ts` 运行单个文件。测试包含纯逻辑、真实 Rapier 世界以及部分 DOM/Game 替身；通过测试不等于完整浏览器交互已验收。

## 浏览器检查

开发模式下 `main.ts` 暴露 `window.__game`。可在开发者工具中调用 `window.__game.snapshot()` 查看模式、逻辑/局部坐标、区块数、角色数、弹药和渲染指标。HUD 也会把快照写入游戏 canvas 的 `data-state`。生产构建不暴露这个开发全局入口。

[city-scenario.js](../scripts/city-scenario.js) 提供浏览器场景函数，需在开发页面上下文中加载脚本后使用，并非 `npm test` 的一部分：

- `cityScenario(window.__game)`：车辆交互、司机、射击与地图导航。
- `roadDrivingScenario(window.__game)`：坡道与桥面通行。
- `cityRouteScenario(window.__game)`：分批推进跨区域路线；后续调用第二参数传 `true` 继续，直到返回 `done: true`。

这些函数会改变玩家位置和场景状态，部分检查会清理车流，应在可重置的开发会话运行。旧 [browser-scenario.js](../scripts/browser-scenario.js) 面向原方格路网，不应作为新城市的验收标准。

真实游玩还需在支持 WebGL 2 和 Pointer Lock 的桌面浏览器检查键鼠链路；移动端需用真机检查多指同时操作、横竖屏、安全区、连续射击与载具操控手感。DevTools 设备模拟可检查布局和基本触摸事件，不能代替真机帧率和手感验收。

### 2026-09-13 输入修复

修复禁用的触屏控制器在 HUD 刷新时清空桌面射击输入的问题。手机支持按住开火按钮连发、同时拖动该按钮瞄准；每个按压只接受一个指针，暂停和载具模式切换释放指针归属。竖屏动作按钮收紧间距，并启用 viewport 安全区。

回归测试覆盖 HUD 刷新期间持续开火打空弹匣、自动换弹启动、移动与开火拖动同时进行、额外手指不抢占按钮，以及暂停后旧指针释放不影响新按压。浏览器已验证本地页面初始化和鼠标锁定失败提示；自动化浏览器未获 Pointer Lock，未完成真实键鼠连发或手机真机手感、帧率验收。

## 修改功能时从哪里开始

### 2026-09-13 玩法扩展验证

- 禁用游戏区域选字与 iOS 长按菜单，保留输入框文本编辑；装备列表支持触屏滚动。
- 开火按钮保留按住拖动瞄准；测试通过实际 fire/updateCamera 组合验证持续射击期间 yaw、pitch 可改变。
- 新增 SR-5（12 金币）、LM-60（15 金币），支持 1–6 切枪；SR-5 右键或手机「开镜」按钮进入狙击镜。
- 起点附近道路增加自行车、摩托车、敞篷车，分别配置加速、极速、质量和抓地力；手刹降低侧向抓地，松油门保持滑行惯性。
- 自动测试覆盖新增武器容量/时序、狙击 FOV、载具身份/模型轮数/坐标平移/reset、滑行衰减与漂移，以及长按事件抑制。
- 本轮浏览器验证了 Chrome 本地初始化与菜单场景渲染；尚未完成手机真机、多指手感、坡道驾驶或漂移帧率验收。未提交、推送或部署。

| 修改内容 | 主要入口 | 需要同时检查 |
| --- | --- | --- |
| 地理、道路、建筑布局 | generation | landscape 碰撞、atlas 导航、population 路径 |
| 区块模型和资源 | world / landscape | 卸载、共享资源、负坐标与原点平移 |
| NPC / 车流 | population | 身份映射、接管、回访、刚体数量 |
| 武器参数与购买 | inventory / combat | targeting 命中计算、Game 伤害结果、armory 呈现、equipment-panel |
| 镜头 | camera-rig / Game.updateCamera | 避障、第一人称、连续射击、车辆视角 |
| HUD 与装备列表 | hud / equipment-panel | 数据契约、模式显示、余额与弹药显示 |
| 输入、菜单、地图或装备模式 | Game.bind 与模式方法 / atlas | 清空输入、Pointer Lock 失败与返回恢复 |

提交前运行与改动相关的测试及构建；涉及真实交互再做浏览器检查。记录检查覆盖的边界，避免把构建成功写成游玩验收。新增系统也应同步更新架构文档中的所有权、坐标转换和重置规则。
