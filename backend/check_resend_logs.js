const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY_RALLY);

async function fetchEmailLogs() {
  try {
    // List emails to get recent logs
    const { data, error } = await resend.emails.list({
      limit: 10,
      order: 'desc',
    });

    if (error) {
      console.error('Error fetching logs:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

fetchEmailLogs().then(logs => {
  if (logs) {
    console.log(JSON.stringify(logs, null, 2));
  } else {
    console.log('No logs found.');
  }
});
