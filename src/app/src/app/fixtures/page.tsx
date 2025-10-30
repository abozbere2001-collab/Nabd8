'use client';
import { useEffect, useState } from 'react';

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState([]);

  useEffect(() => {
    const fetchFixtures = async () => {
      const res = await fetch('https://v3.football.api-sports.io/fixtures?date=2025-10-30', {
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': '827bdde6bdf871e57a55e23150948631',
        },
      });
      const data = await res.json();
      setFixtures(data.response);
    };

    fetchFixtures();
  }, []);

  return (
    <main>
      <h1>Fixtures</h1>
      <ul>
        {fixtures.map((match: any) => (
          <li key={match.fixture.id}>
            {match.teams.home.name} vs {match.teams.away.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
