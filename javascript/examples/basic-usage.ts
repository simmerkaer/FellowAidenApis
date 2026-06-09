/**
 * Basic usage example.
 *
 * Run with real credentials:
 *   FELLOW_EMAIL=you@example.com FELLOW_PASSWORD=secret \
 *     npx tsx examples/basic-usage.ts
 */
import { FellowAiden } from '../src/index.js';

async function main() {
  const email = process.env.FELLOW_EMAIL;
  const password = process.env.FELLOW_PASSWORD;
  if (!email || !password) {
    throw new Error('Set FELLOW_EMAIL and FELLOW_PASSWORD environment variables.');
  }

  const aiden = await FellowAiden.create({ email, password });

  console.log('Brewer:', aiden.getDisplayName(), `(${aiden.getBrewerId()})`);

  const profiles = await aiden.getProfiles();
  console.log(`\n${profiles.length} profiles:`);
  for (const p of profiles) {
    console.log(` - ${p.title} (${p.id})`);
  }

  // Create a profile.
  const created = await aiden.createProfile({
    profileType: 0,
    title: 'Example Pour-Over',
    ratio: 16,
    bloomEnabled: true,
    bloomRatio: 2,
    bloomDuration: 30,
    bloomTemperature: 96,
    ssPulsesEnabled: true,
    ssPulsesNumber: 3,
    ssPulsesInterval: 20,
    ssPulseTemperatures: [96, 96, 96],
    batchPulsesEnabled: false,
    batchPulsesNumber: 1,
    batchPulsesInterval: 10,
    batchPulseTemperatures: [95],
  });
  console.log('\nCreated profile:', created.id);

  // Share it, then clean up.
  const link = await aiden.generateShareLink(created.id);
  console.log('Share link:', link);

  await aiden.deleteProfileById(created.id);
  console.log('Deleted example profile.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
