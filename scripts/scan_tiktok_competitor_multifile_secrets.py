#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
patterns={
  'database URI':re.compile(r'(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?)://[^\s]+',re.I),
  'private key':re.compile(r'BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY'),
  'AWS access key':re.compile(r'AKIA[0-9A-Z]{16}'),
  'long bearer token':re.compile(r'Bearer\s+[A-Za-z0-9._-]{24,}',re.I),
  'OpenAI-style key':re.compile(r'\bsk-[A-Za-z0-9_-]{20,}'),
  'cookie header value':re.compile(r'cookie\s*[:=]\s*["\'][^"\']{16,}',re.I),
  'literal password':re.compile(r'password\s*[:=]\s*["\'][^"\']{6,}',re.I),
}

def git(*args):
  return subprocess.check_output(['git',*args],cwd=ROOT,text=True,errors='replace')

status=git('status','--porcelain').splitlines()
tracked=[]
new=[]
for line in status:
  path=line[3:]
  if not path.endswith(('.ts','.tsx','.py','.md','.json')):
    continue
  (new if line.startswith('??') else tracked).append(path)

entries=[]
if tracked:
  diff=git('diff','--unified=0','--no-color','--',*tracked)
  current=''
  added_line=0
  for raw in diff.splitlines():
    if raw.startswith('+++ b/'):
      current=raw[6:]
    elif raw.startswith('@@'):
      match=re.search(r'\+(\d+)',raw)
      added_line=int(match.group(1))-1 if match else 0
    elif raw.startswith('+') and not raw.startswith('+++'):
      added_line+=1
      entries.append((current,added_line,raw[1:]))
    elif raw and not raw.startswith('-') and not raw.startswith('diff ') and not raw.startswith('index '):
      added_line+=1
for path in new:
  target=ROOT/path
  if not target.is_file():
    continue
  for line_no,text in enumerate(target.read_text(encoding='utf-8',errors='replace').splitlines(),1):
    entries.append((path,line_no,text))

hits=[]
for path,line_no,text in entries:
  for label,pattern in patterns.items():
    if pattern.search(text):
      hits.append((path,line_no,label))
if hits:
  for path,line_no,label in hits:
    print(f'POTENTIAL_SECRET {path}:{line_no} {label}')
  raise SystemExit(1)
print(f'PASS: scanned {len(entries)} added lines across {len(set(path for path,_,_ in entries))} changed text files; no credential values found')
