# 插件分发指南

本文档说明如何构建和分发 `koishi-plugin-minimax-vits` 插件。

## 准备工作

### 1. 更新版本号

在发布新版本前，更新 `package.json` 中的版本号：

```json
{
  "version": "0.0.1"  // 使用语义化版本号：主版本.次版本.修订版本
}
```

### 2. 更新仓库信息

在 `package.json` 中更新以下字段：

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/your-username/koishi-plugin-minimax-vits.git"
  },
  "bugs": {
    "url": "https://github.com/your-username/koishi-plugin-minimax-vits/issues"
  },
  "homepage": "https://github.com/your-username/koishi-plugin-minimax-vits#readme"
}
```

## 构建插件

### 方法一：使用 Yakumo（推荐）

在项目根目录运行：

```bash
# 构建所有插件
yarn build

# 只构建当前插件（在插件目录下）
cd external/minimax-vits
yarn build
```

构建产物会输出到 `lib/` 目录。

### 方法二：使用 TypeScript 编译器

```bash
cd external/minimax-vits
npx tsc
```

## 发布到 npm

### 1. 登录 npm

```bash
npm login
```

### 2. 检查发布内容

```bash
# 查看将要发布的文件
npm pack --dry-run
```

### 3. 发布

```bash
# 发布到 npm
npm publish

# 如果是首次发布，可能需要添加 --access public
npm publish --access public
```

### 4. 发布到 GitHub

如果使用 GitHub，可以创建 Release：

1. 在 GitHub 仓库创建新的 Release
2. 标签版本号（如 `v0.0.1`）
3. 上传构建产物（可选）

## 本地测试

在发布前，建议先进行本地测试：

```bash
# 在插件目录下
cd external/minimax-vits

# 构建
yarn build

# 在另一个 Koishi 项目中测试
cd /path/to/test-koishi-project
npm install /path/to/minimax-vits
```

## 发布检查清单

- [ ] 更新版本号
- [ ] 更新 README.md（如有新功能）
- [ ] 更新 CHANGELOG.md（如有）
- [ ] 构建插件并检查 `lib/` 目录
- [ ] 运行测试（如有）
- [ ] 检查 `package.json` 中的 `files` 字段包含所有必要文件
- [ ] 登录 npm
- [ ] 执行 `npm publish`

## 版本管理

遵循[语义化版本](https://semver.org/lang/zh-CN/)规范：

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

## 更新已发布的版本

如果需要更新已发布的版本：

1. 修改代码
2. 更新版本号
3. 重新构建
4. 重新发布

```bash
npm version patch  # 修订号 +1
npm version minor  # 次版本号 +1
npm version major  # 主版本号 +1
npm publish
```

## 从 npm 安装

用户可以通过以下方式安装你的插件：

```bash
npm install koishi-plugin-minimax-vits
# 或
yarn add koishi-plugin-minimax-vits
```

然后在 `koishi.yml` 中配置即可使用。

