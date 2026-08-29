import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testTexts = [
  "Voice Recap (English, ~7 min). Capital is winning, labor is losing — visible in both the US income stats per capita and global inflation.",
  "Here is your daily audio briefing. We analyzed three market themes tying the day together.",
  "Ciao! Come stai oggi? Questa è una prova di sintesi vocale in italiano.",
  "Hola, esta es una prueba en español para verificar la pronunciación."
];

async function runTest() {
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || 'myllm-460104';
  const { stdout } = await execPromise('gcloud auth print-access-token');
  const token = stdout.trim();

  for (const text of testTexts) {
    console.log('\n--- Input Text ---');
    console.log(text);

    // Call synthesize with en-US default Journey voice
    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': gcpProject
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'en-US', name: 'en-US-Journey-F' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 }
      })
    });

    console.log('HTTP Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Success! Synthesized bytes:', data.audioContent?.length);
    } else {
      console.error('Error:', await res.text());
    }
  }
}

runTest();
