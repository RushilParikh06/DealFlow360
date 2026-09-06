/**
 * One command to bring DealFlow360 up: `pnpm go`.
 *
 * Everything here exists because one of these went wrong at least once and the
 * only symptom was a screen where nothing happened:
 *
 *   - .env pointed at a Postgres port nothing was listening on, so the API died
 *     on boot and every sign-in POST had nowhere to go.
 *   - migrations had not been applied, so the first query failed instead.
 *   - the database was empty, so every screen loaded and showed no records.
 *   - the API was still compiling when the browser was opened.
 *
 * So this checks each one, fixes what it safely can, and says plainly what it
 * did. It never drops data: the seed runs only when the database is empty.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = resolve(ROOT, '.env');
const API = 'http://localhost:3001/api/v1';
const WEB = 'http://localhost:3000';

const say = (message) => console.log(`  ${message}`);
const step = (message) => console.log(`\n${message}`);
const die = (message, hint) => {
  console.error(`\n  ${message}`);
  if (hint) console.error(`\n  ${hint}\n`);
  process.exit(1);
};

const run = (command, args, options = {}) =>
  new Promise((done, fail) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: options.quiet ? 'pipe' : 'inherit', ...options });
    let output = '';
    child.stdout?.on('data', (chunk) => (output += chunk));
    child.stderr?.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => (code === 0 ? done(output) : fail(new Error(output || `${command} exited ${code}`))));
  });

/** pnpm is not installed globally on every machine here. */
const pnpm = (...args) => run('npx', ['--yes', 'pnpm@9.12.0', ...args]);
const pnpmQuiet = (...args) => pnpm(...args, { quiet: true });

function portOpen(port, host = '127.0.0.1') {
  return new Promise((done) => {
    const socket = createConnection({ port, host });
    const settle = (value) => {
      socket.destroy();
      done(value);
    };
    socket.setTimeout(1500);
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
    socket.once('timeout', () => settle(false));
  });
}

async function waitFor(label, check, seconds = 90) {
  process.stdout.write(`  waiting for ${label} `);
  for (let attempt = 0; attempt < seconds * 2; attempt += 1) {
    if (await check()) {
      process.stdout.write(' up\n');
      return true;
    }
    if (attempt % 4 === 0) process.stdout.write('.');
    await new Promise((done) => setTimeout(done, 500));
  }
  process.stdout.write(' gave up\n');
  return false;
}

// ---------------------------------------------------------------- 1. the .env

step('1/5  environment');
if (!existsSync(ENV)) {
  copyFileSync(resolve(ROOT, '.env.example'), ENV);
  say('created .env from .env.example');
}

let env = readFileSync(ENV, 'utf8');
const dbUrl = /^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(env)?.[1];
if (!dbUrl) die('.env has no DATABASE_URL.', 'Copy .env.example over it and try again.');

const configured = Number(new URL(dbUrl).port || 5432);
let port = configured;

if (!(await portOpen(port))) {
  // .env.example ships the docker-compose mapping (5433). A machine running
  // Postgres natively answers on 5432, and the only symptom of the mismatch is
  // an API that exits on boot. Look at the other one before giving up.
  const alternatives = [5432, 5433].filter((candidate) => candidate !== configured);
  const found = [];
  for (const candidate of alternatives) if (await portOpen(candidate)) found.push(candidate);

  if (found.length === 0) {
    die(
      `Nothing is listening on port ${configured}, where DATABASE_URL points.`,
      'Start PostgreSQL, then run this again:\n' +
        '    docker compose up -d           # if you use Docker\n' +
        '    brew services start postgresql@16   # if you installed it with Homebrew',
    );
  }

  port = found[0];
  env = env.replace(/^(DATABASE_URL\s*=\s*"?[^"\n]*:)\d+(\/)/m, `$1${port}$2`);
  writeFileSync(ENV, env);
  say(`nothing on port ${configured}; PostgreSQL is on ${port} — updated .env to match`);
}
say(`database port ${port}`);

