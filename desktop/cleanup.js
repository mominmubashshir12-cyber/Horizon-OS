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

    // Attendance
    content = content.replace(/bg-\[#1a1a1a\] p-4 rounded-xl border border-\[#2a2a2a\]/g, 'glass-card-compact');
    content = content.replace(/bg-\[#111111\] p-4 rounded-lg border border-\[#2a2a2a\]/g, 'glass-card-compact');
    content = content.replace(/bg-\[#111111\] p-6 rounded-lg border border-\[#2a2a2a\]/g, 'glass-card');
    content = content.replace(/bg-\[#111111\] rounded-lg p-3 space-y-2 border border-\[#2a2a2a\]/g, 'glass-card-compact space-y-2');
    content = content.replace(/border border-dashed border-\[#2a2a2a\] rounded-xl bg-\[#111111\]/g, 'glass-card border-dashed');
    
    // Theads
    content = content.replace(/bg-\[#111111\] border-b border-\[#2a2a2a\]/g, 'bg-white/5 border-b border-white/5');
    content = content.replace(/border-b border-\[#2a2a2a\] bg-\[#111111\]/g, 'bg-white/5 border-b border-white/5');

    // Modals & Large panels
    content = content.replace(/bg-\[#111111\] border border-\[#2a2a2a\] rounded-2xl/g, 'glass-panel');
    content = content.replace(/bg-\[#111111\] rounded-2xl border border-\[#2a2a2a\]/g, 'glass-panel');
    
    // Cashflow / Quotes / Jobs
    content = content.replace(/bg-\[#1a1a1a\] border border-\[#2a2a2a\] hover:border-\[#3a3a3a\] transition-colors duration-200 rounded-xl/g, 'glass-card glass-card-hover');
    content = content.replace(/bg-\[#1a1a1a\] p-3 rounded-xl border border-\[#2a2a2a\]/g, 'glass-card-compact');
    content = content.replace(/bg-\[#1a1a1a\] rounded-xl p-6 border border-\[#2a2a2a\]/g, 'glass-card');
    content = content.replace(/rounded-xl border border-\[#2a2a2a\] overflow-hidden bg-\[#1a1a1a\]/g, 'glass-card overflow-hidden !p-0');
    content = content.replace(/p-6 border-b border-\[#2a2a2a\] bg-\[#111111\]/g, 'p-6 border-b border-white/5 bg-white/5');
    content = content.replace(/bg-\[#1a1a1a\] border border-\[#2a2a2a\] transition-colors duration-200 rounded-xl/g, 'glass-card');

    // Specific to jobs
    content = content.replace(/'bg-\[#1a1a1a\]'/g, "'glass-panel'");
    content = content.replace(/'bg-\[#1a1a1a\] text-\[#52525b\] border border-\[#2a2a2a\]'/g, "'glass-card-compact text-[#52525b]'");
    content = content.replace(/bg-\[#111111\] text-\[#a1a1aa\] border border-\[#2a2a2a\]/g, 'glass-card-compact !p-1 text-[#a1a1aa]');
    
    // Dropdown shadows
    content = content.replace(/bg-\[#111111\] shadow-2xl/g, 'glass-panel shadow-2xl');

    // Team Page
    content = content.replace(/'bg-\[#1a1a1a\] border border-\[#2a2a2a\] text-\[#52525b\]'/g, "'glass-card-compact text-[#52525b]'");

    // Replace lingering loose bg colors in variables
    content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-black/20');
    content = content.replace(/bg-\[#111111\]/g, 'bg-black/40');
    content = content.replace(/border-\[#2a2a2a\]/g, 'border-white/5');

    fs.writeFileSync(filePath, content, 'utf-8');
});

console.log("Cleanup done");
