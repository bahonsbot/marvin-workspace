import { StreamLanguage } from '@codemirror/language';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export type Extension = import('@codemirror/state').Extension;

function fileExtension(filename: string) {
  return filename.includes('.') ? `.${filename.split('.').pop()!.toLowerCase()}` : '';
}

export async function getLanguageExtension(filename: string): Promise<Extension | null> {
  const ext = fileExtension(filename);

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.jsx') {
    return javascript({ jsx: true });
  }

  if (ext === '.ts' || ext === '.mts' || ext === '.cts' || ext === '.tsx') {
    return javascript({ typescript: true, jsx: true });
  }

  if (ext === '.json') {
    return json();
  }

  if (ext === '.md' || ext === '.mdx') {
    return markdown();
  }

  if (ext === '.py') {
    return python();
  }

  if (ext === '.yaml' || ext === '.yml') {
    return yaml();
  }

  if (ext === '.css' || ext === '.scss' || ext === '.less') {
    return css();
  }

  if (ext === '.html' || ext === '.htm') {
    return html();
  }

  if (ext === '.sh' || ext === '.bash' || ext === '.zsh') {
    return StreamLanguage.define(shell);
  }

  return null;
}

export function shouldWrap(filename: string) {
  const ext = fileExtension(filename);
  return ext === '.md' || ext === '.txt' || ext === '' || ext === '.json';
}
