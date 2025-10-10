

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
    statistics: { team: { id: number; name: string; }; goals: { total: number; assists: number | null; }; penalty: { scored: number; } }[];
}

export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface Player {
    id: number;
    name: string;
    age: number;
    number: number | null;
    position: string;
    photo: string;
    grid: string | null;
}

export interface Favorites {
    userId: string;
    leagues?: { [key: number]: any };
    teams?: { [key:string]: any };
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

export interface Like {
    id: string; // User ID
    userId: string;
}

export interface MatchComment {
    id: string;
    userId: string;
    userName: string;
    userPhoto: string;
    text: string;
    timestamp: any; // Firestore ServerTimestamp
    parentId?: string | null;
    replies: MatchComment[];
    likes: Like[];
}


export interface Notification {
    id?: string;
    recipientId: string;
    senderId: string;
    senderName: string;
    senderPhoto: string;
    type: 'like' | 'reply';
    matchId: number;
    commentId: string;
    commentText: string;
    read: boolean;
    timestamp: any; // Firestore ServerTimestamp
}

export interface Prediction {
  userId: string;
  fixtureId: number;
  homeGoals: number;
  awayGoals: number;
  points?: number;
  timestamp: string;
}

export interface UserScore {
    userId: string;
    userName: string;
    userPhoto: string;
    totalPoints: number;
    rank?: number;
}

export interface UserProfile {
    displayName: string;
    email: string;
    photoURL: string;
}

export interface GlobalPredictionMatch {
  fixtureId: number;
  leagueId: number;
  date: string;
}

export interface DailyGlobalPredictions {
  selectedByAdmin: boolean;
  selectedMatches: GlobalPredictionMatch[];
}

export interface SeasonPrediction {
    userId: string;
    leagueId: number;
    leagueName: string;
    season: number;
    predictedChampionId?: number;
    predictedTopScorerId?: number;
    championPoints?: number;
    topScorerPoints?: number;
    timestamp: any;
}

export interface NewsArticle {
    id?: string;
    title: string;
    content: string;
    imageUrl?: string;
    imageHint?: string;
    timestamp: any; // Firestore ServerTimestamp
}

export interface ManualTopScorer {
    rank: number;
    playerName: string;
    teamName: string;
    goals: number;
    playerPhoto?: string;
}

export interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}

export interface PlayerStats {
  player: Player & { pos?: string; grid?: string; number?: number; photo?: string };
  statistics: {
    games: {
      minutes: number;
      number: number;
      position: string;
      rating: string;
      captain: boolean;
      substitute: boolean;
    };
  }[];
}

export interface LineupData {
  team: Team;
  coach: any;
  formation: string;
  startXI: PlayerStats[];
  substitutes: PlayerStats[];
}

export type PlayerWithStats = PlayerStats;
