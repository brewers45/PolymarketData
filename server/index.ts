import express from 'express';
import cors from 'cors';
import axios from 'axios';

export const app = express();
const PORT = 5202;

app.use(cors());

// Only start the server if we're not running as a function
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    app.listen(PORT, () => {
        console.log(`Polymarket Data Server running on http://localhost:${PORT}`);
    });
}

const GAMMA_API_URL = 'https://gamma-api.polymarket.com';
const CLOB_API_URL = 'https://clob.polymarket.com';

interface Market {
    id: string;
    question: string;
    slug: string;
    volume24hr: number;
    volume1wk: number;
    outcomePrices: string; // JSON string from API
    clobTokenIds: string; // JSON string from API
    outcomes: string; // JSON string from API
    endDate: string;
    orderPriceMinTickSize: number;
    feesEnabled: boolean;
    liquidity: number;
    oneWeekPriceChange: number;
}

interface OrderBook {
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
}

// ============================================================================
// KEYWORD EXCLUSION LISTS - Markets with these terms are NOT suitable for MM
// ============================================================================

const JUMP_RISK_KEYWORDS = [
    // Geopolitical / Regime Change
    'regime', 'overthrow', 'coup', 'revolution', 'collapse', 'fall of',
    'supreme leader', 'khamenei', 'putin ', 'xi jinping', 'kim jong',
    'maduro', 'zelensky', 'netanyahu',

    // War / Conflict
    'war ', 'strike ', 'nuclear', 'invade', 'invasion', 'attack on',
    'bombing', 'missile', 'assassination', 'assassinate', 'ceasefire',
    'hostage', 'martial law', 'military action',

    // Government Decisions / Fed
    'fed ', 'federal reserve', 'fomc', 'rate cut', 'rate hike', 'basis points',
    'interest rate', 'powell', 'ecb ', 'central bank', 'monetary policy',
    'tariff', 'sanction',

    // Court / Legal
    'supreme court', 'ruling', 'verdict', 'indictment', 'convicted',
    'sentenced', 'court decision', 'lawsuit', 'appeal', 'pardon',

    // Elections / Politics
    'primary', 'nomination', 'nominee', 'endorsement', 'withdraw',
    'drop out', 'electoral', 'ballot', 'caucus', 'delegate',
    'impeach', 'resign', 'cabinet', 'presidential election', 'win the election',
    'election winner', 'elected president',

    // Specific Event Triggers (Date-based deadlines)
    'by midnight', 'by end of day', 'before january', 'before february',
    'before march', 'before april', 'before may', 'before june',
    'before july', 'before august', 'before september', 'before october',
    'before november', 'before december',
    'by january', 'by february', 'by march', 'by april', 'by may', 'by june',
    'by july', 'by august', 'by september', 'by october', 'by november', 'by december',
];

const STRUCTURAL_DECAY_KEYWORDS = [
    // Championship/Season Winners - These are long-shot decay markets
    'win the premier league', 'win the champions league', 'win the world series',
    'win the nba', 'win the nfl', 'win the stanley cup',
    'world cup winner', 'championship winner', 'league winner', 'tournament winner',
    'win the title', 'crowned champion', 'season winner', 'win the championship',
    'win the playoffs', 'make the playoffs', 'win the division',
    'win the conference', 'win the cup', 'win the series',

    // Super Bowl specific (very common on Polymarket)
    'win super bowl', 'super bowl 20', 'super bowl champion', 'super bowl winner',

    // Premier League specific (common pattern: "Will X win the... Premier League")
    'english premier league', 'premier league?', 'la liga', 'bundesliga', 'serie a',
    'ligue 1', 'eredivisie',

    // Sports Awards - Single determination events
    'ballon d\'or', 'mvp ', 'rookie of the year', 'cy young', 'heisman',
    'golden boot', 'golden glove', 'player of the year', 'coach of the year',
    'defensive player', 'most improved',

    // Long-dated / Lifetime Events
    'ever ', 'will ever', 'lifetime', 'career', 'all-time', 'hall of fame',

    // Season Long Predictions
    'finish first', 'finish last', 'relegated', 'promoted', 'qualify for',
];

