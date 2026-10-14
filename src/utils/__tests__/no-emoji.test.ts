import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app uses the Sun Ray icon set (components/icons), never emoji.
 *
 * Emoji draw differently on every phone, bring colours the brand does not
 * have, and cannot be tinted. 118 of them had spread through screens, toasts
 * and data before the icon set replaced them; this keeps them from coming back.
 * Comments are exempt.
 */
const ROOT = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no emoji in app code', () => {
  it('uses brand icons instead', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(join(ROOT, 'src')), ...sourceFiles(join(ROOT, 'app'))]) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;
          if (/\p{Extended_Pictographic}/u.test(line)) offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
