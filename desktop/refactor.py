import os
import re

directories = [
    'attendance', 'jobs', 'inventory', 'products', 'sales',
    'quotations', 'team', 'tools', 'cashflow', 'flags', 'reports', 'settings', 'dashboard'
]

base_path = r'C:\Users\Horizon\.gemini\antigravity\scratch\horizon-os\desktop\app\(app)'

for d in directories:
    file_path = os.path.join(base_path, d, 'page.tsx')
    if not os.path.exists(file_path):
        continue
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Top-level wrapper background
    content = content.replace('bg-[#0a0a0a]', 'bg-[#0a0e14]')
    
    # Cards
    content = re.sub(r'bg-\[#1a1a1a\]\s+border\s+border-\[#2a2a2a\]\s+rounded-xl', 'glass-card', content)
    content = re.sub(r'bg-\[#1e293b\]\s+border\s+border-\[#334155\]\s+rounded-xl', 'glass-card', content)

    # Buttons
    content = content.replace('bg-[#0070f3] hover:bg-[#0060d3] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150', 'btn btn-primary')
    content = content.replace('bg-transparent border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150', 'btn btn-secondary')
    content = content.replace('bg-transparent border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#a1a1aa] hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150', 'btn btn-secondary text-xs px-3 py-1.5')
    
    content = content.replace('bg-[#f59e0b] hover:bg-[#d97706] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors duration-150', 'btn btn-primary bg-[#f59e0b] hover:bg-[#d97706]')

    # Inputs
    content = content.replace('w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#0070f3] transition-colors duration-150', 'input')
    content = content.replace('w-full bg-[#0a0e14] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#52525b] focus:outline-none focus:border-[#0070f3] transition-colors duration-150', 'input')

    content = re.sub(r'const inputClasses = [\'"]input[\'"];', 'const inputClasses = "input";', content)
    content = re.sub(r'const inputClasses = [\'"]w-full bg-\[#0a0[ea]14\] border border-\[#2a2a2a\] rounded-lg px-3 py-2 text-sm text-white placeholder-\[#52525b\] focus:outline-none focus:border-\[#0070f3\] transition-colors duration-150[\'"];', 'const inputClasses = "input";', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
