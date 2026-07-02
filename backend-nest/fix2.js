const fs = require('fs');
const path = require('path');

function replaceFile(filePath, search, replace) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content);
    console.log('Fixed', filePath);
  } else {
    console.log('Not found', filePath);
  }
}

// 1. no-base-to-string
replaceFile('src/ai/data-import.service.ts', /\$\{v\}/g, '${String(v)}');
replaceFile('src/scripts/fix-bullet-lists.ts', /\$\{blockContent\.text\}/g, '${String(blockContent.text)}');

// 2. restrict-template-expressions
replaceFile('src/document-ingestion/document-ingestion.service.ts', /\$\{error\}/g, '${error instanceof Error ? error.message : String(error)}');
replaceFile('src/common/cluster/cluster-redis.service.ts', /\$\{error\}/g, '${error instanceof Error ? error.message : String(error)}');
replaceFile('src/common/cluster/scalable-prisma.service.ts', /\$\{error\}/g, '${error instanceof Error ? error.message : String(error)}');

// 3. no-unused-vars
replaceFile('src/ai/ai.service.spec.ts', /LayoutType,\s*/g, '');
replaceFile('src/ai/ai.service.ts', /Prisma,\s*/g, '');
replaceFile('src/blocks/blocks.service.spec.ts', /BlockType,\s*/g, '');
replaceFile('src/common/guards/throttler.guard.ts', /ThrottlerModuleOptions,\s*/g, '');
replaceFile('src/data-charts/data-charts.service.ts', /Prisma,\s*/g, '');
replaceFile('src/document-ingestion/document-ingestion.service.ts', /type SupportedMimeType =[\s\S]*?;/g, '');
replaceFile('src/sync/sync.service.ts', /SyncStatus,\s*/g, '');
replaceFile('src/themes/template-marketplace.service.ts', /Prisma,\s*/g, '');

// 4. no-unsafe-enum-comparison
// http-exception.filter.ts
let httpExPath = 'src/common/security/filters/http-exception.filter.ts';
if (fs.existsSync(httpExPath)) {
  let content = fs.readFileSync(httpExPath, 'utf8');
  content = content.replace(/statusCode === HttpStatus\.INTERNAL_SERVER_ERROR/g, 'statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR)');
  content = content.replace(/statusCode !== HttpStatus\.INTERNAL_SERVER_ERROR/g, 'statusCode !== Number(HttpStatus.INTERNAL_SERVER_ERROR)');
  fs.writeFileSync(httpExPath, content);
  console.log('Fixed', httpExPath);
}

// 5. Unused vars (catch-all for missing ones if needed)
// Replace 'Prisma,' with '' in ai.service.ts etc.
