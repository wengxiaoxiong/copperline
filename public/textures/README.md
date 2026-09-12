# 城市广告贴图

`sunset-burger-20260912.png`：1774 × 887，PNG，约 2.5 MB。2026-09-12 使用 Codex 内置 image_gen 生成的虚构餐厅广告；不是第三方餐厅商标或下载的商业素材。原始生成文件保留在 Codex generated_images，项目运行仅依赖本目录副本。没有裁切、重绘或修改生成图像。

贴图由 `PlaceDetails` 异步加载并在整座城市共享；加载前显示同名 Canvas 广告，加载后原 Canvas 纹理释放。区块卸载不释放共享图片纹理。素材可在开发与生产构建中通过 Vite BASE_URL 定位。

## 实际生成提示词（内置工具，无 CLI/API fallback）

Create ONE finished landscape 2:1 advertising poster bitmap to use directly as a billboard texture in a stylized coastal American city videogame. Entire image IS the flat printed artwork, perfectly front facing, no frame, no wall, no mockup, no perspective. Premium 1970s California roadside burger restaurant campaign, hand painted editorial illustration with subtle screen print grain and sun faded ink. Warm tomato-red background with cream typography and mustard accents, oversized appetizing illustrated cheeseburger with sesame bun, crisp lettuce, melted cheese and grilled patty dominating the right half. Left half beautiful extremely readable bold condensed cream type with exact headline 'SUNSET BURGER', small line 'CHARGRILLED • SINCE 1978', bottom cream strip exact text 'GOOD TIMES. GREAT BURGERS.' Strong graphic composition with a small starburst reading '$5.95'. Entire composition fits within generous 5% safe margins. Rich detailed food illustration, restrained texture, confident professional art direction, fictional brand only, no real brand logos, no watermark. Aim 2048x1024 landscape.
