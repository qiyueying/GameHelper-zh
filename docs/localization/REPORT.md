# 简体 / 繁体汉化改动说明（zh-CN / zh-Hant）

本分支在 GameHelper（Path of Exile 2 覆盖层工具）原有本地化框架上补齐中文，并统一术语。

## 做法

- 沿用仓库自带的 `GameHelper/Localization/`（主程序 `OverlayLocalization`）与各插件 `Plugins/<插件>/Localization/<语言>.json`（`PluginLocalization`）机制，不引入新框架。
- `en-US.json` 是基线；`zh-CN` / `zh-Hant` 与它 key 集合严格一致，缺 key 时运行时自动回退英文。
- 代码侧把硬编码英文字面量改为 `T/F/Label/Title` 调用，保留英文 fallback；带 ID 的控件（`Checkbox`、`Slider`、`Button` 等）一律用 `Label(key, fallback, stableId)`，避免 ImGui ID 随语言变化。
- 术语以 poe2db.tw 为准：繁体对 https://poe2db.tw/tw/Items ，简体对 https://poe2db.tw/cn/Items ；已核验词条见 `docs/localization/glossary.json` 与 `GLOSSARY.md`。

## 覆盖情况（key 数：en-US / zh-CN / zh-Hant）

| 插件 | key | 说明 |
| --- | --- | --- |
| GameHelper（主程序） | 140 | 补 `settings.tools.offset_helper`，译完 4 条残留英文值 |
| RunecraftHelper | 182 | 原缺 31，另新增 76 承接 72 处字面量 |
| StashUtility | 171 | 原无中文（123），另修 `tablet.category.*` 永不命中的 key |
| Radar | 109 | 修正 图标→图示/图示、祭祀→驱灵祭坛/邪靈祭祀 |
| Atlas | 105 | 修正星图→异界、仪式→驱灵祭坛等 |
| AutoHotKeyTrigger | 97 | 代码无需改动（残留均为 ImGui ID） |
| LootTracker | 85 | 补 12 key，价格面板统一「神圣石 / 崇高石」 |
| Atlas2 | 81 | 原无本地化，新建 |
| Autopot | 70 | 新建 |
| AuraTracker | 69 | 已完整，未改值 |
| SimpleBars | 69 | 新建；页签名不再显示内部字典 key |
| SekhemaHelper | 65 | 补 21 key |
| RuneforgeHelper | 66 | 旧目录（见下），同批处理 |
| PlayerBuffBar | 65 | 补 1 key |
| LootValue | 59 | 补 20 key |
| HealthBars | 45 | 已完整 |
| RitualHelper | 45 | 按术语表统一 |
| AmanamuVoidAlert | 43 | 已完整 |
| PreloadAlert | 40 | 已完整 |
| Hiveblood | 34 | 新建；简「虫巢之血」/繁「巢血」 |
| StashValueByZx0 | 33 | 新建 |
| PickupHelper | 26 | 已完整 |
| RitualWispAlert | 10 | 新建中文 |
| WorldDrawing | — | 无 UI 文本，不加空文件 |

合计 23 个本地化目录、en-US 基线 1709 个 key，三语 key 集合完全一致。

## 刻意不译

- ImGui ID、拖拽 payload 类型、热键字符串、日志、配置路径/键名。
- `Plugins/Atlas2` 的地图分组名（`Search`/`Ritual`/`Quests`）：会被序列化进 `config/settings.txt` 且被 `MatchesCategory` 字面量匹配，翻译会破坏用户已存配置。
- 数据层游戏内容名（`GameHelper/Data/MonsterCategories.tsv`、`Plugins/StashUtility/Data/jewel_mod_ranges.json`、Radar 图标名）：属词条数据而非界面文案，本轮不改。

## 验证

- `dotnet build GameOverlay.sln -c Release`：0 错误（283 警告全部为上游既有，如 ImageSharp 3.1.12 漏洞告警）。
- 简繁互斥字表扫描：zh-Hant 无简体字、zh-CN 无繁体字。
- 占位符（`{0:F2}` 等）三语个数一致；代码引用的 key 均能在 en-US 中找到（唯一例外 `plugin.description` 是各插件自定义的动态 key）。

## 已知说明

- `Plugins/RuneforgeHelper` 是改名前遗留目录：不在 `GameOverlay.sln` 中，`scripts/publish.ps1` 的 `$RemoveFolders` 会在升级时删除它。本轮一并汉化以保持树内一致（单独编译 0 错误），但它不随包发布；真正发布的是 `Plugins/RunecraftHelper`。
