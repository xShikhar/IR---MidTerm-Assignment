import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSrcDir = path.resolve(__dirname, '../src');
const systemsRunnerFile = path.resolve(__dirname, '../../eval/src/systemsRunner.js');

function scanSourceFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanSourceFiles(fullPath, fileList);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Integrity & Data Leakage Gate: No Oracle Gold Rewrite Access', () => {
  it('strictly prohibits any reference to goldRewrite across all server runtime modules (server/src/)', () => {
    const sourceFiles = scanSourceFiles(serverSrcDir);
    const violations = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('goldRewrite')) {
        violations.push(path.relative(serverSrcDir, file));
      }
    }

    assert.equal(
      violations.length,
      0,
      `Data leakage detected! The following server modules reference goldRewrite: ${violations.join(', ')}`
    );
  });

  it('strictly ensures ONLY system S5 (Oracle) touches goldRewrite in evaluation benchmark', () => {
    assert.ok(fs.existsSync(systemsRunnerFile), 'systemsRunner.js must exist');
    const content = fs.readFileSync(systemsRunnerFile, 'utf-8');
    const lines = content.split('\n');

    const leakingLines = [];
    let insideS5Block = false;

    lines.forEach((line, idx) => {
      if (line.includes("systemId === 'S5'")) {
        insideS5Block = true;
      } else if (insideS5Block && line.includes("} else if (systemId ===")) {
        insideS5Block = false;
      }

      if (line.includes('goldRewrite') && !insideS5Block && !line.trim().startsWith('//')) {
        leakingLines.push({ line: idx + 1, content: line.trim() });
      }
    });

    assert.equal(
      leakingLines.length,
      0,
      `Non-oracle evaluation system illegally references goldRewrite at: ${JSON.stringify(leakingLines)}`
    );
  });
});
