# DeepSeek Harness 临时工作区

[![DSH](https://img.shields.io/badge/Agent-DeepSeek%20Harness-4176e6)](https://www.deepseek.com/en/harness/)
[![npm](https://img.shields.io/npm/v/@cliven/dsh-tmp-wks?color=red)](https://www.npmjs.com/package/@cliven/dsh-tmp-wks)
[![Version](https://img.shields.io/github/v/release/Trisia/dsh-tmp-wks)](https://github.com/Trisia/dsh-tmp-wks/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/Trisia/dsh-tmp-wks/actions/workflows/release.yml/badge.svg)](https://github.com/Trisia/dsh-tmp-wks/actions/workflows/release.yml)

**D**eep**S**eek **H**arness **T**emporary **W**ork**s**paces (dsh-tmp-wks)

![演示](docs/demo.zh.gif)

[English](README.md) | 中文

## 为什么需要它

就想问个临时问题，却得先退出 DSH、建一个文件夹、回来把目录指过去，用完再手动删掉；而一旦忘了清理，几个会话的上下文还会互相串。

临时工作区把这一串操作收成一次点击：

- **一键创建**：点一下，就地建好一次性工作区并开好会话。
- **删除可控**：删除工作区时会问你要不要连磁盘上的临时目录一起删，默认保留。
- **两端都能用**：DSH Web 和 DSH 桌面客户端都支持，装一次即可。

## 安装

```sh
dsh plugin --profile web add @cliven/dsh-tmp-wks
```

装好后，侧边栏底部会出现「新建临时会话」按钮，点击即可创建临时工作区并开始会话；右键该按钮可打开管理面板，查看和删除本插件创建的临时工作区。

## 存储位置

临时工作区存放在 **DSH 主目录下的 `tmp/`** 目录中，目录名为 `tmp-` 加 6 位随机字符。

主目录默认为 `~/.dsh`，可通过 `$DSH_HOME` 环境变量覆盖，因此默认情况下的路径形如：

```
~/.dsh/tmp/tmp-k7mq2z
```

## 许可证

[MIT](LICENSE)