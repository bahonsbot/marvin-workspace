export type Extension = unknown;

export async function getLanguageExtension(): Promise<Extension | null> {
  return null;
}

export function shouldWrap(filename: string) {
  const ext = filename.includes('.') ? `.${filename.split('.').pop()!.toLowerCase()}` : '';
  return ext === '.md' || ext === '.txt' || ext === '' || ext === '.json';
}
