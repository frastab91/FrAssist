/**
 * Hostex Availability Skill
 * This skill allows FrAssist to query property availabilities from the Hostex API.
 */

import { backOff } from 'exponential-backoff';

export const declaration = {
  name: 'get_hostex_availability',
  description: 'Query property availabilities from Hostex API for specific properties and date range.',
  parameters: {
    type: 'OBJECT',
    properties: {
      property_ids: {
        type: 'STRING',
        description: 'Comma-separated list of property IDs to query. Example: "12545573,12545574"'
      },
      start_date: {
        type: 'STRING',
        description: 'The start date for records in YYYY-MM-DD format. Must be within 1 year from now.'
      },
      end_date: {
        type: 'STRING',
        description: 'The end date for records in YYYY-MM-DD format. Must be within 3 years from now.'
      }
    },
    required: ['property_ids', 'start_date', 'end_date']
  }
};

export async function execute(args) {
  const { property_ids, start_date, end_date } = args;
  const token = process.env.HOSTEX_ACCESS_TOKEN || process.env.HOSTEX_API_KEY;

  if (!token) {
    throw new Error('Neither HOSTEX_ACCESS_TOKEN nor HOSTEX_API_KEY is defined in environment variables.');
  }

  const url = new URL('https://api.hostex.io/v3/availabilities');
  url.searchParams.append('property_ids', property_ids);
  url.searchParams.append('start_date', start_date);
  url.searchParams.append('end_date', end_date);

  const fetchWithRetry = async () => {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Hostex-Access-Token': token,
        'accept': 'application/json'
      }
    });

    if (response.status === 429) {
      throw new Error('429'); // Trigger backoff
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_msg || response.statusText);
    }

    return await response.json();
  };

  try {
    return await backOff(fetchWithRetry, {
      numOfAttempts: 5,
      startingDelay: 1000,
      retry: (e, attemptNumber) => {
        console.warn(`Hostex API attempt ${attemptNumber} failed: ${e.message}. Retrying...`);
        return true; // Always retry on error
      }
    });
  } catch (error) {
    return {
      error: true,
      message: error.message
    };
  }
}