// ============================================================================
// SCORING HELPER FUNCTIONS
// ============================================================================

/**
 * Detects markets that resolve at known decisive moments (announcements, deadlines)
 * Returns a multiplier: 1.0 = no penalty, 0.3 = 70% penalty
 */
const calculateEventResolutionPenalty = (question: string): number => {
    const lowerQ = question.toLowerCase();

    // Pattern: "by [date]" or "before [date]" suggests countdown to binary resolution
    const countdownPatterns = [
        /by (january|february|march|april|may|june|july|august|september|october|november|december)/,
        /before (january|february|march|april|may|june|july|august|september|october|november|december)/,
        /by end of/,
        /by midnight/,
        /by \d{1,2}\/\d{1,2}/,
        /by \d{4}/,  // "by 2026"
        /before \d{4}/, // "before 2026"
    ];

    const hasCountdown = countdownPatterns.some(p => p.test(lowerQ));

    // Pattern: Single-event determination questions
    const singleEventPatterns = [
        /will .+ announce/,
        /will .+ decision/,
        /will .+ rule on/,
        /will .+ vote on/,
        /will .+ result/,
        /will .+ confirm/,
        /will .+ approve/,
        /will .+ reject/,
        /will .+ pass/,
        /will .+ veto/,
    ];

    const isSingleEvent = singleEventPatterns.some(p => p.test(lowerQ));

    if (hasCountdown) return 0.3;  // 70% penalty
    if (isSingleEvent) return 0.5; // 50% penalty

    return 1.0; // No penalty
};

/**
 * Penalize markets with high weekly price volatility or jump-risk keywords
 * Returns 0 for complete exclusion, or multiplier for partial penalty
 */
const calculateJumpRiskPenalty = (
    question: string,
    oneWeekPriceChange: number
): number => {
    const lowerQ = question.toLowerCase();

    // Hard exclusion for high-risk keywords
    const hasJumpRiskKeyword = JUMP_RISK_KEYWORDS.some(kw => lowerQ.includes(kw));
    if (hasJumpRiskKeyword) return 0; // Complete exclusion

    // Penalize based on weekly volatility
    const absChange = Math.abs(oneWeekPriceChange || 0);

    if (absChange > 0.30) return 0.2;   // >30% weekly move = 80% penalty
    if (absChange > 0.20) return 0.5;   // >20% weekly move = 50% penalty
    if (absChange > 0.10) return 0.8;   // >10% weekly move = 20% penalty

    return 1.0; // Stable price = no penalty
};

/**
 * Detect markets trending monotonically toward 0 or 1 (structural decay)
 * Returns 0 for exclusion, or multiplier for penalty/bonus
 */
const calculateDriftPenalty = (
    currentPrice: number,
    oneWeekPriceChange: number
): number => {
    // Markets near edges that are still drifting in that direction = bad
    const isNearZero = currentPrice < 0.15;
    const isNearOne = currentPrice > 0.85;
    const isDriftingDown = oneWeekPriceChange < -0.05;
    const isDriftingUp = oneWeekPriceChange > 0.05;

    // Hard penalty for decay patterns (long-shots getting longer)
    if (isNearZero && isDriftingDown) return 0; // Decaying long-shot
    if (isNearOne && isDriftingUp) return 0;    // Converging certainty

    // Soft penalty for edge proximity
    if (isNearZero || isNearOne) return 0.5;

    // Prefer oscillation (small changes = mean-reverting behavior)
    if (Math.abs(oneWeekPriceChange) < 0.03) return 1.2; // 20% bonus for stability

    return 1.0;
};

/**
 * Replace raw volume with consistency metric
 * Punishes volume spikes, rewards consistent daily trading
 */
