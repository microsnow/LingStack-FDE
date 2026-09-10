# DevKit 开发者工具箱

DevKit 是一个隐私优先、离线优先的开发者工具集。常用转换和数据处理在浏览器本地完成，无需上传输入内容。

- 当前版本：v0.4.0
- 在线体验：[打开 DevKit](https://devkit-local-tools.buzzy-birch-3762.chatgpt.site)
- 已上线工具：74 个

## 主要特性

- 支持明亮模式和暗色模式切换
- 主题选择自动保存在本机，下次打开自动恢复
- 工具数据优先在浏览器本地处理
- 支持工具搜索、分类筛选、收藏和最近使用
- 支持结果复制和响应式布局
- 支持自动执行、输入输出交换、文件拖放和结果下载
- 支持最多 6 个工具标签页和移动端分类导航
- 敏感内容不作为项目数据上传

## 明暗模式

点击页面右上角的太阳或月亮按钮即可切换主题：

- 暗色模式：适合夜间及低光环境
- 明亮模式：适合日间及高亮环境
- 主题偏好保存在浏览器 `localStorage` 中

## 已上线工具

### 编码转换

- Base64 编解码
- URL 编解码
- Unicode 与中文互转
- HTML 实体编解码
- Unix 时间戳转换
- 二、八、十、十六进制转换

### 格式与校验

- JSON 格式化、压缩与校验
- JSON 转 YAML
- JSON 转 TypeScript
- 正则表达式测试
- Markdown 转 HTML
- YAML 转 JSON、YAML 格式化与校验
- JSON 与 XML、CSV 双向转换
- JSON Schema 基础校验
- XML、HTML、CSS、JavaScript 格式化
- CSV 表格预览、Java Properties 与 YAML 互转
- Markdown 表格生成器

### 文本处理

- 字符、单词和行数统计
- 大小写转换
- 去重复行
- 文本自然升序和降序排序
- 文本 Diff
- camelCase、PascalCase、snake_case、kebab-case 和 CONSTANT_CASE 转换
- 文本查找与批量替换、行过滤和随机打乱

### 加密与安全

- SHA-1、SHA-256、SHA-512
- JWT Header 与 Payload 解析
- 安全随机密码生成

> JWT 解析不等于签名验证，请勿仅凭解析结果信任令牌。

### Web 与网络

- URL Query 参数解析
- Curl 转 Fetch
- IPv4 CIDR 子网计算

### 前端工具

- HEX 与 RGB 颜色转换
- WCAG 颜色对比度检查
- CSS px 与 rem 转换

### 后端工具

- 五段 Cron 表达式解析
- SQL 格式化

### 数据生成

- UUID v4 批量生成
- 随机密码生成

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/Command + K` | 定位到工具搜索框 |
| `Ctrl/Command + Enter` | 执行当前工具 |

## 本地开发

环境要求：

- Node.js `>=22.13.0`
- npm

启动项目：

```bash
npm install
npm run dev
```

构建静态网站：

```bash
npm run build
```

构建产物位于 `dist/`，包含可部署到任意静态网站服务的
`index.html` 和 `assets/`。资源地址使用相对路径，支持部署在域名根目录或子目录。

运行质量检查：

```bash
npm test
npm run lint
```

每次构建都会先清理旧产物，避免历史服务端文件混入静态发布包。

## 项目结构

```text
app/
├─ main.tsx       # 静态应用入口
├─ page.tsx       # 工具配置、处理逻辑和界面
├─ globals.css    # 全局样式与明暗主题
└─ v2.css         # 补充样式
lib/              # P0 工具处理逻辑与隐私策略
scripts/          # 构建清理脚本
tests/            # 核心工具、错误边界和隐私测试
public/           # 静态资源
.openai/          # Sites 发布配置
TODO.md           # 后续开发计划
```

## 隐私说明

- 文本、代码、JWT 和密码等输入不会上传到 DevKit 服务端
- 主题、收藏和最近使用仅保存在当前浏览器
- 清理浏览器网站数据后，本地偏好会被重置
- 未来需要联网的工具必须在界面中明确标识

## 开发计划

详细功能规划和验收清单见 [TODO.md](./TODO.md)。

