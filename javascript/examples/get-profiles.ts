/**
 * Read-only smoke test against the real Fellow API.
 *
 * 1. Copy `.env.example` to `.env` and fill in your Fellow credentials.
 * 2. Run:  npm run demo
 *
 * This only reads (auth, device, profiles, schedules) — it never creates,
 * updates, or deletes anything.
 */
import { FellowAiden } from '../src/index.js';

async function main() {
  const email = process.env.FELLOW_EMAIL;
  const password = process.env.FELLOW_PASSWORD;
  if (!email || !password) {
    console.error('Missing FELLOW_EMAIL / FELLOW_PASSWORD. Copy .env.example to .env first.');
    process.exitCode = 1;
    return;
  }

  console.log('Authenticating…');
  const aiden = await FellowAiden.create({ email, password });

  console.log(`\n☕ Brewer: ${aiden.getDisplayName()} (${aiden.getBrewerId()})`);

  const profiles = await aiden.getProfiles();
  console.log(`\nProfiles (${profiles.length}):`);
  for (const p of profiles) {
    console.log(`  • ${p.title}  [${p.id}]`);
  }

  const schedules = await aiden.getSchedules();
  console.log(`\nSchedules (${schedules.length}):`);
  for (const s of schedules) {
    console.log(`  • ${s.id}`);
  }

  console.log('\n✅ Library works against the live API.');
}

main().catch((err) => {
  console.error('\n❌ Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
