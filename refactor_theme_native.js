const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const folders = ['src/screens', 'src/components'];
let count = 0;

folders.forEach(folder => {
  const absoluteFolder = path.join(__dirname, folder);
  if (!fs.existsSync(absoluteFolder)) return;

  walkDir(absoluteFolder, (file) => {
    if (!file.endsWith('.tsx') && !file.endsWith('.ts')) return;
    
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('COLORS')) return;
    if (content.includes('const getStyles = (COLORS: any)')) return;

    const compRegex = /(export\s+(?:const|default function|function)\s+\w+\s*(?:[:=\s<>\w\.\[\]\{\}]*)?\s*\([^)]*\)\s*(?:=>)?\s*\{)/;
    if (!compRegex.test(content)) return;

    if (!content.includes('const styles = StyleSheet.create(')) return;

    // 1. Remove COLORS from constants import
    content = content.replace(/(import\s+\{.*?)(\bCOLORS\b)(.*\}\s+from\s+['"][^'"]+constants['"])/g, (m, p1, p2, p3) => {
      let newImport = p1 + p3;
      newImport = newImport.replace(/,\s*,/g, ',').replace(/\{\s*,\s*/, '{ ').replace(/\s*,\s*\}/, ' }');
      if (newImport.match(/import\s+\{\s*\}\s+from/)) return ''; 
      return newImport;
    });

    // 2. Add useThemeStore import
    const normalizedFile = file.replace(/\\/g, '/');
    const parts = normalizedFile.split('src/')[1].split('/');
    const depth = parts.length;
    const relativePrefix = '../'.repeat(depth - 1) || './';
    
    if (!content.includes('useThemeStore')) {
      content = `import { useThemeStore } from '${relativePrefix}stores/themeStore';\n` + content;
    }
    if (!content.includes('import React')) {
      content = `import React from 'react';\n` + content;
    }

    // 3. Inject hooks
    const hookInjectStr = `  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('${relativePrefix}stores/themeStore').DARK_COLORS : require('${relativePrefix}constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);\n`;
    
    content = content.replace(compRegex, `$1\n${hookInjectStr}`);

    // 4. Transform StyleSheet.create
    content = content.replace(/const styles = StyleSheet\.create\(/g, 'const getStyles = (COLORS: any) => StyleSheet.create(');

    fs.writeFileSync(file, content, 'utf8');
    count++;
    console.log(`Refactored: ${normalizedFile}`);
  });
});

console.log(`\nSuccessfully refactored ${count} files for Dynamic Themes!`);
