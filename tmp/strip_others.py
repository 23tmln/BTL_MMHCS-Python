import os
import re

def strip_sh_comments(content):
    lines = content.splitlines()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#!') : # Keep shebang
            new_lines.append(line)
        elif stripped.startswith('#'):
            continue
        else:
            # Simple inline comment removal for sh?
            # Dangerous if # is in a string.
            # Let's just remove whole-line comments for safety.
            new_lines.append(line)
    return "\n".join(new_lines)

def strip_env_comments(content):
    lines = content.splitlines()
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('#'):
            continue
        new_lines.append(line)
    return "\n".join(new_lines)

backend_dir = r"c:\Users\ADMIN\BTL_MMHCS-Python\backend"
files_to_process = [
    (os.path.join(backend_dir, "run_dev.sh"), strip_sh_comments),
    (os.path.join(backend_dir, "start.sh"), strip_sh_comments),
    (os.path.join(backend_dir, ".env"), strip_env_comments),
    (os.path.join(backend_dir, ".env.example"), strip_env_comments),
]

for path, func in files_to_process:
    if os.path.exists(path):
        print(f"Processing {path}...")
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = func(content)
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(new_content)
