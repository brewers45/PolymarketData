import React, { useEffect, useState } from 'react';
import { getTopMarkets } from '../services/polymarket';
import type { MarketWithSpread } from '../services/polymarket';
import { MarketCard } from './MarketCard';

export const MarketList: React.FC = () => {
    const [markets, setMarkets] = useState<MarketWithSpread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const topMarkets = await getTopMarkets(20);

                if (isMounted) {
                    setMarkets(topMarkets);
                    setError(null);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError('Failed to fetch market data.');
                }
            }
        };

        fetchData().finally(() => {
            if (isMounted) {
                setLoading(false);
            }
        });

        const intervalId = setInterval(fetchData, 5000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading markets...</div>
            </div>
        );
    }

    if (error) {
        return <div style={{ color: 'var(--negative)', marginTop: '2rem' }}>{error}</div>;
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '1.5rem',
                paddingBottom: '2rem'
            }}>
                {markets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                ))}
            </div>
        </div>
    );
};
