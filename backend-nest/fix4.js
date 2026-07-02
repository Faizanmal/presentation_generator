const fs = require('fs');

function replace(filePath, search, replaceStr) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replaceStr);
    fs.writeFileSync(filePath, content);
  }
}

// 1. unused 'e'
replace('src/ai/thinking-agent/critic-agent.service.ts', /catch \(e\)/g, 'catch (_e)');
replace('src/ai/thinking-agent/generator-agent.service.ts', /catch \(e\)/g, 'catch (_e)');
replace('src/email/email-provider.service.ts', /catch \(verifyError\)/g, 'catch (_verifyError)');

// 2. unused imports
replace('src/blocks/blocks.service.spec.ts', /BlockType,/g, '');
replace('src/data-charts/data-charts.service.ts', /Prisma,/g, '');
replace('src/sync/sync.service.ts', /SyncStatus,/g, '');
replace('src/themes/template-marketplace.service.ts', /Prisma,/g, '');

// 3. invalid type unknown in template literal
replace('src/common/cluster/cluster-redis.service.ts', /\$\{error\}/g, '${String(error)}');
// 4. blockContent.text object default stringification
replace('src/scripts/fix-bullet-lists.ts', /\$\{blockContent\.text\}/g, '${typeof blockContent.text === "string" ? blockContent.text : JSON.stringify(blockContent.text)}');

// 5. unexpected any in payments.controller.ts
replace('src/payments/payments.controller.ts', /\(error as any\)/g, '(error as Error)');
replace('src/payments/payments.controller.ts', /error\.message/g, '(error as Error).message');
