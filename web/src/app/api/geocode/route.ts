import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('place_id');

  if (!placeId) {
    return NextResponse.json({ error: 'place_id parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBQAgq-1DSVQ9dGAOBsh2EPtNbbH512nmo';
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${apiKey}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK') {
      console.error('Google Geocoding API Error:', data);
      return NextResponse.json({ error: data.error_message || 'Geocoding failed' }, { status: 500 });
    }

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return NextResponse.json({
        lat: location.lat,
        lng: location.lng,
        formatted_address: data.results[0].formatted_address
      });
    }

    return NextResponse.json({ error: 'No results found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch Geocoding:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
