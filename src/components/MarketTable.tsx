import React, { useEffect, useState } from 'react';
import { getTopMarkets } from '../services/polymarket';
import type { MarketWithSpread } from '../services/polymarket';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatPrice = (priceStr: string | undefined) => {
    if (!priceStr) return '-';
    const p = parseFloat(priceStr);
    return isNaN(p) ? '-' : (p * 100).toFixed(1) + '¢';
};

const formatSpread = (value: number | null) => {
    if (value === null) return '-';
    return value.toFixed(3);
};

export const MarketTable: React.FC = () => {
    const [markets, setMarkets] = useState<MarketWithSpread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const topMarkets = await getTopMarkets(10);

                if (isMounted) {
                    setMarkets(topMarkets);
                    setError(null);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) setError('Failed to fetch market data.');
            }
        };

        fetchData().finally(() => {
            if (isMounted) setLoading(false);
        });

        const intervalId = setInterval(fetchData, 5000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    if (loading) {
        return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading markets...</div>;
    }

    if (error) {
        return <div style={{ color: 'var(--negative)', marginTop: '2rem' }}>{error}</div>;
    }

    return (
        <div className="table-container glass-panel">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '1rem' }}>Market</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Yes</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>No</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Spread</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>24h Vol</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>7d Vol</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Fill Score</th>
                    </tr>
                </thead>
                <tbody>
                    {markets.map((market) => (
                        <tr key={market.id} className="table-row" onClick={() => window.open(`https://polymarket.com/market/${market.slug}`, '_blank')}>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {market.icon && <img src={market.icon} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{market.question}</span>
                                </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500, color: 'var(--positive)' }}>
                                {market.outcomePrices ? formatPrice(market.outcomePrices[0].toString()) : '-'}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500, color: 'var(--negative)' }}>
                                {market.outcomePrices ? formatPrice(market.outcomePrices[1].toString()) : '-'}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', color: market.spread && market.spread < 0.02 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {formatSpread(market.spread)}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                {formatCurrency(market.volume24hr || 0)}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                {formatCurrency(market.volume7d || 0)}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <span style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    backgroundColor: market.fillScore && market.fillScore > 70 ? 'rgba(0,196,140,0.1)' : (market.fillScore && market.fillScore > 40 ? 'rgba(255,171,0,0.1)' : 'rgba(255,86,48,0.1)'),
                                    color: market.fillScore && market.fillScore > 70 ? 'var(--positive)' : (market.fillScore && market.fillScore > 40 ? '#ffab00' : 'var(--negative)')
                                }}>
                                    {market.fillScore !== undefined ? market.fillScore.toFixed(1) : '-'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
