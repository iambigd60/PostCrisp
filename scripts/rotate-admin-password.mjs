#!/usr/bin/env node
/**
 * rotate-admin-password.mjs — rotate a Supabase user's password via the admin API.
 *
 * Usage:
 *   node scripts/rotate-admin-password.mjs [email]
 *
 * Defaults to captain@postcrisp.com if no email is given.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * The password is prompted interactively with masked input — it is NEVER taken
 * from argv, an env var, or a file, so it won't end up in shell history, the
 * process list, or debug logs.
 */

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ─── Load .env.local ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

let envFile
try {
  envFile = readFileSync(envPath, 'utf8')
} catch {
  console.error(`✗ Could not read ${envPath}. Run this script from the repo root.`)
  process.exit(1)
}

const env = {}
for (const rawLine of envFile.split('\n')) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (!m) continue
  env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ─── Target email ─────────────────────────────────────────────────────────
const email = (process.argv[2] ?? 'captain@postcrisp.com').trim()
if (!email.includes('@')) {
  console.error(`✗ Not a valid email: ${email}`)
  process.exit(1)
}

// ─── Hidden prompts ───────────────────────────────────────────────────────
function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (str) => {
      if (rl.stdoutMuted) {
        // Print a '*' for real characters, but echo control sequences (enter, backspace) verbatim
        if (str === '\n' || str === '\r' || str === '\r\n') rl.output.write(str)
        else rl.output.write('*')
      } else {
        rl.output.write(str)
      }
    }
    rl.stdoutMuted = true
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function promptVisible(query) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔐 Rotating Supabase password for: ${email}`)
  console.log(`   (Supabase project: ${new URL(SUPABASE_URL).host})\n`)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Find user by email
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) {
    console.error(`✗ Failed to list users: ${listErr.message}`)
    process.exit(1)
  }
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`✗ User not found: ${email}`)
    process.exit(1)
  }

  console.log(`Found user ${user.id} — created ${new Date(user.created_at).toLocaleDateString()}`)

  const pw1 = await promptHidden('New password (min 12 chars):           ')
  if (pw1.length < 12) {
    console.error(`✗ Password must be at least 12 characters (got ${pw1.length}).`)
    process.exit(1)
  }
  const pw2 = await promptHidden('Confirm new password:                    ')
  if (pw1 !== pw2) {
    console.error('✗ Passwords do not match.')
    process.exit(1)
  }

  const confirm = await promptVisible(`\nRotate password for ${email}? Type 'yes' to confirm: `)
  if (confirm !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: pw1 })
  if (error) {
    console.error(`✗ Failed to update password: ${error.message}`)
    process.exit(1)
  }

  console.log('\n✓ Password rotated successfully.')
  console.log(`  Save the new password in your password manager now — it is not printed.`)
  console.log(`  Test by logging out of /admin and logging back in.\n`)
}

main().catch((err) => {
  console.error(`✗ Unexpected error: ${err.message}`)
  process.exit(1)
})
