import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('[TurnTrace Dev] Starting Server (port 3001) and Client (port 3000)...');

const server = spawn(npmCmd, ['run', 'dev', '--workspace=server'], {
  stdio: 'inherit',
  shell: isWin
});

const client = spawn(npmCmd, ['run', 'dev', '--workspace=client'], {
  stdio: 'inherit',
  shell: isWin
});

function cleanup() {
  console.log('\n[TurnTrace Dev] Shutting down services...');
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[TurnTrace Dev] Server exited with code ${code}`);
    cleanup();
  }
});

client.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[TurnTrace Dev] Client exited with code ${code}`);
    cleanup();
  }
});