const calculateVolumeChurnScore = (
    volume24hr: number,
    volume7d: number
): number => {
    // Ideal: 24h volume is ~14% of 7d volume (consistent daily trading)
    const expectedDailyRatio = 1 / 7; // ~0.143
    const actualRatio = volume24hr / (volume7d || 1);

    // Penalize spikes: if 24h volume is > 30% of 7d, it's a news-driven spike
    if (actualRatio > 0.3) {
        return Math.max(20, 100 - (actualRatio - expectedDailyRatio) * 150);
    }

    // Reward consistency - closer to expected ratio is better
    const consistencyFactor = 1 - Math.abs(actualRatio - expectedDailyRatio) * 4;

    // Base score on absolute volume (log scale) + consistency modifier
    const baseScore = Math.min(100, Math.log10(volume24hr + 1) * 20);

    return baseScore * Math.max(0.5, Math.min(1.3, consistencyFactor));
};

/**
 * Calculate depth quality with symmetry and layer distribution
 * Rewards balanced books that have depth beyond just the top-of-book
 */
const calculateDepthQualityScore = (
    bidDepth1: number,
    askDepth1: number,
    bidDepth5: number,
    askDepth5: number
): number => {
    const totalDepth = bidDepth5 + askDepth5;

    // Hard exclusion for empty or severely one-sided books
    if (totalDepth === 0) return 0;
    if (bidDepth1 === 0 || askDepth1 === 0) return 0; // One-sided at TOB = very bad

    // Symmetry score (0-1, where 1 = perfect balance)
    const imbalance = Math.abs(bidDepth5 - askDepth5) / (bidDepth5 + askDepth5);
    const symmetryScore = 1 - imbalance;

    // Depth score (logarithmic, capped at 100)
    const depthScore = Math.min(100, Math.log10(totalDepth + 1) * 30);

    // Layer distribution bonus: reward depth beyond just the first tick
    // This indicates liquidity that replenishes after fills
    const beyondTOB = (bidDepth5 - bidDepth1) + (askDepth5 - askDepth1);
    const layerBonus = Math.min(1.3, 1 + Math.log10(beyondTOB + 2) * 0.1);

    return depthScore * symmetryScore * layerBonus;
};

// ============================================================================
// MAIN SCALPING SCORE CALCULATION
// ============================================================================

