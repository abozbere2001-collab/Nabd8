import { NextResponse } from 'next/server';
import { API_FOOTBALL_KEY, API_FOOTBALL_HOST } from '@/lib/config';

export async function GET(
  request: Request,
  { params }: { params: { route: string[] } }
) {
  const { searchParams } = new URL(request.url);
  const routePath = params.route ? params.route.join('/') : '';
  const apiURL = `https://${API_FOOTBALL_HOST}/${routePath}?${searchParams.toString()}`;

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json(
      { error: 'API key for football service is not configured.' },
      { status: 500 }
    );
  }

  try {
    const apiResponse = await fetch(apiURL, {
      headers: {
        'x-rapidapi-host': API_FOOTBALL_HOST,
        'x-rapidapi-key': API_FOOTBALL_KEY,
      },
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text();
      return NextResponse.json(
        { error: 'Failed to fetch data from football API', details: errorData },
        { status: apiResponse.status }
      );
    }

    const data = await apiResponse.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred while proxying the request.' },
      { status: 500 }
    );
  }
}
