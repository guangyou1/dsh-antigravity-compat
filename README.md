# DSH Antigravity 兼容插件

为 DeepSeek Harness（DSH）的指定通道调整默认 persona，保留编码角色与模型信息，避免 Antigravity 中转生成重复身份声明。

插件使用 Cordis 扩展接口，无需修改 DSH 核心包或 Antigravity Tools。没有运行时 npm 依赖，不读取 API key，也不自行发起网络请求。

## 解决什么问题

DSH 默认提示词可能同时包含框架身份和模型身份。在已验证的 DSH 0.2.2-rc.1 / Antigravity Tools 5.0.3 组合中，中转改写后的重复身份声明会让部分带长历史和工具的请求返回 `429 RESOURCE_EXHAUSTED`。

本插件将默认 persona 开头：

```text
You are a coding agent powered by the {{model}} model.
```

转换为：

```text
You are a coding agent.
Current model: {{model}}.
```

这是针对已复现兼容问题的处理，不是通用的 429 修复；配额、网络和模型可用性仍由对应服务负责。

## 生效范围

- 仅对 `providers` 白名单中的 **provider ID** 生效，显示名和模型名不能代替它。
- 只转换 `deployment:persona-prefix` 或 `deployment:persona` 开头的标准模型身份句。
- 保留框架身份、模型信息、工作目录后缀、其他系统段落、历史、工具和生成参数。
- 自定义文案、示例代码、persona 后缀保持原样。完整系统提示词覆盖仍以宿主为准，不在本插件兼容范围内。
- 非白名单 DeepSeek 等通道沿用原始 assembly；插件不设置或更改任何代理。

转换发生在 `system-prompt/assemble` 的下游监听器完成之后、渲染与日志写入之前，实际请求可从日志重建。监听器随插件卸载清理，重复组装不会累积转换。

## 环境要求

Node.js `^22.19.0 || >=24.0.0`，以及提供 `systemPrompt` 服务和 `system-prompt/assemble` 接口的 DSH。实际应用验收版本为 **0.2.2-rc.1**；升级宿主后需重新验收。安装命令使用对应 DSH profile 的 pnpm；本地检查和测试只需要 Node.js/npm。

## 本地安装

先从 GitHub 克隆仓库，并进入插件目录：

```powershell
git clone https://github.com/guangyou1/dsh-antigravity-compat.git
Set-Location dsh-antigravity-compat
```

在本插件目录执行。使用其他 profile 时，将 `desktop` 换成实际名称：

```powershell
$pluginDir = (Get-Location).Path
$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
Push-Location $profileDir
try {
    pnpm add "@local/dsh-antigravity-compat@link:$pluginDir"
} finally {
    Pop-Location
}
```

在该 profile 的 `package.json` 中，将以下插件名追加到现有 `dsh.profile.bundles` 数组，保留已有条目：

```json
"@local/dsh-antigravity-compat"
```

通过 DSH profile 热加载应用改动；不支持热加载的版本重启应用后生效。插件页的 `antigravity-prompt-compat` 组件应显示“运行中”。

### 配置白名单

随附白名单为 `hahagemini`、`antigravity`，来自初始验证环境。安装时按自己的 provider ID 复核；插件不会根据服务地址自动识别通道。

如果你的中转 provider ID 是 `my-antigravity`，在 **当前 profile 的 `cordis.patch.yml`** 合并以下覆盖条目：

```yaml
- id: antigravity-prompt-compat
  config:
    providers:
      - my-antigravity
```

省略配置或提供空白名单会明确报错。更换 provider ID 或地址时，同步复核白名单。

无需修改标准预设或新建会话。全局 persona 配置可能被预设覆盖，本插件处理的是组装后的对应段落。

## 验证

检查和测试不依赖 DSH、网络、模型账号或 API key：

```powershell
npm run check
npm test
npm pack --dry-run --ignore-scripts
```

9 项行为测试及初始应用验收范围见 [验证说明](docs/verification.md)。新环境还应确认：白名单通道记录 `Current model:`、工具调用及结果续接成功、非白名单通道保持原始提示词。显示“运行中”不能替代实际请求验收。

## 停用与卸载

在 DSH 插件页关闭本插件，下一次组装恢复原始提示词。手动管理 profile 时，移除 `dsh.profile.bundles` 中对应条目并重新加载。确认不再使用后，再移除其本地包依赖。无需清空上下文或复制预设。

## 上传 GitHub

本目录可作为独立仓库根目录，包含源码、测试、文档和忽略规则，不包含运行日志、账号配置或宿主安装文件。

`@local` 包名和 `private: true` 用于本地 DSH 安装，不影响创建公开 GitHub 仓库。本项目采用 [MIT 许可证](LICENSE)，没有配置远程测试或自动发布流程。
