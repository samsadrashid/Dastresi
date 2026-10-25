/** Maximum diagnostic text length, excluding the CLI's fixed prefix/newline. */
export const MAX_DIAGNOSTIC_LENGTH = 512;

/** Escape terminal controls and bidi/invisible formatting; bound work and output. */
export function terminalText(value: string, limit = MAX_DIAGNOSTIC_LENGTH): string {
  let output = '';
  for (const character of value) {
    const code = character.codePointAt(0)!;
    const unsafe = code < 0x20 || (code >= 0x7f && code <= 0x9f)
      || (code >= 0x200b && code <= 0x200f) || (code >= 0x2028 && code <= 0x202e)
      || (code >= 0x2060 && code <= 0x206f) || code === 0xfeff
      || (code >= 0xd800 && code <= 0xdfff);
    const escaped = unsafe ? `\\u${code.toString(16).padStart(4, '0')}` : character;
    if (output.length + escaped.length > limit - 3) return `${output}...`;
    output += escaped;
  }
  return output;
}
