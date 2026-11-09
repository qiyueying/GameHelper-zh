# 汉化版的维护手册 / Maintaining the Chinese build

这份文档写给"汉化版这个仓库的维护者"（也就是你）。它回答三个问题：

1. 上游 GameHelper 发新版本时，我要做什么？
2. 新版本多出来的英文句子，怎么翻译？
3. GitHub 上那套自动构建是怎么回事、怎么改？

---

## 0. 先搞清楚我们现在有几种东西

| 产物 | 里面有什么 | 给谁用 | 汉化程度 |
| --- | --- | --- | --- |
| `GameHelper-zh-v<版本>.zip` | 整个程序 + 全部中文 | 直接解压玩 | 100%（连插件代码里的字符串也翻了） |
| `GameHelper-zh-langpack-v<版本>.zip` | 只有翻译文件（几十个 .json） | 已经装了官方原版的人 | 约 95%，插件代码里的少数字符串仍是英文 |
| 这个 git 仓库 | 上游源码 + 我们的翻译 | 我们自己 | —— |

两种包的原理不同，这点很重要：

- **语言包**只是把 `Localization\zh-CN.json` 这类文件覆盖进安装目录。程序运行时按语言去磁盘读这些 json，读到就用，读不到（或者缺某个 key）就自动退回英文，**不会报错、不会崩溃**。
- **完整版**多做了两件事：把 17 个插件 `.cs` 里写死的英文改成"查表 + 英文兜底"的写法；把版本号盖成和上游一致。

理解这一点，后面所有操作都顺了。

---

## 1. 上游发版了，一条命令搞定

```powershell
cd <这个仓库>
powershell -ExecutionPolicy Bypass -File tools\zh-sync\build-zh.ps1 -Sync
```

它会依次做这些事，每一步都会打印出来：

1. `git fetch` 上游，找到 `upstream/main` 上最新的 tag（例如 `v1.5.12`）；
2. 把这个 tag `merge` 进当前分支（我们的提交都在上游历史之上，所以这是普通的 git 合并）；
3. 把 `GameHelper/GameHelper.csproj` 里的版本号改成 `1.5.12`；
4. 跑 `node tools/zh-sync/check.mjs` 自检（缺 key、占位符不匹配、空翻译都会报出来）；
5. 调 `scripts/build.ps1` 完整构建到 `publish\`；
6. 检查产物里确实有 `Localization\zh-CN.json` 和 22 个插件的 zh-CN.json；
7. 生成 `dist/GameHelper-zh-v1.5.12.zip` 和 `dist/GameHelper-zh-langpack-v1.5.12.zip`。

只想构建、不合并上游：去掉 `-Sync`。只想合并、不重新构建：先 `-Sync -NoZip`（构建还是会发生，`-NoZip` 只是不打包）。

### 合并冲突了怎么办

脚本会停下并告诉你冲突的文件。绝大多数冲突长这样：

```
<<<<<<< HEAD
  "settings.new_row": "新增行",
=======
  "settings.new_row": "Add new row",
>>>>>>> v1.5.12
```

处理原则：

- 上游**新加的 key**：保留上游那一行，然后把它翻成中文（见第 2 节）。
- 上游**改过英文原文**的 key：保留我们的中文，检查意思有没有变。
- 上游**删掉**的 key：跟着删掉。

改完：

```powershell
git add -A
git commit -m "merge upstream v1.5.12"
powershell -ExecutionPolicy Bypass -File tools\zh-sync\build-zh.ps1 -SkipCheck
```

（先 `-SkipCheck` 把版本跑通，翻译齐了再去掉这个开关。）

---

## 2. 新版本多出来的英文句子，怎么翻

```powershell
node tools\zh-sync\check.mjs
```

输出里 `FAIL` 的行就是必须处理的：

```
[FAIL] Plugins/Autopot/Localization  (182 keys)
        error   zh-CN: 3 key(s) missing vs en-US (e.g. settings.new_a, settings.new_b, debug.x)
```

意思是上游的 `en-US.json` 多了几个 key，我们的 `zh-CN.json` 里没有。先占位：

```powershell
node tools\zh-sync\check.mjs --fill
```

它会把缺的 key 按英文原文补进去（并保持字母顺序、2 空格缩进）。这时候程序已经能跑了（显示英文），但还没翻。接着：

- 打开 `Plugins/Autopot/Localization/zh-CN.json`，搜那几个 key，把英文换成中文；
- 繁体 `zh-Hant.json` 同步改（`--fill` 会一起补桩）；
- 再跑一次 `node tools\zh-sync\check.mjs`，直到 `RESULT: OK`。

翻译时请遵守 `docs/localization/CONVENTIONS.md`，术语查 `docs/localization/GLOSSARY.md`。
最常踩的三条：

- `{0}` `{1}` `{2}` 这种占位符**必须原样保留**，数量对不上 check 会报错；
- `##stable_id` / `###stable_id` 后面的 ID 不能翻（那是 ImGui 的控件 ID，翻了设置会记不住）；
- 路径、URL、热键、日志、游戏内专有名词按 GLOSSARY 处理，不要自由发挥。

---

## 3. check.mjs 报的东西怎么看

| 级别 | 含义 | 要不要处理 |
| --- | --- | --- |
| `error` | 缺 key / json 语法坏 / 重复 key / 占位符对不上 / 空翻译 / 值不是字符串 | 必须处理，否则构建脚本会停 |
| `warning: untranslated` | 中文和英文一模一样 | 看一眼：专有名词（`HP`、`poe2scout`）可以忽略，整句英文要翻 |
| `warning: zh-Hant identical to zh-CN` | 繁体和简体完全相同 | 一般是"本来就一样的词"，偶尔是漏转繁体 |
| `warning: leading/trailing whitespace` | 译文首尾带空格 | 多数是原文排版（例如 `"  x"`），不影响运行 |

