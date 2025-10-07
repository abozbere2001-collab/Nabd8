// --- TYPE DEFINITIONS ---
export interface Fixture {
  fixture: { id: number; date: string; timestamp: number; status: { short: string; long: string; elapsed: number | null; }; };
  league: { id: number; name: string; logo: string; round: string; };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null; }; away: { id: number; name: string; logo: string; winner: boolean | null; }; };
  goals: { home: number | null; away: number | null; };
}

export interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string; };
  points: number;
  goalsDiff: number;
  all: { played: number; win: number; draw: number; lose: number; };
}

export interface TopScorer {
    player: { id: number; name: string; photo: string; };
    statistics: { team: { id: number; name: string; }; goals: { total: number; }; penalty: { scored: number; } }[];
}

export interface Team {
  team: { id: number; name: string; logo: string; };
}

export interface Favorites {
    leagues?: { [key: number]: any };
    teams?: { [key: number]: any };
    players?: { [key: number]: any };
}

export interface AdminFavorite {
  teamId: number;
  name: string;
  logo: string;
  note: string;
}

export interface MatchDetails {
    commentsEnabled: boolean;
}

export interface MatchComment {
    userId: string;
    userName: string;
    userPhoto: string;
    text: string;
    createdAt: any; // Firestore ServerTimestamp
}
