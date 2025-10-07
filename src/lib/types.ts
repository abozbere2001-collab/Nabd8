

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
  team: { id: number; name: string; logo: string; };
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
