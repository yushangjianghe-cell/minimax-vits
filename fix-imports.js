// fix-imports.js - 修复 ES 模块导入语句，确保它们包含正确的 .js 扩展名
import fs from 'fs/promises';
import path from 'path';

const libDir = './lib';

async function fixImports() {
  try {
    const files = await fs.readdir(libDir);
    const jsFiles = files.filter(file => file.endsWith('.js') || file.endsWith('.jsx'));
    
    let fixedCount = 0;
    
    for (const file of jsFiles) {
      const filePath = path.join(libDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      
      // 修复相对导入，添加 .js 或 .jsx 扩展名
      // 简化版本：直接添加 .js 扩展名，不检查文件是否存在
      // 对于 .jsx 文件，我们需要特殊处理
      const fixedContent = content
        // 修复相对导入，添加 .js 扩展名
        .replace(/from\s+['"](\.\/[^'"]+)['"]/g, (match, importPath) => {
          // 跳过已经有扩展名的导入
          if (importPath.endsWith('.js') || importPath.endsWith('.jsx') || importPath.endsWith('.json')) {
            return match;
          }
          
          // 直接添加 .js 扩展名
          return `from '${importPath}.js'`;
        })
        // 修复控制台组件导入，使用 .jsx 扩展名
        .replace(/from\s+['"](\.\/console)['"]/g, `from '$1.jsx'`);
      
      if (fixedContent !== content) {
        await fs.writeFile(filePath, fixedContent, 'utf8');
        console.log(`Fixed imports in ${filePath}`);
        fixedCount++;
      }
    }
    
    console.log(`All imports fixed! Total files processed: ${jsFiles.length}, Fixed: ${fixedCount}`);
  } catch (error) {
    console.error('Error fixing imports:', error);
    process.exit(1);
  }
}

fixImports();