现在这份代码的状态是 **0 error / 50 多条 warning**，全部是上面这几类良性项。

---

## 4. GitHub 上的自动构建

仓库里有 `.github/workflows/zh-build.yml`，跑在 `windows-latest` 上。

### 一次性配置（只做一次）

1. 在 GitHub 上建一个空仓库，例如 `GameHelper-zh`（**不要** fork 上游，也不要把它设成 private，否则 Actions 分钟数要钱）。
2. 本地加远端并推上去：

   ```powershell
   git remote add origin https://github.com/<你的账号>/GameHelper-zh.git
   git push -u origin zh
   ```

   注意推的是 `zh` 分支（真正的工作分支），不是那个旧的 `legacy-tarball`。
3. 打开仓库 → **Settings → Actions → General → Workflow permissions**，选 **Read and write permissions**，保存。
   （发布 Release 需要写权限；不选这个，构建成功但发版会 403。）
4. 打开 **Actions** 标签页，启用 workflow。

### 三种触发方式

| 触发 | 什么时候用 | 行为 |
| --- | --- | --- |
| `schedule`（每天 03:17 UTC） | 平时不用管 | 发现上游有新 tag → 合并 → 构建 → 发 Release；已经发过同一版本就跳过 |
| `workflow_dispatch`（手动） | 想立刻出包 | 可以填上游 tag（例如 `v1.5.12`），留空就用最新的 |
| push tag `v*-zh` | 本地已经构建好、只想让 GitHub 也挂一份 | 用 tag 里的版本号构建并发版 |

手动触发：仓库 → Actions → 左侧 "zh-build" → Run workflow。

### 发出来的东西

Release 标签是 `v<上游版本>-zh`（例如 `v1.5.12-zh`），标题 "GameHelper 1.5.12 汉化版"，
两个资产就是我们前面说的完整版和语言包。注意它 **不会** 抢上游仓库的 "Latest" 标记。

### 合并冲突时 CI 会怎样

定时任务里的 `git merge` 一旦冲突，workflow 会在 Summary 里列出冲突文件并失败，
**什么都不发布**（宁可不出包，也不出一个半英文的包）。这时候本地跑一次
`build-zh.ps1 -Sync` 解决冲突、推上去，再手动触发一次即可。

### 想改成别的节奏

改 `zh-build.yml` 里这一行：

```yaml
  schedule:
    - cron: "17 3 * * *"   # 分 时 日 月 周，UTC 时间
```

`*/6 * * * *` 是每 6 小时；`0 3 * * 1` 是每周一。GitHub 的定时任务在高峰期可能延后几分钟到几十分钟，这是正常的。

---

## 5. 官方启动器会覆盖汉化

上游的 `Launcher` 会自动更新并校验签名（`Launcher/UpdateService.cs` 里 manifest 验签失败就跳过更新），
它替换的是官方文件，所以：

- **完整汉化版**：更新后变回英文版。重新下载本仓库 Release 里的新版本即可。
- **语言包**：更新后中文消失。重新把语言包里的两个文件夹复制进去即可。
- 如果你的启动器提示 "Update check: manifest unavailable"，说明它已经在跳过更新了，汉化不会被覆盖。

想彻底避免这件事，就用完整版并在启动器里关闭自动更新。

---

## 6. 常见问题

**构建报 `dotnet` 找不到 / SDK 版本不对**
项目是 `net10.0-windows`，需要 .NET SDK 10。`dotnet --version` 看一眼，不是 10.x 就装一个。

**`check.mjs` 报一堆 error 但我只想先出包**
`build-zh.ps1 -SkipCheck`。运行时会用英文兜底，不会崩。但别长期这样，缺的 key 会越来越多。

**语言包装进去没反应**
三个常见原因：① 装到了错的目录（必须是 `GameHelper.exe` 所在目录，不是 `Plugins`）；② 设置里没选简体/繁体中文；③ 没有重启程序。

**插件面板一部分是中文一部分是英文**
这是语言包的固有限制：`.cs` 里写死的那些字符串没进 json。
想要全中文请用完整汉化版；或者把那句英文的 key 补进 json（见第 2 节）。

**繁体里出现简体字**
`check.mjs` 会提示 "zh-Hant identical to zh-CN"，照着改。

**我想加一个新插件的汉化**
在 `Plugins/<插件名>/Localization/` 下建 `zh-CN.json` 和 `zh-Hant.json`（照着 `en-US.json` 的 key 抄），
不需要改 `.csproj` —— `Plugins/Directory.Build.targets` 会自动把它们复制到输出目录。

---

## 7. 文件和命令速查

| 路径 | 作用 |
| --- | --- |
| `tools/zh-sync/build-zh.ps1` | 一键：同步上游 → 自检 → 构建 → 打包 |
| `tools/zh-sync/check.mjs` | 翻译自检（可 `--fill` 补桩、`--json` 机读、`--strict` 把警告当错误） |
| `tools/zh-sync/export-langpack.mjs` | 从源码树导出语言包目录（不含 zip） |
| `.github/workflows/zh-build.yml` | GitHub Actions 自动构建/发版 |
| `docs/localization/CONVENTIONS.md` | 翻译约定（哪些不翻） |
| `docs/localization/GLOSSARY.md` | 术语表 |
| `docs/localization/REPORT.md` | 当初的覆盖率报告 |

分支说明：

- `zh`：工作分支，所有翻译和上游合并都在这上面；
- `legacy-tarball`：最早那个"下载 zip 当基线"的旧历史，只作留档，不要在上面改东西。
