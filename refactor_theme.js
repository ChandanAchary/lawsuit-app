const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/{screens,components}/**/*.tsx');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('COLORS')) return;
  if (content.includes('const getStyles = (COLORS')) return; // already refactored

  // Find the primary exported component to inject hooks into
  // Matches: export const MyScreen = (...) => {  OR  export function MyScreen(...) {
  const compRegex = /(export\s+(?:const|function)\s+\w+\s*(?:[:=\s<>\w]*)?\s*\([^)]*\)\s*(?:=>)?\s*\{)/;
  
  if (!compRegex.test(content)) return;
  
  // Also requires changing `const styles = StyleSheet.create(`
  if (!content.includes('const styles = StyleSheet.create(')) return;

  // 1. Remove COLORS from constants import
  content = content.replace(/(import\s+\{.*?)(\bCOLORS\b)(.*\}\s+from\s+['"][^'"]+constants['"])/g, (m, p1, p2, p3) => {
    let newImport = p1 + p3;
    newImport = newImport.replace(/,\s*,/g, ',').replace(/\{\s*,\s*/, '{ ').replace(/\s*,\s*\}/, ' }');
    if (newImport.match(/import\s+\{\s*\}\s+from/)) return ''; // completely empty import block
    return newImport;
  });

  // 2. Add useThemeStore import if needed
  const depth = file.split('/').length - 1; // Assuming src is root
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
  content = content.replace(/const styles = StyleSheet\.create\(/, 'const getStyles = (COLORS: any) => StyleSheet.create(');

  fs.writeFileSync(file, content, 'utf8');
  count++;
  console.log(`Refactored: ${file}`);
});

console.log(`\nSuccessfully refactored ${count} files for Dynamic Themes!`);
