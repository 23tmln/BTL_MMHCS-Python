import ast
import sys
import os

def remove_comments_and_docstrings(source):
    try:
        parsed = ast.parse(source)
    except Exception as e:
        print(f"Error parsing source: {e}")
        return source
    
    # Remove docstrings
    for node in ast.walk(parsed):
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef, ast.Module)):
            if len(node.body) > 0:
                first = node.body[0]
                if isinstance(first, ast.Expr) and isinstance(first.value, (ast.Str, ast.Constant)):
                    # Check if it was a docstring
                    # ast.get_docstring handles complex cases but pop(0) is simple for top-levelExpr
                    node.body.pop(0)

    try:
        return ast.unparse(parsed)
    except Exception as e:
        print(f"Error unparsing: {e}")
        return source

def process_dir(directory):
    for root, dirs, files in os.walk(directory):
        if '.venv' in root or '__pycache__' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                print(f"Processing {path}...")
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        code = f.read()
                    
                    new_code = remove_comments_and_docstrings(code)
                    
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_code)
                except Exception as e:
                    print(f"Failed to process {path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python strip_all.py <directory>")
        sys.exit(1)
    
    process_dir(sys.argv[1])
