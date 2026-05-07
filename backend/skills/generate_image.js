export const declaration = {
  name: 'generate_image',
  description: 'Generate a high-quality image from a text prompt using AI.',
  parameters: {
    type: 'OBJECT',
    properties: {
      prompt: { type: 'STRING', description: 'Detailed description of the image to generate.' },
    },
    required: ['prompt']
  }
};

import fs from 'fs';
import path from 'path';

export async function execute(args) {
  const { prompt } = args;
  
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to generate image');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `generated_${Date.now()}.png`;
    const filePath = path.join(process.cwd(), 'screenshots', fileName);
    
    if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    
    return {
      result: 'success',
      imageUrl: `/screenshots/${fileName}`,
      prompt: prompt
    };
  } catch (error) {
    return { error: error.message };
  }
}
