#  Claw in Chrome

<div align="center">

![Claw in Chrome](https://img.shields.io/badge/Claw-in%20Chrome-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-1.0.66-green?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Chrome%20116%2B-lightgrey?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

</div>

简体中文 | [English](./README_EN.md)

## 使用说明

> 面向普通用户的安装与使用指南。当前可直接上传和分发的完整目录就是当前这个 `claw in chrome` 文件夹，`manifest.json` 版本为 `1.0.66`，建议在 Chrome `116+` 中使用。

## 1. 插件简介

Claw in Chrome 是一个运行在 Chrome 侧边栏里的浏览器助手扩展。你可以把它理解为一个“挂在浏览器里的 AI 助手”，它支持：

- 在侧边栏中直接聊天
- 连接自定义模型供应商
- 选择 `OpenAI Chat Completions` 或 `OpenAI Responses API`
- 调整 `思考深度`
- 导出侧边栏日志，方便排查问题

这份说明默认按中文阅读来设计。如果你要给英文用户看，可以直接打开英文版说明：[README_EN.md](./README_EN.md)。

## 2. 安装方式

### 2.1 安装前准备

开始前请先确认这几件事：

- 你使用的是 Chrome `116+`，或兼容 Chrome 扩展的 Chromium 浏览器
- 你要加载和上传的目录就是当前这个 `claw in chrome`
- 你已经准备好可用的模型接口信息，例如 `Base URL`、`API Key`、默认模型名

### 2.2 加载已解压扩展

1. 在 Chrome 地址栏打开 `chrome://extensions/`
2. 打开右上角的“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前这个 `claw in chrome` 文件夹
5. 确认扩展列表里出现 `Claw`

### 2.3 固定插件并打开入口

扩展加载成功后，建议先把它固定到工具栏，后面打开会更方便。

1. 点击浏览器右上角的扩展拼图图标
2. 找到 `Claw`
3. 点击图钉，把它固定到工具栏
4. 以后可以直接点击图标打开
5. 也可以尝试快捷键 `Ctrl+E`

## 3. 首次打开与基础设置

### 3.1 打开设置页

首次使用前，建议先进入设置页把 Provider 配好。

你可以用下面任意一种方式进入：

1. 在 `chrome://extensions/` 中找到 `Claw`
2. 点击“详情”
3. 打开“扩展程序选项”

或者：

1. 右键浏览器工具栏里的 `Claw`
2. 打开选项页

进入后，你会看到扩展设置页。根据当前代码，左侧会新增几个关键入口：

- `模型供应商`
- `提示词修改`
- `日志捕获`

![设置页入口](./docs/screenshots/01.png)

上图建议展示设置页左侧导航，以及 `模型供应商`、`提示词修改`、`日志捕获` 这几个入口。

### 3.2 先记住这几个规则

正式配置前，先记住 3 个很重要的点：

1. 改完配置后，要点击 `保存并应用`
2. 保存成功后，最好把侧边栏关闭再重新打开一次
3. 如果调用失败，优先检查 `供应商格式` 是否选对

## 4. 自定义 Provider 配置

这一节是最关键的。配置完成后，侧边栏请求会走你自己填写的模型供应商。

### 4.1 新增一套 Provider 配置

1. 打开设置页左侧的 `模型供应商`
2. 点击 `新增配置`
3. 打开 `启用自定义供应商`
4. 按下面说明填写字段

### 4.2 字段怎么填

- `供应商名称`
  - 随便填一个你自己能看懂的名字
  - 例如：`OpenAI Official`、`OpenRouter`、`My Gateway`
- `供应商格式`
  - 如果你的接口兼容 `/chat/completions`，选 `OpenAI Chat Completions`
  - 如果你的接口兼容 `/responses`，选 `OpenAI Responses API`
  - 选错格式时，请求地址会不对，常见结果是报错、空响应或健康检测失败
- `Base URL`
  - 填接口根地址即可
  - 例如：`https://api.openai.com/v1`
  - 扩展会根据 `供应商格式` 自动补上 `/chat/completions` 或 `/responses`
- `API Key`
  - 填你的接口密钥
- `模型`
  - 可以直接手填，例如 `gpt-5.4`
  - 也可以先点击 `获取模型列表` 再选择
- `思考深度`
  - 只会对支持 reasoning effort 的模型生效
  - 不确定时先用 `中`
  - 如果供应商不支持，建议设为 `关闭`
- `上下文窗口 (单位:k)`
  - 这里按 `k` 填写
  - 例如填 `200`，通常表示约 `200k`
  - 当前代码默认值是 `200`
- `健康检测`
  - 建议保存前先点一次
  - 如果看到 `Reply with OK only.` 对应的成功反馈，说明链路基本通了

### 4.3 一套推荐填写顺序

推荐你直接按下面顺序操作：

1. 填 `供应商名称`
2. 选 `供应商格式`
3. 填 `Base URL`
4. 填 `API Key`
5. 点击 `获取模型列表`
6. 选择 `模型`，或手动输入模型 ID
7. 选 `思考深度`
8. 保持 `上下文窗口 (单位:k)` 为 `200`，除非你明确知道要改
9. 点击 `健康检测`
10. 点击 `保存并应用`
11. 关闭侧边栏，再重新打开

![模型供应商配置页](./docs/screenshots/02.png)

上图建议展示 `模型供应商` 配置页里的 `供应商格式`、`Base URL`、`API Key`、`思考深度`、`上下文窗口 (单位:k)` 和 `保存并应用`。

## 5. 侧边栏使用方法

### 5.1 打开侧边栏

完成 Provider 配置后，就可以开始正常使用侧边栏了。

常见打开方式：

1. 点击工具栏里的 `Claw`
2. 或使用快捷键 `Ctrl+E`

如果你刚刚改过配置，但侧边栏还是旧状态，先把侧边栏完全关掉，再重新打开。

### 5.2 先做一次最小测试

建议第一次先发一条最简单的测试消息，确认配置真的生效：

```text
你好，请只回复 OK
```

如果能正常回复，说明链路已经跑通。

### 5.3 权限提示怎么选

侧边栏在浏览网页、点击页面或读取内容时，可能会弹出权限提示。常见选项包括：

- `允许一次`
- `按照计划执行`
- `对所有聊天允许`

建议普通用户先这样用：

- 第一次测试时，优先选 `允许一次`
- 确认这个网站可信、而且任务重复时，再考虑 `按照计划执行`
- `对所有聊天允许` 风险最高，只建议在你完全清楚影响范围时再开

![侧边栏聊天界面](./docs/screenshots/03.png)

上图建议展示侧边栏已经正常打开，并且可以看到聊天输入框和一段实际对话。

## 6. 日志捕获与问题排查

### 6.1 如何导出日志

如果你遇到空白页、报错、无响应或模型调用失败，先导出日志。

步骤如下：

1. 打开设置页左侧的 `日志捕获`
2. 打开 `启用调试模式`
3. 回到侧边栏，重新复现一次问题
4. 再回到 `日志捕获`
5. 使用 `复制日志` 或 `下载日志`

当前日志捕获会保留最近 `500` 条侧边栏事件，已经够排查大多数常见问题。

![日志导出页面](./docs/screenshots/04.png)

上图建议展示 `日志捕获` 页面里的 `启用调试模式`、`复制日志`、`下载日志` 和已捕获日志数量。

### 6.2 已知问题 1：`Identifier 'TX' has already been declared`

你当前工作区的 `1.log` 里已经出现过这条错误：

```text
Uncaught SyntaxError: Identifier 'TX' has already been declared
```

这类问题通常表现为：

- 侧边栏打开后空白
- 页面加载了，但功能没有正常响应
- 日志里出现 `window.error`

建议按这个顺序处理：

1. 回到 `chrome://extensions/`
2. 对 `Claw` 点一次“重新加载”
3. 关闭所有已打开的 Claw 侧边栏
4. 刷新目标网页
5. 再重新打开侧边栏
6. 如果还是复现，导出最新日志继续排查

### 6.3 已知问题 2：Provider 格式选错

如果你把 `供应商格式` 选错，常见现象是：

- 健康检测失败
- 一直没有回复
- 请求地址预览不对
- 接口返回 `404`、`400` 或格式错误

排查方法很简单：

- 兼容 `/chat/completions` 的接口，选 `OpenAI Chat Completions`
- 兼容 `/responses` 的接口，选 `OpenAI Responses API`
- 看一下设置页里的“请求地址”预览，确认最终地址是不是你期望的那个接口

### 6.4 已知问题 3：改了配置却没有生效

如果你明明已经改了 Provider，但侧边栏还是旧配置，通常是下面两个原因：

- 没点 `保存并应用`
- 点完后没有重新打开侧边栏

最稳妥的做法是：

1. 重新进入 `模型供应商`
2. 确认当前配置无误
3. 再点一次 `保存并应用`
4. 关闭并重新打开侧边栏

## 7. 常见问题

### 7.1 加载扩展时应该选哪个目录？

选 `claw in chrome`。上传时也只需要带这个文件夹。

### 7.2 我必须填写 `上下文窗口 (单位:k)` 吗？

不一定。普通用户直接保留默认值 `200` 就够用了。

### 7.3 `思考深度` 怎么选？

如果你不确定：

- 先用 `中`
- 如果供应商不支持 reasoning effort，就改成 `关闭`

### 7.4 英文用户看哪份文档？

直接打开英文版：[README_EN.md](./README_EN.md)

### 7.5 截图放在哪里最方便？

建议统一放到这个目录：

```text
docs/screenshots/
```

建议把图片统一放到 `docs/screenshots/`，并使用下面这 4 个文件名：

```text
01.png
02.png
03.png
04.png
```

##  Star 历史

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=S-Trespassing/--&type=date&legend=top-left)](https://www.star-history.com/#S-Trespassing/--&type=date&legend=top-left)