const calculateScalpingScore = (
    market: Market,
    spread: number,
    bidDepth1: number,
    askDepth1: number,
    bidDepth5: number,
    askDepth5: number
): { score: number; exclusionReason: string | null } => {
    const tickSize = market.orderPriceMinTickSize || 0.01;
    const spreadInTicks = spread / tickSize;
    const lowerQuestion = market.question.toLowerCase();

    // ============== HARD EXCLUSIONS ==============

    // 1. Fees check - fees eat into the edge
    if (market.feesEnabled) {
        return { score: 0, exclusionReason: 'Fees enabled' };
    }

    // 2. Wide spread cutoff - not tradable
    if (spreadInTicks > 5) {
        return { score: 0, exclusionReason: 'Spread too wide (>5 ticks)' };
    }

    // 3. Jump risk keywords - geopolitical, Fed, war, etc.
    const matchedJumpRisk = JUMP_RISK_KEYWORDS.find(kw => lowerQuestion.includes(kw));
    if (matchedJumpRisk) {
        return { score: 0, exclusionReason: `Jump risk keyword: "${matchedJumpRisk}"` };
    }

    // 4. Structural decay keywords - championships, awards, long-shots
    const matchedDecay = STRUCTURAL_DECAY_KEYWORDS.find(kw => lowerQuestion.includes(kw));
    if (matchedDecay) {
        return { score: 0, exclusionReason: `Structural decay keyword: "${matchedDecay}"` };
    }

    // 5. Parse price and apply edge exclusions (stricter than before)
    let midPrice = 0.5;
    try {
        midPrice = parseFloat(JSON.parse(market.outcomePrices)[0]);
    } catch (e) {
        midPrice = 0.5;
    }

    if (midPrice < 0.08 || midPrice > 0.92) {
        return { score: 0, exclusionReason: `Price at edge (${(midPrice * 100).toFixed(1)}%)` };
    }

    // 6. Time exclusions - need runway for market-making
    const hoursToRes = (new Date(market.endDate).getTime() - Date.now()) / 3600000;
    if (hoursToRes < 48) {
        return { score: 0, exclusionReason: 'Less than 48 hours to resolution' };
    }

    // 7. Empty book exclusions
    if (bidDepth1 === 0 || askDepth1 === 0) {
        return { score: 0, exclusionReason: 'One-sided or empty book' };
    }

    // 8. Apply drift penalty (decaying long-shots)
    const driftMultiplier = calculateDriftPenalty(midPrice, market.oneWeekPriceChange || 0);
    if (driftMultiplier === 0) {
        return { score: 0, exclusionReason: 'Directional drift toward edge' };
    }

    // 9. Apply jump risk penalty based on weekly volatility
    const jumpRiskMultiplier = calculateJumpRiskPenalty(market.question, market.oneWeekPriceChange || 0);
    if (jumpRiskMultiplier === 0) {
        return { score: 0, exclusionReason: 'High weekly volatility' };
    }

    // ============== COMPONENT SCORES ==============

    // 1. Spread Stability (25%)
    let spreadScore = 0;
    if (spreadInTicks <= 1.2) spreadScore = 100;
    else if (spreadInTicks <= 2.0) spreadScore = 80;
    else if (spreadInTicks <= 3.0) spreadScore = 50;
    else spreadScore = 20;

    // 2. Volume Churn (25%)
    const volumeChurnScore = calculateVolumeChurnScore(
        market.volume24hr,
        market.volume1wk
    );

    // 3. Mean Reversion / Oscillation (20%)
    // Reward prices closer to 0.5 (maximum uncertainty = oscillation)
    const distFrom50 = Math.abs(midPrice - 0.5);
    let reversionScore = Math.max(0, 100 - (distFrom50 * 180));

    // Apply drift multiplier (bonus for stable, penalty for drifting)
    reversionScore *= driftMultiplier;

    // 4. Depth Quality (15%)
    const depthScore = calculateDepthQualityScore(
        bidDepth1, askDepth1, bidDepth5, askDepth5
    );

    // 5. Time Safety (10%) - sweet spot is 1-8 weeks out
    let timeScore = 0;
    if (hoursToRes < 72) timeScore = 40;           // <3 days: risky
    else if (hoursToRes < 24 * 7) timeScore = 70;  // 3-7 days: okay
    else if (hoursToRes < 24 * 60) timeScore = 100; // 1-8 weeks: optimal
    else if (hoursToRes < 24 * 180) timeScore = 80; // 2-6 months: good
    else timeScore = 60;                            // >6 months: slightly penalize

    // 6. Event Resolution Penalty (multiplier on final score)
    const eventPenalty = calculateEventResolutionPenalty(market.question);

    // ============== COMPOSITE SCORE ==============

    const rawScore = (
        (spreadScore * 0.25) +
        (volumeChurnScore * 0.25) +
        (reversionScore * 0.20) +
        (depthScore * 0.15) +
        (timeScore * 0.10)
    );

    // Apply event resolution penalty and jump risk multiplier
    const finalScore = rawScore * eventPenalty * jumpRiskMultiplier;

    return {
        score: parseFloat(Math.max(0, finalScore).toFixed(2)),
        exclusionReason: null
    };
};

// ============================================================================
// API DATA FETCHING
// ============================================================================

