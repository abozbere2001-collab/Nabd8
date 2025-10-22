
import type { Favorites } from './types';

const LOCAL_FAVORITES_KEY = 'goalstack_local_favorites';

// This function now only handles starred favorites for guests.
export const getLocalFavorites = (): Partial<Favorites> => {
    if (typeof window === 'undefined') {
        return { teams: {}, leagues: {} };
    }
    try {
        const localData = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
        // Ensure we always return a valid structure
        const parsed = localData ? JSON.parse(localData) : {};
        return {
            teams: parsed.teams || {},
            leagues: parsed.leagues || {},
            ...parsed
        };
    } catch (error) {
        console.error("Error reading local favorites:", error);
        return { teams: {}, leagues: {} };
    }
};

// This function now only handles starred favorites for guests.
export const setLocalFavorites = (favorites: Partial<Favorites>) => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
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
