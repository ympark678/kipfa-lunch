import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`,
      {
        headers: {
          'X-Naver-Client-Id': clientId || '',
          'X-Naver-Client-Secret': clientSecret || '',
        },
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
