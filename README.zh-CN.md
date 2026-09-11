# react-gta · Copperline

[English](README.md) · [法律与署名说明](docs/LEGAL.md)

一个基于浏览器的第三人称小型沙盒：可以开车、开枪、捡金币，街区根据种子在玩家周围持续生成。**Copperline（铜线街区）**是游戏名称，`react-gta` 是仓库名称。

画面参考早期主机游戏的氛围：暖色夕阳、低清旧纹理、独栋住宅、棕榈树和紧凑 HUD。这是独立原型，不是 GTA 官方产品，也没有使用原版游戏的地图或提取素材。

> **技术栈说明：**虽然仓库名包含 `react`，当前实际使用的是 **Three.js + TypeScript + Vite + Rapier**，界面采用 HTML/CSS，尚未引入 React。

![浏览器中运行的 Copperline](docs/screenshots/menu.png)

*本项目首页与实时街区的真实浏览器截图。不是 GTA 原版截图，也不是生成的宣传图。*

## 本地运行

需要 Node.js **22.13+**、npm，以及支持 WebGL 2 的桌面浏览器。

```sh
git clone https://github.com/wengxiaoxiong/react-gta.git
cd react-gta
npm ci
npm run dev
```

打开 Vite 输出的地址，通常是 `http://localhost:5173/`，点击「进入街区」。当前游戏界面为中文。

游戏只有在浏览器授予 **Pointer Lock（鼠标锁定）**之后才开始，此时鼠标隐藏，并使用相对位移控制瞄准。如果内置浏览器拒绝请求，请在 Chrome 或 Edge 中打开同一地址后再次点击。Esc 暂停并释放鼠标。网页不能绕过浏览器或操作系统对鼠标锁定的限制。

## 操作

| 操作 | 按键 |
| --- | --- |
| 移动／油门、倒车、转向 | WASD |
| 跑步 | Shift |
| 跳跃／驾驶时手刹 | 空格 |
| 上下附近的车 | F；下车前需先减速 |
| 射击／肩后瞄准 | 鼠标左键／右键 |
| 换弹 | R |
| 暂停、释放鼠标 | Esc |
| 返回附近道路 | V |
| 静音／恢复声音 | M |

出生点前方有一辆橙色轿车。步行或驾驶经过金币都能拾取；红色路边靶标普通命中三次后倒下。MR-17 弹匣容量为 30 发，备用弹药无限，但保留换弹时间。

## 已实现

- 第三人称人物移动、镜头避障、肩后瞄准、驾驶跟随镜头。
- 一辆街机手感轿车，带刚体碰撞和高速连续碰撞检测。
- 改自 BLACKWATER 的程序化 MR-17 枪械、特效与合成音效；瞄准射线和枪口遮挡检查分离。
- 72 米标准街区，布局由世界种子和包含负数的街区坐标共同决定。
- 保留附近 5 × 5 个街区，卸载远方几何体与碰撞体；长距离移动时重定位本地坐标。
- 本次游戏已拾取的金币和已击倒靶标不会在回访街区时重生；刷新或重新开始会重置。
- 住宅、院子、门廊、棕榈树、电线、程序化纹理、小地图、弹药与金币计数。

## 当前边界

这是低多边形功能 demo，暂不包含车流、行人／敌人 AI、警察追捕、多人、建筑内部、剧情任务和车内射击。人物动作与车辆模型经过简化。时钟和装饰状态条是视觉元素，不代表昼夜或伤害系统。

可见世界资源控制在邻近街区内，但收集记录会随探索增长，不保证无限时长运行时总内存恒定。界面通过 Google Fonts 请求字体，失败时回退到本地字体；游戏无需后端服务。

## 构建与验证

```sh
npm test
npm run build
npm run preview
```

构建包含 TypeScript 检查，输出的 `dist/` 可用于静态托管。

10 项自动测试覆盖种子一致性、金币可达位置、负坐标、扫掠拾取、射速与换弹、高速碰撞、鼠标锁定失败与重试，以及连续射击时的镜头稳定性。其中一项直接调用实际的 `Game.fire()` 和 `Game.updateCamera()`，确保开枪不会覆盖相机位置。

此前浏览器场景通过固定物理步推进约 3.8 公里驾驶，验证了街区加载卸载、坐标重定位、拾取和遮挡。这属于模拟验证，**不等于实时帧率验收**。住宅视觉更新已通过自动测试和构建，更新后尚未重新执行完整长距离浏览器场景。

`scripts/browser-scenario.js` 导出 `browserScenario`，供开发者控制的浏览器页面调用。脚本会主动设置场景位置，依赖仅在开发模式存在的 `window.__game`，不是生产接口。

## 目录

```text
src/game.ts                 输入、物理、玩法和 HUD
src/camera-rig.ts           镜头支臂、瞄准过渡和后坐力
src/world.ts                街区呈现、动态加载和资源回收
src/generation.ts           确定性布局和拾取计算
src/models.ts               程序化人物和车辆
src/retro.ts                地表纹理和棕榈树
src/combat.ts               武器状态
src/vendor/blackwater/      保留署名的上游枪械和音效
tests/                      自动回归测试
docs/screenshots/           本项目截图
```

## 署名、许可与法律说明

- [BLACKWATER — Silent Harbor](https://github.com/Hiraeth010/blackwater) 的枪械、特效和音效采用 MIT 许可，原始版权声明与许可证保留在 [`src/vendor/blackwater/LICENSE`](src/vendor/blackwater/LICENSE)，改动见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
- Three.js 采用 MIT，Rapier 采用 Apache-2.0；依赖各自保留其许可证。
- 城市、车辆与人物由本项目代码生成，没有打包从 GTA 提取的模型、纹理、音乐、对白、地图或原版游戏截图。
- 本项目与 Rockstar Games、Take-Two Interactive 无关联、授权或赞助关系。相关名称仅用于描述参考背景，第三方商标归各自权利人所有。
- **本项目原创代码尚未选择统一的开源许可证。**仓库公开与否不等于授予使用许可；第三方代码仍按各自许可证处理。

仓库命名和可识别的游戏相似性仍可能带来法律风险；免责声明或非商业发布不自动免责。详见[中英文法律说明](docs/LEGAL.md)。商业发布前应结合目标市场取得专业意见。
