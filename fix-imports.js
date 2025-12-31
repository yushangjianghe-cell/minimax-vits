// fix-imports.js - 修复 ES 模块导入语句，确保它们包含正确的 .js 扩展名
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixImports(dir) {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await fs.stat(filePath);
    
    if (stats.isDirectory()) {
      // 递归处理子目录
      await fixImports(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      // 处理 JavaScript 文件
      const content = await fs.readFile(filePath, 'utf8');
      
      // 正则表达式：匹配 from './xxx' 或 from '../xxx' 的导入语句
      const importRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
      
      // 替换导入语句，添加 .js 扩展名
      const fixedContent = content.replace(importRegex, (match, importPath) => {
        // 如果已经有扩展名，或者是 JSON 文件，跳过
        if (importPath.endsWith('.js') || importPath.endsWith('.jsx') || importPath.endsWith('.json')) {
          return match;
        }
        // 否则添加 .js 扩展名
        return `from '${importPath}.js'`;
      });
      
      // 如果内容有变化，写回文件
      if (content !== fixedContent) {
        await fs.writeFile(filePath, fixedContent);
        console.log(`Fixed imports in ${filePath}`);
      }
    }
  }
}

// 开始修复 lib 目录
async function main() {
  const libDir = path.join(__dirname, 'lib');
  await fixImports(libDir);
  console.log('All imports fixed!');
}

main();
