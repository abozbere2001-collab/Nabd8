

// This file contains all the type definitions for the data used in the app.

// --- API Football Types ---

export interface Fixture {
  fixture: { 
    id: number; 
    date: string; 
    timestamp: number; 
    venue: { id: number | null; name: string | null; city: string | null; };
    status: { 
      long: string; 
      short: string; 
      elapsed: number | null; 
    }; 
  };
  league: { 
    id: number; 
    name: string; 
    logo: string; 
    round: string; 
    season: number;
  };
  teams: { 
    home: { id: number; name: string; logo: string; winner: boolean | null; }; 
    away: { id: number; name: string; logo: string; winner: boolean | null; }; 
  };
  goals: { 
    home: number | null; 
    away: number | null; 
  };
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
  national?: boolean;
  type?: 'Club' | 'National';
}

export interface Player {
  id: number;
  name: string;
  age?: number;
  number: number | null;
  position: string;
  photo: string;
  grid?: string | null;
  rating?: string | null;
}


export interface PlayerWithStats {
  player: Player;
  statistics: {
    games: {
      minutes: number | null;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
      substitute: boolean;
    };
  }[];
}

export interface LineupData {
  team: Team & { colors: any };
  coach: { id: number; name: string; photo: string; };
  formation: string;
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
}

export interface MatchEvent {
  time: { elapsed: number; extra: number | null; };
  team: { id: number; name: string; logo: string; };
  player: { id: number | null; name: string; };
  assist: { id: number | null; name: string | null; };
  type: 'Goal' | 'Card' | 'subst' | 'Var';
  detail: string;
  comments: string | null;
}

export interface StatisticItem {
    type: string;
    value: string | number | null;
}

export interface MatchStatistics {
  team: { id: number; name: string; logo: string; };
  statistics: StatisticItem[];
}


export interface TeamStatistics {
  league: { id: number; name: string; country: string; logo: string; flag: string; season: number; };
  team: { id: number; name: string; logo: string; };
  form: string;
  fixtures: {
    played: { home: number; away: number; total: number; };
    wins: { home: number; away: number; total: number; };
    draws: { home: number; away: number; total: number; };
    loses: { home: number; away: number; total: number; };
  };
  goals: {
    for: {
      total: { home: number; away: number; total: number; };
      average: { home: string; away: string; total: string; };
      minute: { [key: string]: { total: number | null; percentage: string | null; } };
    };
    against: {
      total: { home: number; away: number; total: number; };
      average: { home: string; away: string; total: string; };
      minute: { [key: string]: { total: number | null; percentage: string | null; } };
    };
  };
  biggest: {
    streak: { wins: number; draws: number; loses: number; };
    wins: { home: string | null; away: string | null; };
    loses: { home: string | null; away: string | null; };
    goals: { for: { home: number; away: number; }; against: { home: number; away: number; }; };
  };
  clean_sheet: { home: number; away: number; total: number; };
  failed_to_score: { home: number; away: number; total: number; };
  penalty: {
    scored: { total: number; percentage: string; };
    missed: { total: number; percentage: string; };
    total: number;
  };
  lineups: { formation: string; played: number; }[];
  cards: {
    yellow: { [key: string]: { total: number | null; percentage: string | null; } };
    red: { [key: string]: { total: number | null; percentage: string | null; } };
  };
}


// --- Firebase Firestore Types ---

export interface FavoriteLeague {
    name: string;
    logo: string;
    leagueId: number;
    notificationsEnabled?: boolean;
}
export interface FavoriteTeam {
    name: string;
    logo: string;
    teamId: number;
    type?: 'Club' | 'National';
    notificationsEnabled?: boolean;
}

export interface CrownedTeam {
  teamId: number;
  name: string;
  logo: string;
  note: string;
}

export interface CrownedLeague {
    leagueId: number;
    name: string;
    logo: string;
    note: string;
    crownedAt: any; // Firestore Timestamp
}

export interface Favorites {
  userId: string;
  leagues?: { [key: number]: FavoriteLeague };
  teams?: { [key: number]: FavoriteTeam };
  players?: { [key: number]: any };
  crownedTeams?: { [key: number]: CrownedTeam };
  crownedLeagues?: { [key: string]: CrownedLeague };
  notificationsEnabled?: {
    news?: boolean;
    comments?: boolean;
  }
}

export interface AdminFavorite {
  teamId: number;
  name: string;
  logo: string;
  note: string;
}

export interface MatchDetails {
  // This interface can be expanded with other admin-managed match properties
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
  isProUser?: boolean;
  isAnonymous?: boolean;
  onboardingComplete?: boolean;
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

export interface ManagedCompetition {
  leagueId: number;
  name: string;
  logo: string;
  countryName: string;
  countryFlag: string | null;
}

export interface PinnedMatch {
  id?: string;
  isEnabled: boolean;
  homeTeamName: string;
  homeTeamLogo: string;
  awayTeamName: string;
  awayTeamLogo: string;
  competitionName: string;
  matchDate: string;
  matchTime: string;
}

export interface ManualTopScorer {
  rank: number;
  playerName: string;
  teamName: string;
  goals: number;
  playerPhoto: string;
}

export interface MatchCustomization {
  customStatus: string;
}

export interface PredictionMatch extends Fixture {
    isPinned: boolean;
}
