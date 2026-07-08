// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import './bulk-trader.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractStatus = 'pending' | 'open' | 'won' | 'lost';

interface TradeResult {
    id: string;
    contract_id?: number;
    transaction_id?: number;
    contract_type: string;
    buy_price: number;
    sell_price?: number;
    profit?: number;
    status: ContractStatus;
    entry_spot?: number;
    exit_spot?: number;
    barrier?: string;
    expiry_time?: number;
}

interface BulkConfig {
    symbol: string;
    contract_type: string;
    duration: number;
    duration_unit: string;
    stake: number;
    count: number;
    basis: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SYMBOLS = [
    { value: 'R_10',   label: 'Volatility 10 Index' },
    { value: 'R_25',   label: 'Volatility 25 Index' },
    { value: 'R_50',   label: 'Volatility 50 Index' },
    { value: 'R_75',   label: 'Volatility 75 Index' },
    { value: 'R_100',  label: 'Volatility 100 Index' },
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ100V',label: 'Volatility 100 (1s) Index' },
];

const CONTRACT_TYPES = [
    { value: 'CALL',       label: 'Rise',  group: 'risefall' },
    { value: 'PUT',        label: 'Fall',  group: 'risefall' },
    { value: 'DIGITEVEN',  label: 'Even',  group: 'evenodd'  },
    { value: 'DIGITODD',   label: 'Odd',   group: 'evenodd'  },
    { value: 'DIGITOVER',  label: 'Over',  group: 'overunder'},
    { value: 'DIGITUNDER', label: 'Under', group: 'overunder'},
];

const DURATION_UNITS = [
    { value: 't', label: 'Ticks'   },
    { value: 's', label: 'Seconds' },
    { value: 'm', label: 'Minutes' },
];

const fmtMoney = (v?: number, places = 2) =>
    v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(places);

const fmtTime = (ts?: number) =>
    ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconBolt = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
        <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2' />
    </svg>
);
const IconStop = () => (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
        <rect x='3' y='3' width='18' height='18' rx='2' />
    </svg>
);
const IconReset = () => (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <polyline points='1 4 1 10 7 10' />
        <path d='M3.51 15a9 9 0 1 0 .49-4.5' />
    </svg>
);

// ── Main component ────────────────────────────────────────────────────────────

