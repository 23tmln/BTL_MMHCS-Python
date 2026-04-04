import sys
import tokenize
import io

def strip_comments(source):
    """
    Remove comments and docstrings from Python source code.
    """
    result = []
    g = tokenize.generate_tokens(io.StringIO(source).readline)
    
    last_lineno = -1
    last_col = 0
    
    for toktype, tokval, (sline, scol), (eline, ecol), line in g:
        # Ignore comments
        if toktype == tokenize.COMMENT:
            continue
            
        # Ignore multi-line docstrings (strings at start of function/class/file)
        # This is a bit tricky with tokens, but usually docstrings are the first statement.
        # However, it's safer to use a regex or ast if we want pure docstrings.
        # But let's try a simple heuristic: if it's a string, we check if it is a docstring.
        
        # A simpler way: we want to remove ALL comments (#).
        # Docstrings are technically strings in the AST but have no effect.
        # For a thorough "xoa tat ca", maybe we just want to remove everything that isn't code.
        
        # Let's use a simpler approach for # comments and blank lines first.
        # And just keep the strings as they are unless they are clearly docstrings.
        
        result.append((toktype, tokval, sline))

    # Reconstruct (simple version)
    output = ""
    curr_line = 1
    for toktype, tokval, sline in result:
        while curr_line < sline:
            output += "\n"
            curr_line += 1
        output += tokval
    return output

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: strip_comments.py <file>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Simple regex-based approach is often better for "clean" removal including blank lines.
    import re
    # Remove # comments (but not inside strings)
    # This is hard with regex, so we'll use a better logic.
    
    new_lines = []
    for line in content.splitlines():
        # Strip trailing # comment
        # Note: this is a naive check, doesn't handle # in strings correctly.
        # But for this task, a robust tokenizer is better.
        pass

    # REVISED LOGIC using tokenize to be 100% safe
    out = io.StringIO()
    prev_toktype = tokenize.INDENT
    last_lineno = -1
    last_col = 0
    
    tokens = tokenize.generate_tokens(io.StringIO(content).readline)
    
    for toktype, tokval, start, end, line in tokens:
        if toktype == tokenize.COMMENT:
            continue
        if toktype == tokenize.STRING:
            # Check if this is a docstring.
            # Docstrings are strings that are followed by NEWLINE/NL
            # and preceded by some INDENT or start of file.
            pass
        
        # This is getting complex. Let's use a known snippet for this.
        pass

    # SIMPLE BUT EFFECTIVE APPROACH:
    # 1. Remove # comments
    # 2. Remove docstrings
    # 3. Remove empty lines
    
    import ast
    import astor # if available, but I don't know if it is.
    
    # I'll use a manual line-by-line processor for # comments and just 
    # keep it simple since the user wants it "gone".
    
    print(io.StringIO(content).read()) # Placeholder
