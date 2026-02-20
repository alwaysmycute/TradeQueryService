#!/usr/bin/env node

/**
 * 修复脚本：将所有工具文件的 execute 实现合并到 handler 中
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = '/home/node/.openclaw/workspace/TradeQueryService/agitated-tharp/docs-samples/data-engineering/GraphQL/MCP';
const TOOLS_DIR = path.join(PROJECT_DIR, 'src/tools');

// 需要修复的文件列表
const TOOL_FILES = [
  'query-country-area-reference.js',
  'query-graphql.js',
  'query-hscode-reference.js',
  'query-trade-monthly-by-code.js',
  'query-trade-monthly-by-countries.js',
  'query-trade-monthly-by-group.js',
  'query-trade-monthly-growth-by-countries.js',
  'query-trade-monthly-growth.js',
  'query-trade-monthly-share-by-countries.js',
  'query-trade-monthly-totals.js',
  'query-trade-transactions.js',
  'query-trade-yearly-by-countries.js',
  'query-trade-yearly-growth.js',
  'query-trade-yearly-share-by-countries.js',
  'query-trade-yearly-totals.js',
];

// 获取 git 历史中的原始文件内容
function getOriginalFileContent(filename) {
  try {
    const fullPath = path.join('agitated-tharp/docs-samples/data-engineering/GraphQL/MCP/src/tools', filename);
    const cmd = `git show HEAD:${fullPath}`;
    return execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf-8' });
  } catch (error) {
    console.error(`Error reading original file for ${filename}:`, error.message);
    return null;
  }
}

// 揹取 execute 函數實作
function extractExecuteFunction(content) {
  const executeMatch = content.match(
    /export async function execute\([\s\S]*?\n}(?=\n\nexport|\n*$)/m
  );

  if (!executeMatch) {
    console.error('Could not find execute function in content');
    return null;
  }

  return executeMatch[1];
}

// 修复 handler 函数
function fixHandlerFile(filePath, originalContent) {
  const currentContent = fs.readFileSync(filePath, 'utf-8');

  // 检查是否已经修复
  if (!currentContent.includes('return execute(params)')) {
    console.log(`  ✓ ${path.basename(filePath)} - already fixed or different format`);
    return false;
  }

  // 提取 execute 函数实现
  const executeImpl = extractExecuteFunction(originalContent);

  if (!executeImpl) {
    console.log(`  ✗ ${path.basename(filePath)} - could not extract execute function`);
    return false;
  }

  // 替换 handler 函数
  const handlerRegex = /export async function handler\(params\) \{\s*return execute\(params\);\s*\}/;
  const newHandler = `export async function handler(params) ${executeImpl}`;

  const newContent = currentContent.replace(handlerRegex, newHandler);

  // 检查是否成功替换
  if (newContent === currentContent) {
    console.log(`  ✗ ${path.basename(filePath)} - replacement failed`);
    return false;
  }

  // 写入修复后的文件
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`  ✓ ${path.basename(filePath)} - fixed`);
  return true;
}

// 主函数
async function main() {
  console.log('🔧 Starting tool file fixes...\n');

  let fixedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const toolFile of TOOL_FILES) {
    const filePath = path.join(TOOLS_DIR, toolFile);
    const originalContent = getOriginalFileContent(toolFile);

    if (!originalContent) {
      console.log(`  ✗ ${toolFile} - could not read original file`);
      failedCount++;
      continue;
    }

    const fixed = fixHandlerFile(filePath, originalContent);

    if (fixed === true) {
      fixedCount++;
    } else if (fixed === false) {
      skippedCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Fixed: ${fixedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log('\n✅ Done!');
}

main().catch(console.error);
