import React from 'react';
import type { MarketWithSpread } from '../services/polymarket';

interface MarketCardProps {
    market: MarketWithSpread;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatSpread = (value: number | null) => {
    if (value === null) return '-';
    // Spread is price difference, usually small < 1
    return value.toFixed(3);
};

export const MarketCard: React.FC<MarketCardProps> = ({ market }) => {
    const formatPrice = (priceStr: string) => {
        const p = parseFloat(priceStr);
        return isNaN(p) ? '-' : (p * 100).toFixed(1) + '¢';
    };

    return (
        <div
            className="card glass-panel"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', cursor: 'pointer' }}
            onClick={() => window.open(`https://polymarket.com/market/${market.slug}`, '_blank')}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1, paddingRight: '1rem', textAlign: 'left' }}>
                    {market.question}
                </h3>
                {market.icon && <img src={market.icon} alt="icon" style={{ width: 40, height: 40, borderRadius: '50%' }} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>24h Vol</div>
                    <div style={{ color: 'var(--primary-color)', fontSize: '1.2rem', fontWeight: 600 }}>
                        {formatCurrency(market.volume24hr || 0)}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>7d Vol</div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600 }}>
                        {formatCurrency(market.volume1wk || 0)}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                {market.outcomes && market.outcomes.map((outcome, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderRadius: '6px'
                    }}>
                        <span style={{ fontWeight: 500, color: outcome === 'Yes' ? 'var(--positive)' : (outcome === 'No' ? 'var(--negative)' : 'var(--text-primary)') }}>
                            {outcome}
                        </span>
                        <span style={{ fontWeight: 'bold' }}>
                            {market.outcomePrices ? formatPrice(market.outcomePrices[idx].toString()) : '-'}
                        </span>
                    </div>
                ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', marginTop: '0.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Bid/Ask Spread (Yes)</span>
                    <span style={{
                        fontWeight: 'bold',
                        color: market.spread !== null && market.spread < 0.05 ? 'var(--positive)' : 'var(--text-secondary)'
                    }}>
                        {formatSpread(market.spread)}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Best Depth (Bid/Ask)</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {market.bestBidDepth?.toFixed(0) || 0} / {market.bestAskDepth?.toFixed(0) || 0}
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Fill Likelihood Score</span>
                    <span style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        backgroundColor: market.fillScore && market.fillScore > 70 ? 'rgba(0,196,140,0.1)' : (market.fillScore && market.fillScore > 40 ? 'rgba(255,171,0,0.1)' : 'rgba(255,86,48,0.1)'),
                        color: market.fillScore && market.fillScore > 70 ? 'var(--positive)' : (market.fillScore && market.fillScore > 40 ? '#ffab00' : 'var(--negative)')
                    }}>
                        {market.fillScore !== undefined ? market.fillScore.toFixed(1) : '-'}
                    </span>
                </div>
            </div>
        </div>
    );
};
