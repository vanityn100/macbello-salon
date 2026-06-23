const fs = require('fs');

const files = [
  'src/app/api/billing/admin/route.ts',
  'src/app/api/inventory/route.ts',
  'src/app/api/loyalty/admin/route.ts',
  'src/app/api/loyalty/lookup/route.ts',
  'src/app/api/reports/gstr1/route.ts',
  'src/app/api/reports/tax/route.ts',
  'src/app/api/booking/confirm/route.ts',
  'src/app/api/feedback/route.ts'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');
  
  // 1. Add import if not present
  if (!content.includes("import { logError }")) {
    content = content.replace(/(import .*?;)/, "$1\nimport { logError } from '@/lib/logger';");
  }

  // 2. Replace catch blocks
  const catchRegex = /catch\s*\((.*?)\)\s*\{([\s\S]*?)return NextResponse\.json\([\s\S]*?\);\s*\}/g;
  
  content = content.replace(catchRegex, (match, errVar, body) => {
    // Determine req variable name
    let reqVar = 'request';
    if (content.includes('req: Request') || content.includes('req: NextRequest')) reqVar = 'req';

    // Extract action name from console.error
    let actionName = 'API Error';
    const consoleMatch = body.match(/console\.error\([\"'](.*?)[\"']/);
    if (consoleMatch) {
      actionName = consoleMatch[1].replace(/Error:?\s*$/, '').trim();
    }

    return `catch (${errVar}) {
    logError("${actionName}", ${errVar}, { req: ${reqVar} });
    return NextResponse.json({ success: false, error: "An unexpected error occurred. Please try again later." }, { status: 500 });
  }`;
  });

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
