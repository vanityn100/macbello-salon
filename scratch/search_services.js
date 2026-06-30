const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...searchFiles(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('from("services")') || line.includes("from('services')")) {
                    if (line.includes('.insert') || line.includes('.update') || lines[index+1]?.includes('.insert') || lines[index+1]?.includes('.update')) {
                        results.push(`${fullPath}:${index + 1}: ${line.trim()}`);
                    }
                }
            });
        }
    }
    return results;
}

const matches = searchFiles('./src/app/api');
console.log(matches.join('\n'));
