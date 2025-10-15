
import { NextResponse } from 'next/server';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_FOOTBALL_KEY = 'a697517d9cdab4e718088c31c9ca7911';

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
  // - Fixtures and odds change often, so we revalidate frequently.
  // - Other data (teams, leagues, players) is more static, so we can cache it for longer.
  const isVolatileRequest = routePath.includes('fixtures') || routePath.includes('odds');
  const revalidateSeconds = isVolatileRequest ? 60 : 3600; // 1 minute for volatile, 1 hour for others

  try {
    const apiResponse = await fetch(apiURL, {
      headers: {
        'x-rapidapi-host': API_FOOTBALL_HOST,
        'x-rapidapi-key': API_FOOTBALL_KEY,
      },
      next: { revalidate: revalidateSeconds } 
    });

    // Special handling for odds to include history
    if (routePath.includes('odds') && apiResponse.ok) {
        const oddsData = await apiResponse.json();
        const fixtureId = searchParams.get('fixture');
        if (fixtureId) {
            const historyUrl = `https://${API_FOOTBALL_HOST}/odds/history?fixture=${fixtureId}&bookmaker=8&bet=1`;
            const historyResponse = await fetch(historyUrl, {
                 headers: {
                    'x-rapidapi-host': API_FOOTBALL_HOST,
                    'x-rapidapi-key': API_FOOTBALL_KEY,
                 },
                 next: { revalidate: revalidateSeconds }
            });
            if (historyResponse.ok) {
                const historyData = await historyResponse.json();
                oddsData.odds_history = historyData.response.reduce((acc: any, item: any) => {
                    if (!acc[item.fixture.id]) {
                        acc[item.fixture.id] = {};
                    }
                    if (!acc[item.fixture.id][item.bookmaker.id]) {
                        acc[item.fixture.id][item.bookmaker.id] = {};
                    }
                     if (!acc[item.fixture.id][item.bookmaker.id][item.bet.id]) {
                        acc[item.fixture.id][item.bookmaker.id][item.bet.id] = [];
                    }
                    acc[item.fixture.id][item.bookmaker.id][item.bet.id].push(item);
                    return acc;
                }, {});
            }
        }
        return NextResponse.json(oddsData);
    }


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
