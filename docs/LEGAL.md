# Legal considerations / 法律风险说明

Reviewed: 2026-09-11. This is a practical project assessment, not a legal opinion or a clearance of third-party rights. Applicable rules vary by jurisdiction. The official references below explain U.S. principles, not a worldwide safe harbor.

核对日期：2026-09-11。这是项目风险说明，不是律师法律意见，也不代表完成第三方权利清查。不同司法辖区规则不同；下方美国官方资料不能视为全球免责依据。

## 1. Ideas versus expression / 玩法与具体表达

Broad ideas such as third-person movement, driving, shooting and collecting coins are different from copyrighted expression. The U.S. Copyright Office distinguishes ideas, systems and methods from their particular expression. That does **not** mean an entire game presentation is unprotected: code, artwork, distinctive characters, specific maps, music, dialogue and combinations of expressive elements can present separate issues. Patents and other legal rights are not assessed here.

第三人称、驾驶、射击、拾取等笼统玩法，与受版权保护的具体表达不同。美国版权局区分了想法、系统、方法及其具体表达，但这**不代表整套游戏表现不受保护**：代码、美术、可识别角色、特定地图、音乐、对白及表达元素组合仍可能产生风险。本说明没有进行专利或其他权利检索。

## 2. Naming and presentation / 名称与产品呈现

The name `react-gta` directly evokes GTA. Retaining a separate game name, **Copperline**, and clearly stating that the project is independent reduces ambiguity, but is not a guarantee against a trademark complaint. The USPTO explains that similar wording, appearance or commercial impression can create confusion when related goods or services are involved; its page concerns U.S. trademark registration and is not a determination of infringement here.

`react-gta` 会直接使人联想到 GTA。游戏继续使用独立名称 **Copperline**，并明确非官方关系，有助于降低误解，但不能保证不会收到商标投诉。USPTO 说明，在商品或服务相关时，文字、外观或整体商业印象相似可能造成混淆；该资料讨论美国商标注册，不是对本项目是否侵权的裁定。

For a public-facing or commercial product, prefer a distinctive repository/product name, avoid official logos and claims of affiliation, and obtain a trademark clearance appropriate to the intended markets. “Fan project,” “noncommercial,” “open source,” and a disclaimer are not automatic defenses.

对外推广或商业化时，建议使用独立的仓库与产品名称，避免官方标识或暗示关联的宣传，并根据目标市场进行商标清查。「同人」「非商业」「开源」或免责声明均不自动构成免责理由。

## 3. What this repository contains / 当前素材边界

- Procedurally generated neighborhood, vehicle and character; no imported GTA asset files.
- BLACKWATER weapon/audio code under its retained MIT license.
- Screenshots taken from this running project. The user-supplied original-game reference image is not included in the repository.
- A visual reference to an era and genre. Being generated in code does not itself prove that a result is sufficiently distinct from protected expression. Avoid recreating an identifiable original character, exact neighborhood layout, official logos or UI artwork.

- 由代码生成的街区、车辆与角色，没有导入 GTA 素材文件。
- BLACKWATER 枪械和音效代码，保留原始 MIT 许可。
- 来自本项目实际运行画面的截图；用户提供的原版游戏参考图未收入仓库。
- 对某一年代和类型的视觉参考。由代码生成不等于自动获得不侵权结论；应避免复现可识别的原版角色、精确地图布局、官方标识和 UI 美术。

## 4. Licenses and distribution / 许可与分发

Retain BLACKWATER's copyright and MIT text in copies or substantial portions. Respect the licenses of Three.js, Rapier and other dependencies, including any required notices in distributed builds. An upstream MIT notice is not an independent verification of every upstream contributor's rights. No project-wide license has been chosen for the original code; choose one intentionally before describing this repository as open source.

复制或分发 BLACKWATER 代码及其重要部分时，应保留版权声明与 MIT 文本。分发构建产物时也应遵守 Three.js、Rapier 及其他依赖的许可证和通知要求。上游 MIT 声明不等于我们独立核实了其全部权利来源。原创代码尚未选择统一许可证，在称本项目为「开源项目」前应明确作出许可选择。

## Official references / 官方参考

- [U.S. Copyright Office — What Does Copyright Protect?](https://www.copyright.gov/help/faq/faq-protect.html)
- [USPTO — Likelihood of confusion](https://www.uspto.gov/trademarks/search/likelihood-confusion)
- [BLACKWATER license](../src/vendor/blackwater/LICENSE)
