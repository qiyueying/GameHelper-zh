# 本地化约定（zh-CN / zh-Hant）

本文件说明 GameHelper 插件 UI 文本的汉化规则。术语以 [poe2db.tw](https://poe2db.tw/tw/Items) 为准：
繁体用 `https://poe2db.tw/tw/`，简体用 `https://poe2db.tw/cn/`。对照表见 `docs/localization/glossary.json`。

## 资源文件位置
- 主程序：`GameHelper/Localization/<code>.json`
- 插件：`Plugins/<Plugin>/Localization/<code>.json`
- `en-US.json` 是基线：所有 key 必须先存在于 en-US，缺失 key 会回退英文（运行时不会报错，所以漏翻是静默的）。
- 复制到输出目录由 `Plugins/Directory.Build.targets` 的 `CopyPluginLocalizationFiles` 目标统一完成，新建 `Localization` 目录无需改 .csproj。

## 调用形态（三种，按插件现状选用）
1. PCore 派生类自带 `this.PluginText`：`GameHelper/Plugin/PCore.cs:33`
   `protected PluginLocalization PluginText => this.pluginText ??= new PluginLocalization(this.DllDirectory);`
   ```csharp
   ImGui.Checkbox(this.PluginText.Label("settings.enable_overlay", "Enable overlay", "AmanamuEnableOverlay"), ref this.Settings.EnableOverlay);
   ```
2. 局部属性（不派生 PCore 的类）：`Plugins/SekhemaHelper/SekhemaHelperCore.cs:26-27`
   ```csharp
   private PluginLocalization loc;
   private PluginLocalization Loc => this.loc ??= new PluginLocalization(this.DllDirectory);
   ```
3. 把实例当参数传进绘制方法：`Plugins/HealthBars/Config.cs:137` `public void Draw(PluginLocalization text)`

四种取值方法：`T(key, fallback)`、`F(key, fallback, args...)`（带 `{0}` 之类占位符）、`Label(key, fallback, id)`（跳过 ImGui ID 去重时用）、`Title(key, fallback, id)`。

## key 命名
沿用每个插件 en-US.json 里已有的前缀（`settings.` / `button.` / `tooltip.` / `debug.` / `atlas.` / `lt.` / `stashutility.` …），新 key 用语义路径而不是英文原文，例如 `settings.bar_scale`。

## 不要翻译的东西
- ImGui 控件 ID：`"##suffix"`、`BeginTable("config_table")`、`PushID` 参数、`DragFloat` 的第一个参数（它同时是 ID）。
- 占位符与格式串：`{0}`、`{0:F2}`、`%s`、`\n`、颜色标记。
- 热键/按键名、文件路径、URL、插件类名、日志与异常消息（只翻界面可见文本）。
- 空串与纯符号。

## 翻译风格
- 简体用简体字形与大陆惯用词；繁体用台服字形与用词，二者不互相覆盖。
- 术语一律走 glossary.json；glossary 里没有的游戏名，先查 poe2db 对应页面再译，并在 GLOSSARY.md「未核验」记一笔。
- 保留原文标点风格（英文括号配中文时用中文括号），不新增句末句号。
