
import type { Favorites } from './types';

const LOCAL_FAVORITES_KEY = 'goalstack_local_favorites';

export const getLocalFavorites = (): Partial<Favorites> => {
    if (typeof window === 'undefined') {
        return {};
    }
    try {
        const localData = window.localStorage.getItem(LOCAL_FAVORITES_KEY);
        return localData ? JSON.parse(localData) : {};
    } catch (error) {
        console.error("Error reading local favorites:", error);
        return {};
    }
};

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
