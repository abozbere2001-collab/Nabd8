import { NextResponse } from 'next/server';
import { API_FOOTBALL_KEY, API_FOOTBALL_HOST } from '@/lib/config';

export async function GET(
  request: Request,
  { params }: { params: { route: string[] } }
) {
  const { searchParams, pathname } = new URL(request.url);
  const routePath = params.route ? params.route.join('/') : '';
  const apiURL = `https://${API_FOOTBALL_HOST}/${routePath}?${searchParams.toString()}`;

  if (!API_FOOTBALL_KEY) {
    return NextResponse.json(
      { error: 'API key for football service is not configured.' },
      { status: 500 }
    );
  }

  // Smart Caching Strategy:
  // - Fixtures change often (live scores), so we revalidate frequently.
  // - Other data (teams, leagues, players) is more static, so we can cache it for longer.
  const isFixturesRequest = routePath.includes('fixtures');
  const revalidateSeconds = isFixturesRequest ? 60 : 3600; // 1 minute for fixtures, 1 hour for others

  try {
    const apiResponse = await fetch(apiURL, {
      headers: {
        'x-rapidapi-host': API_FOOTBALL_HOST,
        'x-rapidapi-key': API_FOOTBALL_KEY,
      },
      next: { revalidate: revalidateSeconds } 
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.text();
      console.error(`API Error for ${apiURL}:`, { status: apiResponse.status, body: errorData });
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