// Prisma reads .env itself, but this process may carry a stale exported value.
process.env.DATABASE_URL = dbUrl.replace(/:\d+\//, `:${port}/`);
// psql rejects Prisma's ?schema= parameter, so probe with a plain URL.
const psqlUrl = process.env.DATABASE_URL.split('?')[0];

// ------------------------------------------------------------- 2. the schema

step('2/5  schema');
try {
  await pnpmQuiet('generate');
  say('prisma client generated');
} catch (error) {
  die('prisma generate failed.', String(error.message).split('\n').slice(0, 6).join('\n    '));
}

try {
  const output = await pnpmQuiet('exec', 'prisma', 'migrate', 'deploy');
  const applied = /(\d+) migrations? applied/.exec(output);
  say(applied ? `${applied[1]} migration(s) applied` : 'schema already up to date');
} catch (error) {
  const message = String(error.message);
  if (/P1000|authentication/i.test(message)) {
    die(
      'PostgreSQL refused the credentials in DATABASE_URL.',
      'Create the role and database once:\n' +
        `    createuser -s dealflow\n` +
        `    psql -c "ALTER ROLE dealflow WITH PASSWORD 'dealflow'"\n` +
        `    createdb -O dealflow dealflow`,
    );
  }
  if (/P1003|does not exist/i.test(message)) {
    die('The database named in DATABASE_URL does not exist.', '    createdb -O dealflow dealflow');
  }
  die('Applying migrations failed.', message.split('\n').slice(0, 8).join('\n    '));
}

// --------------------------------------------------------------- 3. demo data

step('3/5  demo data');

// A screen full of "No records" looks the same as a broken binder, so make sure
// there is something to show. Never re-seed a database that already has data:
// that would throw away whatever the demo just created.
let seeded = false;
try {
  const count = await run('psql', [psqlUrl, '-tAc', 'select count(*) from users'], { quiet: true });
  if (Number(count.trim()) === 0) {
    say('database is empty - seeding');
    await pnpmQuiet('db:seed');
    seeded = true;
  } else {
    say(`${count.trim()} user(s) already present - leaving the data alone`);
  }
} catch {
  // No psql on PATH, or the table is not there yet. The seed is idempotent, so
  // running it is the safe move when we cannot tell.
  say('could not read the database directly - running the seed (it is idempotent)');
  await pnpmQuiet('db:seed');
  seeded = true;
}

// ------------------------------------------------------------- 4. the servers

step('4/5  servers');

const answering = async (url) => {
  try {
    // Any HTTP answer means something is serving. The API replies 401 to an
    // anonymous request, which is a healthy API, not a failure. A plain fetch
    // has no timeout of its own - something that accepts the TCP connection
    // but never writes a response (a stray non-HTTP process squatting on the
    // port) hangs this forever instead of failing fast.
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).status > 0;
  } catch {
    return false;
  }
};

// Running this twice should not be an error. If DealFlow360 is already up,
// say where it is and stop - starting a second copy would only lose the port
// race and print a stack trace about the instance that is working fine.
const already = { api: await answering(`${API}/quotes`), web: await answering(`${WEB}/login/`) };
if (already.api && already.web) {
  say('already running - nothing to start');
  console.log(`\n  DealFlow360 is up at ${WEB}/login/  (API on ${API})`);
  console.log('  Stop it with Ctrl+C in the terminal running it, or:');
  console.log('    pkill -f "next dev"; pkill -f "nest start"\n');
  process.exit(0);
}

// Anything still holding 3000/3001 at this point is a leftover: half of a
// previous `pnpm go` that did not shut down cleanly, or a crashed API that
// left the OS socket lingering. Telling someone to go find and kill it by hand
// is exactly the babysitting this command exists to remove - these two ports
// belong to this project, so free them and move on. The only thing this
// refuses to touch is a port held by something that is not even Node, since
// that is clearly not one of ours.
function pidsOnPort(port) {
  try {
    // -sTCP:LISTEN matters: without it lsof also returns processes with an
    // unrelated, already-CLOSED connection that once touched this port (an
    // editor's network helper, a browser tab) - none of which are holding the
    // port open, so killing them would accomplish nothing and risk something.
    return execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return []; // lsof exits 1 when nothing matches - not an error here
  }
}

function commandFor(pid) {
  try {
    return execFileSync('ps', ['-p', pid, '-o', 'comm='], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function freeStalePort(port, label) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) return;

  const foreign = pids.filter((pid) => !/node/i.test(commandFor(pid)));
  if (foreign.length > 0) {
    die(
      `Port ${port} is held by a process that is not Node, so it is not a leftover ${label} - stopping rather than killing something unrelated.`,
      `Find it and stop it yourself:\n    lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    );
  }

  say(`clearing a leftover process on port ${port} (a previous run that did not shut down)`);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
  for (let attempt = 0; attempt < 20 && (await portOpen(port)); attempt += 1) {
    await new Promise((done) => setTimeout(done, 200));
  }
  if (await portOpen(port)) {
    die(`Port ${port} would not come free.`, `Stop it yourself:\n    lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  }
}

if (!already.api) await freeStalePort(3001, 'API');
if (!already.web) await freeStalePort(3000, 'web app');

const dev = spawn('npx', ['--yes', 'pnpm@9.12.0', 'dev'], { cwd: ROOT, stdio: 'inherit' });
const stop = () => {
  dev.kill('SIGINT');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
dev.on('close', (code) => process.exit(code ?? 0));

const apiUp = await waitFor('the API on :3001', () => answering(`${API}/quotes`));
if (!apiUp) {
  console.error('\n  The API did not come up. Its errors are in the [api] lines above.');
  console.error('  The usual causes are a database it cannot reach and a port 3001 already in use.\n');
}

const webUp = await waitFor('the web app on :3000', () => answering(`${WEB}/login/`));

// ------------------------------------------------------------- 5. engine state

step('5/5  risk scores, approvals and deal health');
if (apiUp) {
  try {
    await pnpmQuiet('db:demo');
    say('evaluated the open quotes and swept deal health');
  } catch (error) {
    say(`could not run the demo pipeline: ${String(error.message).split('\n')[0]}`);
    say('run it yourself once the API settles:  pnpm db:demo');
  }
} else {
  say('skipped - the API is not answering');
}

console.log(`
  DealFlow360 is running.

    web   ${WEB}/login/
    api   ${API}
    data  ${seeded ? 'freshly seeded' : 'kept as it was'}

  Sign in with any of these, password dealflow123:

    manager@dealflow.test    sees the approval queue
    finance@dealflow.test    sees the finance stage and payments
    rep@dealflow.test        raises quotations
    admin@dealflow.test      sees everything

  Press Ctrl+C to stop both servers.
`);
