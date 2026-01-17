import axios from 'axios';

// Interfaces matching your data structure
export interface MarketData {
    id: string;
    question: string;
    slug: string;
    volume24hr: number;
    volume7d: number;
    outcomes: string[];
    outcomePrices: number[];
    spread: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    details: {
        clobTokenId: string;
    };
}

export class PolymarketClient {
    private readonly GAMMA_API_URL = 'https://gamma-api.polymarket.com';
    private readonly CLOB_API_URL = 'https://clob.polymarket.com';

    /**
     * Fetches top active markets sorted by 24h volume.
     * @param limit Number of markets to fetch (default: 20)
     */
    async getTopMarkets(limit: number = 20): Promise<MarketData[]> {
        try {
            console.log(`[PolymarketClient] Fetching top ${limit} markets...`);
            const response = await axios.get(`${this.GAMMA_API_URL}/markets`, {
                params: {
                    limit,
                    active: true,
                    closed: false,
                    order: 'volume24hr',
                    ascending: false,
                },
            });

            // Process markets in parallel
            const markets = await Promise.all(response.data.map(async (m: any) => {
                return this.processMarket(m);
            }));

            return markets;
        } catch (error) {
            console.error('[PolymarketClient] Error fetching markets:', error);
            return [];
        }
    }

    private async processMarket(m: any): Promise<MarketData> {
        let spreadData = { spread: null as number | null, bestBid: null as number | null, bestAsk: null as number | null };
        let outcomePrices: number[] = [];
        let clobTokenIds: string[] = [];
        let outcomes: string[] = [];

        try {
            outcomePrices = (JSON.parse(m.outcomePrices) as string[]).map(p => parseFloat(p));
            clobTokenIds = JSON.parse(m.clobTokenIds);
            outcomes = JSON.parse(m.outcomes);
        } catch (e) {
            console.warn(`[PolymarketClient] Failed to parse JSON for market ${m.id}`);
        }

        if (clobTokenIds && clobTokenIds.length > 0) {
            try {
                const book = await this.fetchOrderBook(clobTokenIds[0]);
                if (book) {
                    spreadData = this.calculateSpread(book);
                }
            } catch (err) {
                // Ignore individual book fetch errors
            }
        }

        return {
            id: m.id,
            question: m.question,
            slug: m.slug,
            volume24hr: m.volume24hr,
            volume7d: m.volume1wk,
            outcomes,
            outcomePrices,
            spread: spreadData.spread,
            bestBid: spreadData.bestBid,
            bestAsk: spreadData.bestAsk,
            details: {
                clobTokenId: clobTokenIds[0] || ''
            }
        };
    }

    private async fetchOrderBook(tokenId: string): Promise<any | null> {
        try {
            const res = await axios.get(`${this.CLOB_API_URL}/book`, {
                params: { token_id: tokenId }
            });
            return res.data;
        } catch (e) {
            return null;
        }
    }

    private calculateSpread(book: any) {
        if (!book.bids.length || !book.asks.length) {
            return { spread: null, bestBid: null, bestAsk: null };
        }

        // Sort Bids Descending (Highest to Lowest)
        const sortedBids = [...book.bids].sort((a: any, b: any) => parseFloat(b.price) - parseFloat(a.price));
        // Sort Asks Ascending (Lowest to Highest)
        const sortedAsks = [...book.asks].sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));

        const bestBid = parseFloat(sortedBids[0].price);
        const bestAsk = parseFloat(sortedAsks[0].price);

        return {
            spread: bestAsk - bestBid,
            bestBid,
            bestAsk
        };
    }
}
