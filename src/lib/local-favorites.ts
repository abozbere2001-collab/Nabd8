
import type { Favorites } from './types';

const LOCAL_FAVORITES_KEY = 'goalstack_local_favorites';

// This function now only handles starred favorites for guests.
export const getLocalFavorites = (): Partial<Favorites> => {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const localData = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
        const parsed = localData ? JSON.parse(localData) : {};
        // Ensure we don't return heart-based favorites for guests
        delete parsed.ourLeagueId;
        delete parsed.ourBallTeams;
        return parsed;
    } catch (error) {
        console.error("Error reading local favorites:", error);
        return {};
    }
};

// This function now only handles starred favorites for guests.
export const setLocalFavorites = (favorites: Partial<Favorites>) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        // Ensure we don't save heart-based favorites for guests
        const { ourLeagueId, ourBallTeams, ...starredFavorites } = favorites;
        window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(starredFavorites));
    } catch (error) {
        console.error("Error saving local favorites:", error);
    }
};

export const clearLocalFavorites = () => {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.removeItem(LOCAL_FAVORITES_KEY);
};

    