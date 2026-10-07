import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const EXPECTED_HASHES = {
  'corpus.json': '2394b2a11a46ed8ab7bcc0194ba78c0c3da38c792f6b76a0d7ca9ab5fbd01282',
  'index.json': '68965158b354389457c261c7a180073ed66a871b489fb6a4e3b4013d01db415d'
};

const unpack = process.argv.includes('--unpack');

console.log('=== TurnTrace Frozen Data Verification ===');
let allPassed = true;

for (const [filename, expectedSha] of Object.entries(EXPECTED_HASHES)) {
  const directPath = path.join(rootDir, 'data', filename);
  const gzPath = path.join(rootDir, 'data', 'frozen', `${filename}.gz`);

  if (fs.existsSync(directPath)) {
    const fileBuffer = fs.readFileSync(directPath);
    const actualSha = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (actualSha.toLowerCase() === expectedSha.toLowerCase()) {
      console.log(`✔ data/${filename}: SHA-256 match (${actualSha})`);
    } else {
      console.error(`❌ data/${filename}: SHA-256 mismatch!`);
      console.error(`   Expected: ${expectedSha}`);
      console.error(`   Actual:   ${actualSha}`);
      allPassed = false;
    }
  } else if (fs.existsSync(gzPath)) {
    const gzBuffer = fs.readFileSync(gzPath);
    const uncompressed = zlib.gunzipSync(gzBuffer);
    const actualSha = crypto.createHash('sha256').update(uncompressed).digest('hex');

    if (actualSha.toLowerCase() === expectedSha.toLowerCase()) {
      console.log(`✔ ${filename}.gz: SHA-256 match (${actualSha})`);
      if (unpack) {
        fs.writeFileSync(directPath, uncompressed);
        console.log(`  Unpacked to: ${directPath}`);
      }
    } else {
      console.error(`❌ ${filename}.gz: SHA-256 mismatch!`);
      console.error(`   Expected: ${expectedSha}`);
      console.error(`   Actual:   ${actualSha}`);
      allPassed = false;
    }
  } else {
    console.error(`❌ Missing data file: data/${filename}`);
    console.error(`   Please download ${filename} into data/ from the official Google Drive folder:`);
    console.error(`   https://drive.google.com/drive/folders/1v6gZbclgtuP-jE0E5L60N5V7Aucx-5RY?usp=drive_link`);
    allPassed = false;
  }
}

if (!allPassed) {
  process.exit(1);
} else {
  console.log('All frozen data files verified successfully.');
}
