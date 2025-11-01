import { type NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = 'v3.football.api-sports.io';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const { searchParams } = new URL(request.url);
  const apiPath = params.path.join('/');
  
  const targetUrl = `https://${API_HOST}/${apiPath}?${searchParams.toString()}`;

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key is missing' }, { status: 500 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST,
      },
      // Optional: Add caching strategy if needed
      // next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`API Error Response from ${targetUrl}:`, errorData);
      return NextResponse.json({ error: 'Failed to fetch data from the football API', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Internal error fetching from ${targetUrl}:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
