import type { IAgentRuntime, Memory, Provider, State } from '@elizaos/core';

/**
 * Date filter options that can be extracted from user messages
 */
export interface DateFilterOptions {
    startDate?: Date;
    endDate?: Date;
    days?: number;
    weeks?: number;
    months?: number;
    years?: number;
    relative?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year';
    custom?: {
        startDate: Date;
        endDate: Date;
    };
}

/**
 * Date filter provider that can be used by all other providers
 * Provides date range filtering capabilities for position data and other time-based information
 */
export const dateFilterProvider: Provider = {
    name: 'DATE_FILTER',
    description: 'Date range filtering capabilities for position data and time-based information. Supports relative dates (today, yesterday, this week, etc.) and custom date ranges.',
    dynamic: true,
    get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
        console.log('DATE_FILTER')

        const messageText = message.content?.text?.toLowerCase() || '';
        const dateFilter = parseDateFilterFromMessage(messageText);

        if (!dateFilter) {
            return {
                data: {},
                values: {},
                text: 'No date filter specified. Available filters: today, yesterday, this week, last week, this month, last month, this year, last year, or custom ranges like "last 7 days", "last 30 days", "from 2024-01-01 to 2024-01-31".',
            };
        }

        const filterText = formatDateFilterText(dateFilter);

        return {
            data: {
                dateFilter,
                hasFilter: true,
            },
            values: {
                dateFilter,
            },
            text: `Date filter applied: ${filterText}`,
        };
    },
};

/**
 * Parse date filter options from message text
 */
export function parseDateFilterFromMessage(messageText: string): DateFilterOptions | null {
    const text = messageText.toLowerCase();

    // Relative date filters
    if (text.includes('today')) {
        return { relative: 'today' };
    }
    if (text.includes('yesterday')) {
        return { relative: 'yesterday' };
    }
    if (text.includes('this week')) {
        return { relative: 'this_week' };
    }
    if (text.includes('last week')) {
        return { relative: 'last_week' };
    }
    if (text.includes('this month')) {
        return { relative: 'this_month' };
    }
    if (text.includes('last month')) {
        return { relative: 'last_month' };
    }
    if (text.includes('this year')) {
        return { relative: 'this_year' };
    }
    if (text.includes('last year')) {
        return { relative: 'last_year' };
    }

    // Duration-based filters
    const daysMatch = text.match(/last\s+(\d+)\s+days?/);
    if (daysMatch) {
        return { days: parseInt(daysMatch[1]) };
    }

    const weeksMatch = text.match(/last\s+(\d+)\s+weeks?/);
    if (weeksMatch) {
        return { weeks: parseInt(weeksMatch[1]) };
    }

    const monthsMatch = text.match(/last\s+(\d+)\s+months?/);
    if (monthsMatch) {
        return { months: parseInt(monthsMatch[1]) };
    }

    const yearsMatch = text.match(/last\s+(\d+)\s+years?/);
    if (yearsMatch) {
        return { years: parseInt(yearsMatch[1]) };
    }

    // Custom date range (YYYY-MM-DD format)
    const dateRangeMatch = text.match(/from\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
    if (dateRangeMatch) {
        const startDate = new Date(dateRangeMatch[1]);
        const endDate = new Date(dateRangeMatch[2]);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            return { custom: { startDate, endDate } };
        }
    }

    // Single date filter
    const singleDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (singleDateMatch) {
        const date = new Date(singleDateMatch[1]);
        if (!isNaN(date.getTime())) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            return { custom: { startDate: startOfDay, endDate: endOfDay } };
        }
    }

    return null;
}

/**
 * Convert date filter options to actual start and end dates
 */
export function getDateRange(filter: DateFilterOptions): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    if (filter.relative) {
        switch (filter.relative) {
            case 'today':
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this_week':
                startDate = new Date(now);
                const dayOfWeek = startDate.getDay();
                startDate.setDate(startDate.getDate() - dayOfWeek);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'last_week':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this_month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'last_month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'this_year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'last_year':
                startDate = new Date(now.getFullYear() - 1, 0, 1);
                endDate = new Date(now.getFullYear() - 1, 11, 31);
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                startDate = new Date(0);
        }
    } else if (filter.days) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - filter.days);
    } else if (filter.weeks) {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (filter.weeks * 7));
    } else if (filter.months) {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - filter.months);
    } else if (filter.years) {
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - filter.years);
    } else if (filter.custom) {
        startDate = filter.custom.startDate;
        endDate = filter.custom.endDate;
    } else {
        startDate = new Date(0);
    }

    return { startDate, endDate };
}

/**
 * Filter positions by date range
 */
export function filterPositionsByDate(positions: any[], filter: DateFilterOptions): any[] {
    if (!filter) return positions;

    const { startDate, endDate } = getDateRange(filter);

    return positions.filter(position => {
        // Check if position was opened within the date range
        const positionDate = new Date(position.timestamp);
        const isOpenInRange = positionDate >= startDate && positionDate <= endDate;

        // For closed positions, also check if they were closed within the range
        let isCloseInRange = false;
        if (position.close && position.close.timestamp) {
            const closeDate = new Date(position.close.timestamp);
            isCloseInRange = closeDate >= startDate && closeDate <= endDate;
        }

        // Include position if it was opened OR closed within the range
        return isOpenInRange || isCloseInRange;
    });
}

/**
 * Filter any array of objects with timestamp fields by date range
 */
export function filterByDateRange<T extends { timestamp: number | string | Date }>(
    items: T[],
    filter: DateFilterOptions
): T[] {
    if (!filter) return items;

    const { startDate, endDate } = getDateRange(filter);

    return items.filter(item => {
        let itemDate: Date;

        if (typeof item.timestamp === 'number') {
            itemDate = new Date(item.timestamp);
        } else if (typeof item.timestamp === 'string') {
            itemDate = new Date(item.timestamp);
        } else {
            itemDate = item.timestamp;
        }

        return itemDate >= startDate && itemDate <= endDate;
    });
}

/**
 * Format date filter for display
 */
export function formatDateFilterText(filter: DateFilterOptions): string {
    if (filter.relative) {
        return filter.relative.replace('_', ' ');
    } else if (filter.days) {
        return `last ${filter.days} days`;
    } else if (filter.weeks) {
        return `last ${filter.weeks} weeks`;
    } else if (filter.months) {
        return `last ${filter.months} months`;
    } else if (filter.years) {
        return `last ${filter.years} years`;
    } else if (filter.custom) {
        const startStr = filter.custom.startDate.toISOString().split('T')[0];
        const endStr = filter.custom.endDate.toISOString().split('T')[0];
        return `${startStr} to ${endStr}`;
    }

    return 'unknown filter';
}

/**
 * Get date filter from state or message
 */
export function getDateFilterFromState(state: State): DateFilterOptions | null {
    return state.dateFilter || null;
}

/**
 * Apply date filter to account data
 */
export function applyDateFilterToAccount(account: any, filter: DateFilterOptions): any {
    if (!filter || !account.metawallets) {
        return account;
    }

    const filteredAccount = { ...account };
    filteredAccount.metawallets = account.metawallets.map((mw: any) => {
        const filteredMw = { ...mw };

        // Filter positions in each keypair
        for (const chain in filteredMw.keypairs) {
            const kp = filteredMw.keypairs[chain];
            if (kp.positions) {
                kp.positions = filterPositionsByDate(kp.positions, filter);
            }
        }

        return filteredMw;
    });

    return filteredAccount;
} 