const BulkTrader = observer(() => {
    const [config, setConfig] = useState<BulkConfig>({
        symbol:        'R_50',
        contract_type: 'CALL',
        duration:      5,
        duration_unit: 't',
        stake:         1,
        count:         5,
        basis:         'stake',
    });

    const [trades, setTrades]           = useState<TradeResult[]>([]);
    const [isRunning, setIsRunning]     = useState(false);
    const [errorMsg, setErrorMsg]       = useState('');
    const [currency, setCurrency]       = useState('USD');
    const subscriptions = useRef<any[]>([]);

    // Detect current account currency
    useEffect(() => {
        if (api_base?.account_info?.currency) {
            setCurrency(api_base.account_info.currency);
        }
    }, []);

    // Unsubscribe all on unmount
    useEffect(() => () => clearSubscriptions(), []);

    const clearSubscriptions = () => {
        subscriptions.current.forEach(s => { try { s.unsubscribe?.(); } catch {} });
        subscriptions.current = [];
    };

    const update = (fn: (prev: TradeResult[]) => TradeResult[]) =>
        setTrades(prev => fn(prev));

    const setTradeField = (id: string, fields: Partial<TradeResult>) =>
        update(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));

    // ── Subscribe to contract updates ────────────────────────────────────────
    const watchContract = (tradeId: string, contract_id: number) => {
        if (!api_base?.api) return;

        // Subscribe to proposal_open_contract for this contract_id
        api_base.api.send({ proposal_open_contract: 1, contract_id, subscribe: 1 });

        const sub = api_base.api.onMessage().subscribe(({ data }: any) => {
            if (data.msg_type !== 'proposal_open_contract') return;
            const c = data.proposal_open_contract;
            if (!c || c.contract_id !== contract_id) return;

            if (c.is_sold || c.is_expired) {
                const profit = parseFloat(c.sell_price) - parseFloat(c.buy_price);
                setTradeField(tradeId, {
                    status:    profit >= 0 ? 'won' : 'lost',
                    sell_price: parseFloat(c.sell_price),
                    profit,
                    exit_spot:  parseFloat(c.exit_tick || c.exit_spot || 0),
                    expiry_time: c.expiry_time,
                });
                try { sub.unsubscribe(); } catch {}
            } else {
                setTradeField(tradeId, {
                    status:     'open',
                    entry_spot: parseFloat(c.entry_tick || c.entry_spot || 0),
                    barrier:    c.barrier ?? undefined,
                });
            }
        });

        subscriptions.current.push(sub);
    };

    // ── Get proposal → fire N buys ───────────────────────────────────────────
    const launchTrades = async () => {
        if (!api_base?.api) {
            setErrorMsg('Not connected to Deriv API. Please log in first.');
            return;
        }

        setErrorMsg('');
        setIsRunning(true);
        clearSubscriptions();

        // Seed placeholder rows immediately
        const placeholders: TradeResult[] = Array.from({ length: config.count }, (_, i) => ({
            id:            `bulk-${Date.now()}-${i}`,
            contract_type: config.contract_type,
            buy_price:     config.stake,
            status:        'pending',
        }));
        setTrades(placeholders);

        try {
            // 1. Get a proposal for price/id
            const proposalReq: any = {
                proposal:      1,
                amount:        config.stake,
                basis:         config.basis,
                contract_type: config.contract_type,
                currency,
                duration:      config.duration,
                duration_unit: config.duration_unit,
                symbol:        config.symbol,
            };

            const propRes = await api_base.api.send(proposalReq);
            if (propRes.error) {
                throw new Error(propRes.error.message || 'Proposal failed');
            }
            const { id: proposalId, ask_price } = propRes.proposal;

            // 2. Fire N buy requests in parallel
            const buyPromises = placeholders.map(p =>
                api_base.api.send({ buy: proposalId, price: parseFloat(ask_price) })
                    .then((res: any) => ({ tradeId: p.id, res }))
                    .catch((err: any) => ({ tradeId: p.id, error: err }))
            );

            const results = await Promise.all(buyPromises);

            let allFailed = true;
            results.forEach(({ tradeId, res, error }: any) => {
                if (error || res?.error) {
                    const msg = error?.message || res?.error?.message || 'Buy failed';
                    setTradeField(tradeId, { status: 'lost', profit: 0 });
                    console.warn('[BulkTrader] buy error:', msg);
                } else {
                    allFailed = false;
                    const { buy } = res;
                    setTradeField(tradeId, {
                        contract_id:    buy.contract_id,
                        transaction_id: buy.transaction_id,
                        buy_price:      parseFloat(buy.buy_price),
                        status:         'open',
                    });
                    watchContract(tradeId, buy.contract_id);
                }
            });

            if (allFailed) setErrorMsg('All buy requests failed. Check your account balance and settings.');
        } catch (err: any) {
            setErrorMsg(err.message || 'An unexpected error occurred.');
            setTrades([]);
        } finally {
            setIsRunning(false);
        }
    };

    const reset = () => {
        clearSubscriptions();
        setTrades([]);
        setErrorMsg('');
    };

    // ── Derived stats ────────────────────────────────────────────────────────
    const settled  = trades.filter(t => t.status === 'won' || t.status === 'lost');
    const totalPnl = settled.reduce((s, t) => s + (t.profit ?? 0), 0);
    const wins     = settled.filter(t => t.status === 'won').length;
    const losses   = settled.filter(t => t.status === 'lost').length;
    const pending  = trades.filter(t => t.status === 'pending' || t.status === 'open').length;

    const labelFor = (v: string) => CONTRACT_TYPES.find(c => c.value === v)?.label ?? v;

    const set = (k: keyof BulkConfig) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        setConfig(prev => ({ ...prev, [k]: val }));
    };

    return (
        <div className='bulk-trader'>

            {/* ── Config panel ──────────────────────────────────────────────── */}
            <div className='bulk-trader__config'>
                <div className='bulk-trader__config-title'>
                    <IconBolt />
                    Bulk Trader
                </div>

                <div className='bulk-trader__fields'>
                    <label className='bulk-trader__field'>
                        <span>Symbol</span>
                        <select value={config.symbol} onChange={set('symbol')} disabled={isRunning}>
                            {SYMBOLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>

                    <label className='bulk-trader__field'>
                        <span>Contract Type</span>
                        <select value={config.contract_type} onChange={set('contract_type')} disabled={isRunning}>
                            {CONTRACT_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </label>

                    <label className='bulk-trader__field'>
                        <span>Duration</span>
                        <div className='bulk-trader__duration-row'>
                            <input
                                type='number' min={1} max={3600}
                                value={config.duration}
                                onChange={set('duration')}
                                disabled={isRunning}
                            />
                            <select value={config.duration_unit} onChange={set('duration_unit')} disabled={isRunning}>
                                {DURATION_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                        </div>
                    </label>

                    <label className='bulk-trader__field'>
                        <span>Stake ({currency})</span>
                        <input
                            type='number' min={0.35} max={50000} step={0.01}
                            value={config.stake}
                            onChange={set('stake')}
                            disabled={isRunning}
                        />
                    </label>

                    <label className='bulk-trader__field'>
                        <span>No. of Trades</span>
                        <input
                            type='number' min={2} max={50}
                            value={config.count}
                            onChange={set('count')}
                            disabled={isRunning}
                        />
                    </label>
                </div>

                <div className='bulk-trader__actions'>
                    <button
                        className='bulk-trader__btn bulk-trader__btn--launch'
                        onClick={launchTrades}
                        disabled={isRunning}
                    >
                        <IconBolt />
                        {isRunning ? 'Launching…' : `Launch ${config.count} Trades`}
                    </button>
                    <button
                        className='bulk-trader__btn bulk-trader__btn--reset'
                        onClick={reset}
                        disabled={isRunning}
                    >
                        <IconReset />
                        Reset
                    </button>
                </div>

                {errorMsg && <div className='bulk-trader__error'>{errorMsg}</div>}
            </div>

            {/* ── Summary bar ───────────────────────────────────────────────── */}
            {trades.length > 0 && (
                <div className='bulk-trader__summary'>
                    <div className='bulk-trader__stat'>
                        <span className='bulk-trader__stat-label'>Total P&L</span>
                        <span className={`bulk-trader__stat-value ${totalPnl >= 0 ? '--green' : '--red'}`}>
                            {fmtMoney(totalPnl)} {currency}
                        </span>
                    </div>
                    <div className='bulk-trader__stat'>
                        <span className='bulk-trader__stat-label'>Won</span>
                        <span className='bulk-trader__stat-value --green'>{wins}</span>
                    </div>
                    <div className='bulk-trader__stat'>
                        <span className='bulk-trader__stat-label'>Lost</span>
                        <span className='bulk-trader__stat-value --red'>{losses}</span>
                    </div>
                    <div className='bulk-trader__stat'>
                        <span className='bulk-trader__stat-label'>Pending</span>
                        <span className='bulk-trader__stat-value'>{pending}</span>
                    </div>
                    {settled.length > 0 && (
                        <div className='bulk-trader__stat'>
                            <span className='bulk-trader__stat-label'>Win Rate</span>
                            <span className='bulk-trader__stat-value'>
                                {((wins / settled.length) * 100).toFixed(0)}%
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* ── Results grid ──────────────────────────────────────────────── */}
            {trades.length > 0 && (
                <div className='bulk-trader__results'>
                    <div className='bulk-trader__results-header'>
                        <span>#</span>
                        <span>Type</span>
                        <span>Stake</span>
                        <span>Entry</span>
                        <span>Exit</span>
                        <span>Expiry</span>
                        <span>P&L</span>
                        <span>Status</span>
                    </div>
                    {trades.map((t, i) => (
                        <div
                            key={t.id}
                            className={`bulk-trader__result-row bulk-trader__result-row--${t.status}`}
                        >
                            <span className='bulk-trader__result-num'>{i + 1}</span>
                            <span>{labelFor(t.contract_type)}</span>
                            <span>{t.buy_price.toFixed(2)}</span>
                            <span>{t.entry_spot ?? '—'}</span>
                            <span>{t.exit_spot  ?? '—'}</span>
                            <span>{fmtTime(t.expiry_time)}</span>
                            <span className={t.profit != null ? (t.profit >= 0 ? '--green' : '--red') : ''}>
                                {t.profit != null ? `${fmtMoney(t.profit)} ${currency}` : '—'}
                            </span>
                            <span className={`bulk-trader__badge bulk-trader__badge--${t.status}`}>
                                {t.status === 'pending' ? '⏳ Pending'
                                    : t.status === 'open' ? '🔵 Open'
                                    : t.status === 'won'  ? '✅ Won'
                                    : '❌ Lost'}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {trades.length === 0 && (
                <div className='bulk-trader__empty'>
                    <IconBolt />
                    <p>Configure your settings and click <strong>Launch Trades</strong> to fire multiple contracts simultaneously.</p>
                </div>
            )}
        </div>
    );
});

export default BulkTrader;
