import fs from 'fs';
const file = 'E:/SaaS_Tools/PresentationDesigner/frontend/src/components/editor/BlockRenderer.tsx';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const newLines = [
  ...lines.slice(0, 633),
  '      case "BENTO_GRID":',
  '        return <BentoGridBlock content={content} theme={theme} onChange={setContent} isEditing={isActive} />;',
  '      case "TIMELINE":',
  '        return <TimelineBlock content={content} theme={theme} onChange={setContent} isEditing={isActive} />;',
  ...lines.slice(685)
];
fs.writeFileSync(file, newLines.join('\n'));
