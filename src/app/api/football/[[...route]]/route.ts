
import { NextResponse, type NextRequest } from 'next/server';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY; // It's better to use an environment variable

// NOTE: This server-side route handler is intended for server-side rendering or Node.js environments.
// For static exports (output: 'export'), API calls must be made directly from the client to the external API.
// This file is kept to avoid breaking imports but is not actively used in the static build.

export async function GET(
  request: NextRequest,
  { params }: { params: { route: string[] } }
) {
  const { searchParams } = new URL(request.url);
  const route = params.route || [];
  const routePath = Array.isArray(route) ? route.join('/') : '';
  
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

export const runtime = 'nodejs';

    