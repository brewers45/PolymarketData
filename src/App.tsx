import { useState } from 'react';
import { MarketTable } from './components/MarketTable';
import { ScalpingCandidates } from './components/ScalpingCandidates';

function App() {
  const [activeTab, setActiveTab] = useState<'top' | 'scalping'>('top');

  return (
    <>
      <h1 style={{ marginBottom: '0.5rem' }}>Polymarket<span style={{ color: 'var(--text-secondary)', fontSize: '0.6em', marginLeft: '0.2rem' }}>Analytics</span></h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveTab('top')}
          style={{
            background: 'none',
            border: 'none',
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: activeTab === 'top' ? 'var(--primary-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'top' ? '2px solid var(--primary-color)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Top Markets (Volume)
        </button>
        <button
          onClick={() => setActiveTab('scalping')}
          style={{
            background: 'none',
            border: 'none',
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: activeTab === 'scalping' ? 'var(--primary-color)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'scalping' ? '2px solid var(--primary-color)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Scalping Candidates
        </button>
      </div>

      {activeTab === 'top' ? (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
            Top markets by 24h volume
          </p>
          <MarketTable />
        </>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
            Markets optimized for high-frequency scalping strategies (Tight spreads, High churn, Balanced books)
          </p>
          <ScalpingCandidates />
        </>
      )}
    </>
  );
}

export default App;
