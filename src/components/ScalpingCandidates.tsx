import React, { useEffect, useState } from 'react';
import { getScalpingMarkets } from '../services/polymarket';
import type { ScalpingMarket } from '../services/polymarket';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatPrice = (price?: number) => {
    if (price === undefined || price === null || isNaN(price)) return '-';
    // Prices are 0-1, so 50c
    return (price * 100).toFixed(1) + '¢';
};

const safeFixed = (val: number | undefined | null, digits: number) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return val.toFixed(digits);
};

export const ScalpingCandidates: React.FC = () => {
    const [markets, setMarkets] = useState<ScalpingMarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const data = await getScalpingMarkets(50);
                if (isMounted) {
                    setMarkets(data);
                    setError(null);
                }
            } catch (e) {
                if (isMounted) setError('Failed to fetch scalping candidates');
            }
        };

        fetchData().finally(() => {
            if (isMounted) setLoading(false);
        });

        // Refresh every 10s (less frequent than top markets maybe)
        const interval = setInterval(fetchData, 10000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        }
    }, []);

    if (loading) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Analyzing markets...</div>;
    if (error) return <div style={{ color: 'var(--negative)', marginTop: '2rem' }}>{error}</div>;

    return (
        <div className="table-container glass-panel">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '1rem' }}>Rank</th>
                        <th style={{ padding: '1rem' }}>Market</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Bid / Ask</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Spread (Ticks)</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Tick Size</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>24h Vol</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Liquidity</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Depth (±1/3/5)</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Days to Res</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {markets.map((m, idx) => (
                        <tr key={m.id} className="table-row" onClick={() => window.open(`https://polymarket.com/market/${m.slug}`, '_blank')}>
                            <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>#{idx + 1}</td>
                            <td style={{ padding: '1rem' }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.question}</div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                <span style={{ color: 'var(--positive)' }}>{formatPrice(m.bestBid || 0)}</span>
                                <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>/</span>
                                <span style={{ color: 'var(--negative)' }}>{formatPrice(m.bestAsk || 0)}</span>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <div style={{ fontWeight: 600, color: m.details?.spreadInTicks > 2 ? 'var(--negative)' : 'var(--positive)' }}>
                                    {safeFixed(m.details?.spreadInTicks, 1)}t
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                    {safeFixed((m.spread || 0) * 100, 2)}%
                                </div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', opacity: 0.7 }}>
                                {m.tickSize}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                {formatCurrency(m.volume24hr)}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                {formatCurrency(m.liquidity || 0)}
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem' }}>
                                <div title="Sum of sizes within 1 tick">{safeFixed(m.details?.depth1Tick, 0)}</div>
                                <div title="Sum of sizes within 3 ticks" style={{ opacity: 0.7 }}>{safeFixed(m.details?.depth3Tick, 0)}</div>
                                <div title="Sum of sizes within 5 ticks" style={{ opacity: 0.5 }}>{safeFixed(m.details?.depth5Tick, 0)}</div>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <span style={{ color: (m.details?.daysToRes || 0) < 2 ? 'var(--negative)' : 'inherit' }}>
                                    {safeFixed(m.details?.daysToRes, 1)}d
                                </span>
                            </td>
                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <span style={{
                                    padding: '0.3rem 0.6rem',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    fontSize: '1rem',
                                    backgroundColor: m.scalpingScore >= 70 ? 'rgba(0,196,140,0.2)' : (m.scalpingScore >= 40 ? 'rgba(255,171,0,0.2)' : 'rgba(255,86,48,0.2)'),
                                    color: m.scalpingScore >= 70 ? 'var(--positive)' : (m.scalpingScore >= 40 ? '#ffab00' : 'var(--negative)')
                                }}>
                                    {m.scalpingScore}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
