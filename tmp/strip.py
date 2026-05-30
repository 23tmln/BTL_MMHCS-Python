import ast
import sys
import os

def remove_comments_and_docstrings(source):
    # This automatically removes docstrings because they are just strings in AST
    # which we can filter out if they are being used as docstrings.
    # However, ast.unparse() in 3.9+ automatically respects docstrings.
    # To TRULY remove docstrings, we need a NodeTransformer.
    
    parsed = ast.parse(source)
    
    class DocstringRemover(ast.NodeTransformer):
        def visit_Module(self, node):
            self.generic_visit(node)
            if ast.get_docstring(node):
                node.body = node.body[1:] if isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant) else node.body
            return node
        
        def visit_FunctionDef(self, node):
            self.generic_visit(node)
            if ast.get_docstring(node):
                node.body = node.body[1:]
            return node
            
        def visit_ClassDef(self, node):
            self.generic_visit(node)
            if ast.get_docstring(node):
                node.body = node.body[1:]
            return node

        def visit_AsyncFunctionDef(self, node):
            self.generic_visit(node)
            if ast.get_docstring(node):
                node.body = node.body[1:]
            return node

    # More robust docstring removal:
    for node in ast.walk(parsed):
        if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef, ast.Module)):
            if len(node.body) > 0 and isinstance(node.body[0], ast.Expr) and \
               isinstance(node.body[0].value, (ast.Str, ast.Constant)):
                node.body.pop(0)

    # ast.unparse() removes all # comments automatically.
    return ast.unparse(parsed)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python strip.py <file>")
        sys.exit(1)
        
    path = sys.argv[1]
    with open(path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    new_code = remove_comments_and_docstrings(code)
    print(new_code)
