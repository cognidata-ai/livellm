import { describe, it, expect } from 'vitest';
import { codeDetector } from '../../src/detectors/code';

describe('Code Detector', () => {
  it('should detect a JavaScript code block', () => {
    const md = `Here is some code:

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet("World");
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.language).toBe('javascript');
    expect(matches[0].data.runnable).toBe(true);
    expect(matches[0].data.code).toContain('function greet');
  });

  it('should detect a Python code block', () => {
    const md = `\`\`\`python
def hello():
    print("Hello, World!")

hello()
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.language).toBe('python');
    expect(matches[0].data.runnable).toBe(true);
  });

  it('should detect a non-runnable language', () => {
    const md = `\`\`\`rust
fn main() {
    println!("Hello!");
}
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.language).toBe('rust');
    expect(matches[0].data.runnable).toBe(false);
  });

  it('should skip livellm: code blocks', () => {
    const md = `\`\`\`livellm:alert
{"type":"info","text":"test"}
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should skip very short code blocks', () => {
    const md = `\`\`\`js
x = 1
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should detect multiple code blocks', () => {
    const md = `\`\`\`javascript
const a = 1;
const b = 2;
console.log(a + b);
\`\`\`

\`\`\`python
x = 1
y = 2
print(x + y)
\`\`\``;

    const matches = codeDetector.detect(md);
    expect(matches.length).toBe(2);
  });

  it('should transform to livellm:code-runner', () => {
    const md = `\`\`\`typescript
interface User {
  name: string;
  age: number;
}

const user: User = { name: "Alice", age: 30 };
console.log(user);
\`\`\``;

    const matches = codeDetector.detect(md);
    const result = codeDetector.transform(matches[0]);

    expect(result).toContain('livellm:code-runner');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.language).toBe('typescript');
    expect(json.copyable).toBe(true);
    expect(json.showLineNumbers).toBe(true);
    expect(json.runnable).toBe(true);
  });

  it('should give higher confidence to known languages', () => {
    const knownMd = `\`\`\`python
def hello():
    print("Hello")
    return True
\`\`\``;

    const unknownMd = `\`\`\`brainfuck
++++++[>++++++++<-]>
.+++.-------.
\`\`\``;

    const knownMatches = codeDetector.detect(knownMd);
    const unknownMatches = codeDetector.detect(unknownMd);

    expect(knownMatches[0].confidence).toBeGreaterThan(unknownMatches[0].confidence);
  });
});
