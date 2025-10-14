
import { NextResponse } from 'next/server';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
// This is secure because this code only runs on the server.
const API_FOOTBALL_KEY = '5a36c80242mshe57db12185b135bp19a31fjsn9a06674e402e';

export async function GET(
  request: Request,
  { params }: { params: { route: string[] } }
) {
  const { searchParams } = new URL(request.url);
  const routePath = params.route ? params.route.join('/') : '';
  const apiURL = `https://${API_FOOTBALL_HOST}/${routePath}?${searchParams.toString()}`;

  if (!API_FOOTBALL_KEY) {
    console.error('API key for football service is not configured.');
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

    const responseBodyText = await apiResponse.text();

    if (!apiResponse.ok) {
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseBodyText);
      } catch {
        errorDetails = { message: responseBodyText };
      }
      console.error(`API Error for ${apiURL}:`, { status: apiResponse.status, body: errorDetails });
      return NextResponse.json(
        { error: 'Failed to fetch data from football API', details: errorDetails },
        { status: apiResponse.status }
      );
    }

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
