/**
 * Example Skill Plugin
 * This file serves as a template for FrAssist to create new skills.
 */

export const declaration = {
  name: 'get_system_info',
  description: 'Get basic system information like platform and architecture.',
  parameters: {
    type: 'OBJECT',
    properties: {},
    required: []
  }
};

export async function execute(args) {
  const os = await import('os');
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    freeMemory: Math.round(os.freemem() / 1024 / 1024) + ' MB'
  };
}
