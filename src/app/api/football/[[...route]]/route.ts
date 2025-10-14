
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

    // Directly get the body for logging/error purposes, handle both JSON and text
    const responseBodyText = await apiResponse.text();

    if (!apiResponse.ok) {
      console.error(`API Error for ${apiURL}:`, { status: apiResponse.status, body: responseBodyText });
      // Try to parse as JSON, but fall back to text if it fails
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseBodyText);
      } catch {
        errorDetails = responseBodyText;
      }
      return NextResponse.json(
        { error: 'Failed to fetch data from football API', details: errorDetails },
        { status: apiResponse.status }
      );
    }

    // Since we've consumed the body, we parse the stored text
    const data = JSON.parse(responseBodyText);
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred while proxying the request.' },
      { status: 500 }
    );
  }
}
