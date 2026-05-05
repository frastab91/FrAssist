export const declaration = {
  name: 'duffel_travel',
  description: 'Search airports and live flight offers using Duffel API for accurate travel planning.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: {
        type: 'STRING',
        enum: ['search_airports', 'search_flights'],
        description: 'Travel action to perform.'
      },
      query: {
        type: 'STRING',
        description: 'Airport/city keyword for search_airports (e.g., "Milan", "JFK").'
      },
      origin: {
        type: 'STRING',
        description: 'Origin IATA airport code for search_flights (e.g., "MXP").'
      },
      destination: {
        type: 'STRING',
        description: 'Destination IATA airport code for search_flights (e.g., "JFK").'
      },
      departureDate: {
        type: 'STRING',
        description: 'Departure date in YYYY-MM-DD format.'
      },
      returnDate: {
        type: 'STRING',
        description: 'Optional return date in YYYY-MM-DD format.'
      },
      adults: {
        type: 'INTEGER',
        description: 'Number of adult passengers (default 1).'
      },
      cabinClass: {
        type: 'STRING',
        enum: ['economy', 'premium_economy', 'business', 'first'],
        description: 'Preferred cabin class.'
      },
      maxConnections: {
        type: 'INTEGER',
        description: 'Optional maximum number of connections.'
      },
      currency: {
        type: 'STRING',
        description: 'Optional 3-letter currency code (e.g., EUR, USD).'
      },
      limit: {
        type: 'INTEGER',
        description: 'Maximum number of rows/offers to return (default 10).'
      }
    },
    required: ['action']
  }
};

function getDuffelApiKey() {
  return process.env.DUFFEL_API_KEY || process.env.DUFFLE_API_KEY || null;
}

async function duffelRequest(endpoint, options = {}) {
  const apiKey = getDuffelApiKey();
  if (!apiKey) {
    throw new Error('Duffel API key not configured. Set DUFFEL_API_KEY (or DUFFLE_API_KEY).');
  }

  const res = await fetch(`https://api.duffel.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const err = payload?.errors?.map(e => e?.title || e?.message).filter(Boolean).join('; ')
      || payload?.message
      || text
      || `Duffel error ${res.status}`;
    throw new Error(`Duffel API error ${res.status}: ${err}`);
  }

  return payload;
}

export async function execute(args) {
  const action = args.action;

  if (action === 'search_airports') {
    const query = String(args.query || '').trim();
    if (!query) return { error: 'query is required for search_airports' };

    const limit = Math.max(1, Math.min(Number(args.limit) || 8, 20));
    const payload = await duffelRequest(`/air/airports?limit=${limit}&search=${encodeURIComponent(query)}`);
    const rows = Array.isArray(payload.data) ? payload.data : [];

    return {
      action,
      query,
      count: rows.length,
      airports: rows.map(a => ({
        id: a.id,
        iataCode: a.iata_code,
        icaoCode: a.icao_code,
        name: a.name,
        cityName: a.city_name,
        cityIataCode: a.city_iata_code,
        countryName: a.country_name,
        timeZone: a.time_zone
      }))
    };
  }

  if (action === 'search_flights') {
    const origin = String(args.origin || '').trim().toUpperCase();
    const destination = String(args.destination || '').trim().toUpperCase();
    const departureDate = String(args.departureDate || '').trim();
    const returnDate = args.returnDate ? String(args.returnDate).trim() : null;
    const adults = Math.max(1, Number(args.adults) || 1);
    const maxConnections = Number.isInteger(args.maxConnections) ? args.maxConnections : undefined;
    const cabinClass = args.cabinClass || 'economy';
    const currency = args.currency ? String(args.currency).trim().toUpperCase() : undefined;
    const limit = Math.max(1, Math.min(Number(args.limit) || 10, 25));

    if (!origin || !destination || !departureDate) {
      return { error: 'origin, destination, and departureDate are required for search_flights' };
    }

    const slices = [
      {
        origin,
        destination,
        departure_date: departureDate
      }
    ];

    if (returnDate) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: returnDate
      });
    }

    const requestBody = {
      data: {
        slices,
        passengers: Array.from({ length: adults }, () => ({ type: 'adult' })),
        cabin_class: cabinClass,
        return_offers: true,
        ...(typeof maxConnections === 'number' ? { max_connections: maxConnections } : {}),
        ...(currency ? { currency } : {})
      }
    };

    const payload = await duffelRequest('/air/offer_requests', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    const offers = Array.isArray(payload?.data?.offers) ? payload.data.offers.slice(0, limit) : [];
    return {
      action,
      search: {
        origin,
        destination,
        departureDate,
        returnDate,
        adults,
        cabinClass,
        maxConnections,
        currency
      },
      count: offers.length,
      offers: offers.map(o => ({
        id: o.id,
        totalAmount: o.total_amount,
        totalCurrency: o.total_currency,
        expiresAt: o.expires_at,
        paymentRequirements: o.payment_requirements,
        owner: o.owner ? { name: o.owner.name, iataCode: o.owner.iata_code } : null,
        slices: Array.isArray(o.slices) ? o.slices.map(s => ({
          origin: s.origin ? { iataCode: s.origin.iata_code, name: s.origin.name, cityName: s.origin.city_name } : null,
          destination: s.destination ? { iataCode: s.destination.iata_code, name: s.destination.name, cityName: s.destination.city_name } : null,
          departingAt: s.departing_at,
          arrivingAt: s.arriving_at,
          duration: s.duration,
          stops: Array.isArray(s.segments) ? Math.max(0, s.segments.length - 1) : 0,
          segments: Array.isArray(s.segments) ? s.segments.map(seg => ({
            departingAt: seg.departing_at,
            arrivingAt: seg.arriving_at,
            duration: seg.duration,
            marketingCarrier: seg.marketing_carrier ? {
              name: seg.marketing_carrier.name,
              iataCode: seg.marketing_carrier.iata_code
            } : null,
            operatingCarrier: seg.operating_carrier ? {
              name: seg.operating_carrier.name,
              iataCode: seg.operating_carrier.iata_code
            } : null,
            origin: seg.origin ? { iataCode: seg.origin.iata_code, name: seg.origin.name, cityName: seg.origin.city_name } : null,
            destination: seg.destination ? { iataCode: seg.destination.iata_code, name: seg.destination.name, cityName: seg.destination.city_name } : null
          })) : []
        })) : []
      }))
    };
  }

  return { error: `Unsupported action: ${action}. Use search_airports or search_flights.` };
}
