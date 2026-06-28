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

    // Background wrapper and glass-panel wrapper
    // The instruction says: "Pages usually have a top-level div like <div className="flex-1 overflow-auto p-8 bg-[#0a0a0a]">. Keep this, but use bg-[#0a0e14] instead of bg-[#0a0a0a]."
    // Also "Wrap the main content of every page in .glass-panel or .glass-card" - maybe replacing bg-[#0a0a0a] with bg-[#0a0e14] glass-panel? Or just changing bg?
    // "Wrap the main content of every page in .glass-panel or .glass-card." Usually the top level div is the main content.
    // Let's replace "flex-1 overflow-auto p-8 bg-[#0a0a0a]" with "flex-1 overflow-auto p-8 bg-[#0a0e14] glass-panel". 
    // Actually, bg-[#0a0a0a] -> bg-[#0a0e14] is enough for the background color, and then if we need glass-panel maybe on the same element?
    // Let's just replace the exact bg string:
    content = content.replace(/bg-\[#0a0a0a\]/g, 'bg-[#0a0e14]');

    // Cards
    content = content.replace(/bg-\[#1a1a1a\]\s+border\s+border-\[#2a2a2a\]\s+rounded-xl/g, 'glass-card');
    content = content.replace(/bg-\[#1e293b\]\s+border\s+border-\[#334155\]\s+rounded-xl/g, 'glass-card');
    content = content.replace(/bg-\[#111111\]\s+border\s+border-\[#2a2a2a\]\s+rounded-xl/g, 'glass-card');

    // Table container and modals container sometimes have similar ones, but we updated DataTable and Modal components.
    
    // Buttons
    content = content.replace(/bg-\[#0070f3\] hover:bg-\[#0060d3\] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150/g, 'btn btn-primary');
    content = content.replace(/bg-transparent border border-\[#2a2a2a\] hover:border-\[#3a3a3a\] text-\[#a1a1aa\] hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150/g, 'btn btn-secondary');
    content = content.replace(/bg-transparent border border-\[#2a2a2a\] hover:border-\[#3a3a3a\] text-\[#a1a1aa\] hover:text-white text-xs font-medium px-3 py-1\.5 rounded-lg transition-colors duration-150/g, 'btn btn-secondary text-xs px-3 py-1.5');
    
    // Warning button
    content = content.replace(/bg-\[#f59e0b\] hover:bg-\[#d97706\] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150/g, 'btn btn-primary bg-[#f59e0b] hover:bg-[#d97706]');
    // Danger button
    content = content.replace(/bg-transparent border border-\[#2a2a2a\] hover:border-red-800 hover:text-red-400 text-\[#a1a1aa\] text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150/g, 'btn btn-secondary hover:border-red-800 hover:text-red-400');

    // Red danger button
    content = content.replace(/bg-red-500\/10 hover:bg-red-500\/20 text-red-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150/g, 'btn btn-secondary hover:border-red-800 hover:text-red-400');

    // Inputs
    content = content.replace(/w-full bg-\[#0a0a0a\] border border-\[#2a2a2a\] rounded-lg px-3 py-2 text-sm text-white placeholder-\[#52525b\] focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150/g, 'input');
    content = content.replace(/w-full bg-\[#0a0e14\] border border-\[#2a2a2a\] rounded-lg px-3 py-2 text-sm text-white placeholder-\[#52525b\] focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150/g, 'input');

    content = content.replace(/const inputClasses = ['"].*?['"];/g, 'const inputClasses = "input";');

    fs.writeFileSync(filePath, content, 'utf-8');
});

console.log("Done");
