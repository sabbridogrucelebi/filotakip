import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBQAgq-1DSVQ9dGAOBsh2EPtNbbH512nmo';
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  // Construct Google Places Autocomplete URL
  // Bias to Turkey (components=country:tr)
  let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:tr&language=tr&key=${apiKey}`;

  // If we have a dominant city center (lat/lng), bias the search towards it
  // radius = 30000 meters (30km)
  if (lat && lng) {
    url += `&location=${lat},${lng}&radius=30000&strictbounds=false`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API Error:', data);
      return NextResponse.json({ error: data.error_message || 'Places API failed' }, { status: 500 });
    }

    // Map Google format to our frontend suggestion format
    const suggestions = (data.predictions || []).map((p: any) => ({
      type: 'address',
      title: p.description,
      place_id: p.place_id,
      // We don't have lat/lng yet. We will fetch it when the user selects this suggestion.
    }));

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Failed to fetch Places:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
