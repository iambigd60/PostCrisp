import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [pidFile] = process.argv.slice(2)
if (!pidFile) process.exit(2)

const descendant = spawn(
  process.execPath,
  ['-e', 'process.stdout.write("descendant-partial"); setInterval(() => {}, 1000)'],
  {
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  },
)

writeFileSync(pidFile, String(descendant.pid), 'utf8')
process.stdout.write('{"auth_restore_signature":')
process.stderr.write('DO_NOT_LEAK_CHILD_STDERR')
setInterval(() => {}, 1000)
