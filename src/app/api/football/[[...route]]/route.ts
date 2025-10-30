import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic'; // ⬅️ هذا السطر يمنع الخطأ في next export

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_FOOTBALL_KEY = '75f36f22d689a0a61e777d92bbda1c08';

export async function GET(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const { searchParams } = new URL(request.url);
  const route = params.route || [];
  const routePath = Array.isArray(route) ? route.join('/') : '';
  
  const apiURL = `https://${API_FOOTBALL_HOST}/${routePath}?${searchParams.toString()}`;

  if (!API_FOOTBALL_KEY) {
    console.error('API key for football service is not configured.');
    return NextResponse.json(
      { error: 'API key for football service is not configured.' },
      { status: 500 }
    );
  }

  const isFixtureById = routePath === 'fixtures' && searchParams.has('id');
  const isVolatileRequest = isFixtureById || routePath.includes('odds') || routePath.includes('players/squads');
  const isLargeRequest = (routePath === 'fixtures' && searchParams.has('date')) || routePath.includes('players/squads');
  
  const cacheOptions = isFixtureById 
    ? { cache: 'no-store' as RequestCache }
    : isLargeRequest 
      ? { cache: 'no-store' as RequestCache }
      : { next: { revalidate: isVolatileRequest ? 60 : 3600 } };

  try {
    const apiResponse = await fetch(apiURL, {
      headers: {
        'x-rapidapi-host': API_FOOTBALL_HOST,
        'x-rapidapi-key': API_FOOTBALL_KEY,
      },
      ...cacheOptions
    } as RequestInit);

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

export const runtime = 'nodejs';
