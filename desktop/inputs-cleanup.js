const fs = require('fs');
const path = require('path');

const directories = [
    'attendance', 'jobs', 'inventory', 'products', 'sales',
    'quotations', 'team', 'tools', 'cashflow', 'flags', 'reports', 'settings', 'dashboard'
];

const basePath = 'C:\\\\Users\\\\Horizon\\\\.gemini\\\\antigravity\\\\scratch\\\\horizon-os\\\\desktop\\\\app\\\\(app)';

directories.forEach(d => {
    const filePath = path.join(basePath, d, 'page.tsx');
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');

    // Replace lingering inputs
    content = content.replace(/className="w-full bg-\[#0a0e14\] border border-white\/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150"/g, 'className="input"');
    
    content = content.replace(/className="bg-\[#0a0e14\] border border-white\/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150"/g, 'className="input"');

    content = content.replace(/className="w-full bg-\[#0a0e14\] border border-white\/5 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-\[#52525b\] focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150"/g, 'className="input pl-9"');

    content = content.replace(/className="w-full bg-\[#0a0e14\] border border-white\/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150 \[color-scheme:dark\]"/g, 'className="input [color-scheme:dark]"');

    content = content.replace(/className="bg-\[#0a0e14\] border border-white\/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150 \[color-scheme:dark\]"/g, 'className="input [color-scheme:dark]"');

    content = content.replace(/className=\{w-full bg-\[#0a0e14\] border border-white\/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150 \$\{priceColor\}\}/g, 'className={input }');

    fs.writeFileSync(filePath, content, 'utf-8');
});

console.log("Inputs cleanup done");
