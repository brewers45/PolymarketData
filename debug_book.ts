
import axios from 'axios';

// We need to use the real URL here since we are running in node
const CLOB_API_URL = 'https://clob.polymarket.com';
const GAMMA_API_URL = 'https://gamma-api.polymarket.com';

const run = async () => {
    try {
        // 1. Get Top Market to get a token ID
        console.log("Fetching markets...");
        const mkts = await axios.get(`${GAMMA_API_URL}/markets?limit=1&active=true&closed=false&order=volume24hr&ascending=false`);
        const market = mkts.data[0];
        const clobIds = JSON.parse(market.clobTokenIds);
        const outcomePrices = JSON.parse(market.outcomePrices);

        console.log("Market:", market.question);
        console.log("Outcomes:", market.outcomes);
        console.log("Outcome Prices:", outcomePrices);
        console.log("CLOB Token IDs:", clobIds);

        const tokenId = clobIds[0];
        console.log("Fetching book for Token ID:", tokenId);

        const book = await axios.get(`${CLOB_API_URL}/book?token_id=${tokenId}`);
        const data = book.data;

        console.log("Bids (first 3):", data.bids.slice(0, 3));
        console.log("Asks (first 3):", data.asks.slice(0, 3));

        if (data.bids.length && data.asks.length) {
            const bestBid = parseFloat(data.bids[0].price);
            const bestAsk = parseFloat(data.asks[0].price);
            console.log("Best Bid:", bestBid);
            console.log("Best Ask:", bestAsk);
            console.log("Spread:", bestAsk - bestBid);
        }

    } catch (e) {
        console.error(e);
    }
};

run();
