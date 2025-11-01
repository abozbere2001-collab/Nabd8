// IMPORTANT: This file needs to be in the `pages` directory if you are using the pages router.
// If you are using the app router, it should be in `src/app/api/football/[...path]/route.ts`.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const apiFootballKey = process.env.API_FOOTBALL_KEY;

  if (!apiFootballKey) {
    return NextResponse.json(
      { error: 'API key is not configured' },
      { status: 500 }
    );
  }

  // Reconstruct the API path and query parameters
  const path = params.path.join('/');
  const { search } = new URL(request.url);

  const apiUrl = `https://v3.football.api-sports.io/${path}${search}`;

  try {
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-key': apiFootballKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
      // Use Next.js caching features for better performance
      next: { revalidate: 60 * 5 }, // Revalidate every 5 minutes
    });

    if (!apiResponse.ok) {
      // Forward the error response from the external API
      return NextResponse.json(await apiResponse.json(), {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
      });
    }

    const data = await apiResponse.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
