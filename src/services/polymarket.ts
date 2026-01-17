import axios from 'axios';

const CLOB_API_URL = '/api/clob';

export interface Market {
    id: string;
    question: string;
    slug: string;
    volume24hr: number;
    volume1wk: number; // 7d volume
    volume: number; // Total volume
    outcomes: string; // JSON string
    outcomePrices: string; // JSON string
    clobTokenIds: string; // JSON string
    active: boolean;
    closed: boolean;
    image?: string;
    icon?: string;
    description?: string;
}

export interface ParsedMarket extends Omit<Market, 'outcomes' | 'outcomePrices' | 'clobTokenIds'> {
    outcomes: string[];
    outcomePrices: number[];
    clobTokenIds: string[];
    volume24hr: number;
    volume7d: number;
    spread: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    bestBidDepth: number;
    bestAskDepth: number;
    fillScore: number;
}

export interface OrderBook {
    hash: string;
    market: string; // token_id
    asset_id: string;
    timestamp: string;
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
}

export interface MarketWithSpread extends ParsedMarket { }

export interface ScalpingMarketDetails {
    spreadInTicks: number;
    depth1Tick: number;
    depth3Tick: number;
    depth5Tick: number;
    daysToRes: number;
    bidDepth1?: number;
    askDepth1?: number;
    bidDepth5?: number;
    askDepth5?: number;
}

export interface ScalpingMarket extends Omit<ParsedMarket, 'details'> {
    tickSize: number;
    scalpingScore: number;
    liquidity: number;
    endDate: string;
    oneWeekPriceChange?: number;
    exclusionReason?: string | null;
    details: ScalpingMarketDetails;
}

const LOCAL_API_URL = '/api/local';

export const getTopMarkets = async (limit = 20): Promise<ParsedMarket[]> => {
    try {
        const response = await axios.get<{ markets: ParsedMarket[] }>(`${LOCAL_API_URL}/markets`, {
            params: { limit },
        });

        return response.data.markets;
    } catch (error) {
        console.error('Error fetching markets:', error);
        return [];
    }
};

export const getScalpingMarkets = async (limit = 50): Promise<ScalpingMarket[]> => {
    try {
        const response = await axios.get<{ markets: ScalpingMarket[] }>(`${LOCAL_API_URL}/scalping-markets`, {
            params: { limit },
        });
        return response.data.markets;
    } catch (error) {
        console.error('Error fetching scalping markets:', error);
        return [];
    }
};

export const getOrderBook = async (tokenId: string): Promise<OrderBook | null> => {
    try {
        const response = await axios.get<OrderBook>(`${CLOB_API_URL}/book`, {
            params: {
                token_id: tokenId,
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching order book for token ${tokenId}:`, error);
        return null;
    }
};

export const calculateSpread = (book: OrderBook): { spread: number; bestBid: number; bestAsk: number } | null => {
    if (!book.bids.length || !book.asks.length) return null;

    // Polymarket CLOB API might return data sorted differently than expected (e.g. Price ASC/DESC).
    // We want Best Bid (Highest Price) and Best Ask (Lowest Price).

    // Sort Bids Descending (Highest to Lowest)
    const sortedBids = [...book.bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

    // Sort Asks Ascending (Lowest to Highest)
    const sortedAsks = [...book.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    const bestBid = parseFloat(sortedBids[0].price);
    const bestAsk = parseFloat(sortedAsks[0].price);
    const spread = bestAsk - bestBid;

    return { spread, bestBid, bestAsk };
};
