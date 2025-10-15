
import type { Fixture as FixtureType } from './types';

export const isMatchLive = (status: FixtureType['fixture']['status']) => {
    return ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
}
