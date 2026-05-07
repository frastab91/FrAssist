/**
 * Ollama Monitor Skill
 * This plugin allows FrAssist to check which local models are loaded and how much VRAM/RAM they are using.
 */

export const declaration = {
  name: 'monitor_ollama',
  description: 'Get status and memory usage of local Ollama models.',
  parameters: {
    type: 'OBJECT',
    properties: {},
    required: []
  }
};

export async function execute(args) {
  const { exec } = await import('child_process');
  const util = await import('util');
  const execPromise = util.promisify(exec);

  try {
    // First, check if the Ollama server is reachable via fetch
    let isRunning = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const healthCheck = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (healthCheck.ok) isRunning = true;
    } catch (e) {
      isRunning = false;
    }

    if (!isRunning) {
      return { 
        status: 'Offline', 
        error: 'Ollama server is not running at http://localhost:11434. Please start Ollama on your machine.',
        suggestion: 'Run "ollama serve" in a terminal or open the Ollama desktop app.'
      };
    }

    // Run 'ollama ps' to get the running models
    const { stdout: psOutput } = await execPromise('ollama ps');
    const { stdout: listOutput } = await execPromise('ollama list');
    
    // Parse the ps output
    const psLines = psOutput.trim().split('\n');
    let activeModels = [];
    if (psLines.length > 1) {
      const psHeaders = psLines[0].split(/\s{2,}/);
      activeModels = psLines.slice(1).map(line => {
        const parts = line.split(/\s{2,}/);
        const modelInfo = {};
        psHeaders.forEach((h, i) => {
          modelInfo[h.toLowerCase().replace(' ', '_')] = parts[i];
        });
        return modelInfo;
      });
    }

    // Parse the list output
    const listLines = listOutput.trim().split('\n');
    let availableModels = [];
    if (listLines.length > 1) {
      const listHeaders = listLines[0].split(/\s{2,}/);
      availableModels = listLines.slice(1).map(line => {
        const parts = line.split(/\s{2,}/);
        const modelInfo = {};
        listHeaders.forEach((h, i) => {
          modelInfo[h.toLowerCase().replace(' ', '_')] = parts[i];
        });
        return modelInfo;
      });
    }

    return { 
      status: 'Active',
      models: activeModels,
      availableModels: availableModels
    };
  } catch (error) {
    return { error: `Failed to monitor Ollama: ${error.message}` };
  }
}