const getTopMarkets = async (limit = 20) => {
    try {
        console.log(`Fetching top ${limit} markets...`);
        const response = await axios.get<Market[]>(`${GAMMA_API_URL}/markets`, {
            params: {
                limit,
                active: true,
                closed: false,
                order: 'volume24hr',
                ascending: false,
            },
        });

        // Enhance with Order Book Data
        const enhancedPromise = response.data.map(async (m) => {
            let bestBidDepth = 0;
            let bestAskDepth = 0;
            let spreadData = { spread: null as number | null, bestBid: null as number | null, bestAsk: null as number | null };
            let outcomePrices: string[] = [];
            let clobTokenIds: string[] = [];
            let outcomes: string[] = [];

            try {
                outcomePrices = JSON.parse(m.outcomePrices);
                clobTokenIds = JSON.parse(m.clobTokenIds);
                outcomes = JSON.parse(m.outcomes);
            } catch (e) {
                // Parsing error
            }

            if (clobTokenIds && clobTokenIds.length > 0) {
                try {
                    const tokenId = clobTokenIds[0];
                    const bookRes = await axios.get<OrderBook>(`${CLOB_API_URL}/book`, {
                        params: { token_id: tokenId }
                    });
                    const book = bookRes.data;

                    if (book.bids.length && book.asks.length) {
                        // Sort Bids Descending
                        const sortedBids = [...book.bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                        // Sort Asks Ascending
                        const sortedAsks = [...book.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

                        const bestBid = parseFloat(sortedBids[0].price);
                        const bestAsk = parseFloat(sortedAsks[0].price);

                        // Calculate depth at best price
                        bestBidDepth = sortedBids
                            .filter(b => parseFloat(b.price) === bestBid)
                            .reduce((acc, b) => acc + parseFloat(b.size), 0);

                        bestAskDepth = sortedAsks
                            .filter(a => parseFloat(a.price) === bestAsk)
                            .reduce((acc, a) => acc + parseFloat(a.size), 0);

                        spreadData = {
                            spread: bestAsk - bestBid,
                            bestBid,
                            bestAsk
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching book for market ${m.id}`);
                }
            }

            // Fill Likelihood Score Calculation
            const avgDepth = (bestBidDepth + bestAskDepth) / 2;
            const hourlyVol = m.volume24hr / 24;
            const spreadPenalty = 1 / (1 + (spreadData.spread || 0.1));
            const rawScore = (hourlyVol / (avgDepth + 1)) * spreadPenalty;
            const fillScore = Math.min(100, Math.max(0, Math.log10(rawScore + 1) * 50));

            return {
                id: m.id,
                question: m.question,
                slug: m.slug,
                volume24hr: m.volume24hr,
                volume7d: m.volume1wk,
                outcomes,
                outcomePrices: outcomePrices.map(p => parseFloat(p)),
                spread: spreadData.spread,
                bestBid: spreadData.bestBid,
                bestAsk: spreadData.bestAsk,
                bestBidDepth,
                bestAskDepth,
                fillScore: parseFloat(fillScore.toFixed(2)),
                details: {
                    clobTokenId: clobTokenIds[0]
                }
            };
        });

        return Promise.all(enhancedPromise);
    } catch (error) {
        console.error("Error in getTopMarkets:", error);
        return [];
    }
};

const getScalpingMarkets = async (limit = 50) => {
    try {
        console.log(`Fetching top ${limit} markets for scalping analysis...`);
        const response = await axios.get<Market[]>(`${GAMMA_API_URL}/markets`, {
            params: {
                limit: limit * 2, // Fetch more to filter down
                active: true,
                closed: false,
                order: 'volume24hr',
                ascending: false,
            },
        });

        const enhancedPromise = response.data.map(async (m) => {
            let processed = {
                id: m.id,
                question: m.question,
                slug: m.slug,
                volume24hr: m.volume24hr,
                volume7d: m.volume1wk,
                endDate: m.endDate,
                tickSize: m.orderPriceMinTickSize || 0.01,
                liquidity: m.liquidity || 0,
                oneWeekPriceChange: m.oneWeekPriceChange || 0,
                spread: null as number | null,
                bestBid: null as number | null,
                bestAsk: null as number | null,
                scalpingScore: 0,
                exclusionReason: null as string | null,
                details: {
                    spreadInTicks: 0,
                    depth1Tick: 0,
                    depth3Tick: 0,
                    depth5Tick: 0,
                    daysToRes: 0,
                    bidDepth1: 0,
                    askDepth1: 0,
                    bidDepth5: 0,
                    askDepth5: 0,
                }
            };

            // Days to resolution
            processed.details.daysToRes = parseFloat(((new Date(m.endDate).getTime() - Date.now()) / (86400000)).toFixed(1));

            let clobTokenIds: string[] = [];

            try {
                clobTokenIds = JSON.parse(m.clobTokenIds);
            } catch (e) { }

            if (clobTokenIds && clobTokenIds.length > 0) {
                try {
                    const tokenId = clobTokenIds[0];
                    const bookRes = await axios.get<OrderBook>(`${CLOB_API_URL}/book`, {
                        params: { token_id: tokenId }
                    });
                    const book = bookRes.data;

                    if (book.bids.length && book.asks.length) {
                        const sortedBids = [...book.bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                        const sortedAsks = [...book.asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

                        const bestBid = parseFloat(sortedBids[0].price);
                        const bestAsk = parseFloat(sortedAsks[0].price);
                        const spread = bestAsk - bestBid;

                        // Calculate Depths at various tick levels
                        const getDepth = (ticks: number, side: 'bids' | 'asks', basePrice: number) => {
                            const arr = side === 'bids' ? sortedBids : sortedAsks;
                            const tickSize = m.orderPriceMinTickSize || 0.01;
                            const limitPrice = side === 'bids' ? basePrice - (ticks * tickSize) : basePrice + (ticks * tickSize);

                            return arr.filter(item => {
                                const p = parseFloat(item.price);
                                return side === 'bids' ? p >= limitPrice : p <= limitPrice;
                            }).reduce((acc, item) => acc + parseFloat(item.size), 0);
                        };

                        const bidDepth1 = getDepth(1, 'bids', bestBid);
                        const askDepth1 = getDepth(1, 'asks', bestAsk);
                        const bidDepth3 = getDepth(3, 'bids', bestBid);
                        const askDepth3 = getDepth(3, 'asks', bestAsk);
                        const bidDepth5 = getDepth(5, 'bids', bestBid);
                        const askDepth5 = getDepth(5, 'asks', bestAsk);

                        const depth1 = bidDepth1 + askDepth1;
                        const depth3 = bidDepth3 + askDepth3;
                        const depth5 = bidDepth5 + askDepth5;

                        processed.spread = spread;
                        processed.bestBid = bestBid;
                        processed.bestAsk = bestAsk;
                        processed.details.spreadInTicks = spread / (m.orderPriceMinTickSize || 0.01);
                        processed.details.depth1Tick = depth1;
                        processed.details.depth3Tick = depth3;
                        processed.details.depth5Tick = depth5;
                        processed.details.bidDepth1 = bidDepth1;
                        processed.details.askDepth1 = askDepth1;
                        processed.details.bidDepth5 = bidDepth5;
                        processed.details.askDepth5 = askDepth5;

                        // Calculate Score with new logic
                        const scoreResult = calculateScalpingScore(
                            m, spread,
                            bidDepth1, askDepth1,
                            bidDepth5, askDepth5
                        );

                        processed.scalpingScore = scoreResult.score;
                        processed.exclusionReason = scoreResult.exclusionReason;
                    }
                } catch (err) {
                    // console.error(`Error fetching book for market ${m.id}`);
                }
            }
            return processed;
        });

        const results = await Promise.all(enhancedPromise);

        // Sort by Scalping Score Descending
        return results.sort((a, b) => b.scalpingScore - a.scalpingScore);
    } catch (error) {
        console.error("Error in getScalpingMarkets:", error);
        return [];
    }
};

// ============================================================================
// EXPRESS ENDPOINTS
// ============================================================================

app.get('/markets', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
        const markets = await getTopMarkets(limit);
        res.json({
            timestamp: new Date().toISOString(),
            count: markets.length,
            markets
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/scalping-markets', async (req, res) => {
    try {
        // Fetch more candidates to filter down
        const markets = await getScalpingMarkets(30);
        res.json({
            timestamp: new Date().toISOString(),
            count: markets.length,
            markets
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// End of file
