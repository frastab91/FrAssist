export const declaration = {
  name: 'cleanup_screenshots',
  description: 'Deletes all images in the screenshots directory.',
  parameters: {
    type: 'OBJECT',
    properties: {},
    required: []
  }
};

import fs from 'fs';
import path from 'path';

export async function execute(args) {
  const dir = path.join(process.cwd(), 'screenshots');
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.png')) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
  return { result: 'success', message: 'Screenshots directory cleaned.' };
}
