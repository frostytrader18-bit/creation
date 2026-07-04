import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import './copy-trading.scss';

// ── icons ────────────────────────────────────────────────────────────────────

const IconPlay = () => (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='currentColor'>
        <polygon points='5 3 19 12 5 21 5 3' />
    </svg>
);
const IconStop = () => (
    <svg width='13' height='13' viewBox='0 0 24 24' fill='currentColor'>
        <rect x='3' y='3' width='18' height='18' rx='2' />
    </svg>
);
const IconClose = () => (
    <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
        <line x1='18' y1='6' x2='6' y2='18' />
        <line x1='6' y1='6' x2='18' y2='18' />
    </svg>
);
const IconKey = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <circle cx='7.5' cy='15.5' r='5.5' />
        <path d='M21 2l-9.6 9.6' />
        <path d='M15.5 7.5l3 3' />
    </svg>
);
const IconUsers = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
);
const IconDemoReal = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
        <rect x='2' y='3' width='20' height='14' rx='2' />
        <path d='M8 21h8M12 17v4' />
        <path d='M9 10l2 2 4-4' />
    </svg>
);
const IconTag = () => (
    <svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' opacity='0.35'>
        <path d='M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z' />
        <line x1='7' y1='7' x2='7.01' y2='7' />
    </svg>
);
const IconSun = () => (
    <svg width='52' height='52' viewBox='0 0 24 24' fill='none' stroke='#FF6B2C' strokeWidth='1.5' opacity='0.7'>
        <circle cx='12' cy='12' r='5' />
        <line x1='12' y1='1' x2='12' y2='3' />
        <line x1='12' y1='21' x2='12' y2='23' />
        <line x1='4.22' y1='4.22' x2='5.64' y2='5.64' />
        <line x1='18.36' y1='18.36' x2='19.78' y2='19.78' />
        <line x1='1' y1='12' x2='3' y2='12' />
        <line x1='21' y1='12' x2='23' y2='12' />
        <line x1='4.22' y1='19.78' x2='5.64' y2='18.36' />
        <line x1='18.36' y1='5.64' x2='19.78' y2='4.22' />
    </svg>
);

// ── helpers ───────────────────────────────────────────────────────────────────

const maskToken = (t: string) => (t.length > 10 ? `${t.slice(0, 4)}...${t.slice(-4)}` : t);
const fmtBalance = (b: number, currency: string) => `${b.toFixed(2)} ${currency}`;
const fmtDate = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── main page ─────────────────────────────────────────────────────────────────

const CopyTrading = observer(() => {
    const store = useStore();
    const ct = store.copy_trading;
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [showLeaderInput, setShowLeaderInput] = useState(false);

    const handleFollowerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') ct.addFollower();
    };
    const handleLeaderKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') ct.connectLeader();
    };

    const connectedFollowers = ct.followers.filter(f => f.status === 'connected');
    const canStart =
        ct.leader_status === 'connected' &&
        connectedFollowers.length > 0 &&
        !ct.is_running;
    const canStop = ct.is_running;

    return (
        <div className='ct2'>
            {/* ── hero ─────────────────────────────────────────────────────── */}
            <div className='ct2__hero'>
                <div className='ct2__hero-content'>
                    <div className='ct2__live-badge'>
                        <span className='ct2__live-dot' />
                        {localize('LIVE COPY TRADING')}
                    </div>

                    <h1 className='ct2__headline'>
                        {localize('Your account, your control.')}<br />
                        {localize('Maximize Gains with')}{' '}
                        <span className='ct2__headline--accent'>{localize('CopyTrading')}</span>
                    </h1>

                    <p className='ct2__subheadline'>
                        {localize(
                            'Mirror trades from your master account to multiple client accounts in real time — automatically and instantly.'
                        )}
                    </p>

                    <div className='ct2__stats'>
                        <div className='ct2__stat'>
                            <span className='ct2__stat-value'>{ct.followers.length}</span>
                            <span className='ct2__stat-label'>{localize('LINKED ACCOUNTS')}</span>
                        </div>
                        <div className='ct2__stat-sep' />
                        <div className='ct2__stat'>
                            <span className={`ct2__stat-status ct2__stat-status--${ct.is_running ? 'running' : 'idle'}`}>
                                <span className='ct2__stat-status-dot' />
                                {ct.is_running ? localize('Running') : localize('Idle')}
                            </span>
                            <span className='ct2__stat-label'>{localize('COPY STATUS')}</span>
                        </div>
                        <div className='ct2__stat-sep' />
                        <div className='ct2__stat'>
                            <span className='ct2__stat-value'>{ct.trade_log.length}</span>
                            <span className='ct2__stat-label'>{localize('TRADES REPLICATED')}</span>
                        </div>
                    </div>
                </div>

                <div className='ct2__hero-deco'>
                    <div className='ct2__deco-ring'>
                        <IconSun />
                    </div>
                </div>
            </div>

            {/* ── body ─────────────────────────────────────────────────────── */}
            <div className='ct2__body'>

                {/* ── left column ─────────────────────────────────────────── */}
                <div className='ct2__left'>

                    {/* Demo → Real card */}
                    <div className='ct2__card'>
                        <div className='ct2__card-icon ct2__card-icon--blue'>
                            <IconDemoReal />
                        </div>
                        <div className='ct2__card-heading'>{localize('Demo → Real')}</div>
                        <p className='ct2__card-desc'>
                            {localize(
                                'Mirror trades from your demo account to your real account automatically.'
                            )}
                        </p>

                        {/* Leader token (collapsible) */}
                        {!showLeaderInput && ct.leader_status !== 'connected' ? (
                            <button
                                className='ct2__link-btn'
                                onClick={() => setShowLeaderInput(true)}
                            >
                                {localize('+ Set leader (demo) token')}
                            </button>
                        ) : (
                            <div className='ct2__leader-section'>
                                <div className='ct2__token-row'>
                                    <input
                                        className='ct2__token-input'
                                        type='text'
                                        placeholder={localize('Leader API token (demo account)')}
                                        value={ct.leader_token}
                                        onChange={e => ct.setLeaderToken(e.target.value)}
                                        onKeyDown={handleLeaderKeyDown}
                                        disabled={ct.is_running || ct.leader_status === 'connected'}
                                    />
                                    {ct.leader_status !== 'connected' && (
                                        <button
                                            className='ct2__add-btn'
                                            onClick={() => ct.connectLeader()}
                                            disabled={!ct.leader_token || ct.leader_status === 'connecting' || ct.is_running}
                                        >
                                            {ct.leader_status === 'connecting'
                                                ? localize('…')
                                                : localize('Connect')}
                                        </button>
                                    )}
                                </div>
                                {ct.leader_account && (
                                    <div className='ct2__leader-chip'>
                                        <span className={`ct2__acct-badge ct2__acct-badge--${ct.leader_account.is_virtual ? 'demo' : 'real'}`}>
                                            {ct.leader_account.is_virtual ? localize('Demo') : localize('Real')}
                                        </span>
                                        <span className='ct2__acct-id'>{ct.leader_account.loginid}</span>
                                        <span className='ct2__acct-bal'>
                                            {fmtBalance(ct.leader_account.balance, ct.leader_account.currency)}
                                        </span>
                                    </div>
                                )}
                                {ct.leader_error && (
                                    <span className='ct2__error-text'>{ct.leader_error}</span>
                                )}
                            </div>
                        )}

                        <button
                            className='ct2__primary-btn'
                            onClick={() => ct.startCopying()}
                            disabled={!canStart}
                        >
                            <IconPlay />
                            {localize('Start Demo → Real')}
                        </button>
                    </div>

                    {/* Token Replicator card */}
                    <div className='ct2__card'>
                        <div className='ct2__card-icon ct2__card-icon--orange'>
                            <IconKey />
                        </div>
                        <div className='ct2__card-heading'>{localize('Token Replicator')}</div>
                        <p className='ct2__card-desc'>
                            {localize(
                                'Add client API tokens. When you trade, all linked accounts receive the same trade instantly.'
                            )}
                        </p>

                        {/* Stake multiplier */}
                        <div className='ct2__multiplier-row'>
                            <label className='ct2__multiplier-label' htmlFor='ct2-mult'>
                                {localize('Stake ×')}
                            </label>
                            <input
                                id='ct2-mult'
                                className='ct2__multiplier-input'
                                type='number'
                                min='0.01'
                                max='100'
                                step='0.1'
                                value={ct.stake_multiplier}
                                onChange={e => ct.setStakeMultiplier(parseFloat(e.target.value) || 1)}
                                disabled={ct.is_running}
                            />
                            <span className='ct2__multiplier-hint'>
                                {localize('(1.0 = same stake, 0.5 = half, 2.0 = double)')}
                            </span>
                        </div>

                        <div className='ct2__token-row'>
                            <input
                                className='ct2__token-input'
                                type='text'
                                placeholder={localize('Paste client API token…')}
                                value={ct.new_follower_token}
                                onChange={e => ct.setNewFollowerToken(e.target.value)}
                                onKeyDown={handleFollowerKeyDown}
                                disabled={ct.is_running}
                            />
                            <button
                                className='ct2__add-btn'
                                onClick={() => ct.addFollower()}
                                disabled={!ct.new_follower_token || ct.is_running}
                            >
                                {localize('Add')}
                            </button>
                            <label className='ct2__sync-label'>
                                <input
                                    type='checkbox'
                                    checked={syncEnabled}
                                    onChange={e => setSyncEnabled(e.target.checked)}
                                    disabled={ct.is_running}
                                />
                                {localize('Sync')}
                            </label>
                        </div>

                        {ct.is_running ? (
                            <button
                                className='ct2__primary-btn ct2__primary-btn--stop'
                                onClick={() => ct.stopCopying()}
                            >
                                <IconStop />
                                {localize('Stop Copying')}
                            </button>
                        ) : (
                            <button
                                className='ct2__primary-btn'
                                onClick={() => ct.startCopying()}
                                disabled={!canStart}
                            >
                                <IconPlay />
                                {localize('Start Copy Trading')}
                            </button>
                        )}

                        {!canStart && !ct.is_running && (
                            <span className='ct2__hint-text'>
                                {ct.leader_status !== 'connected'
                                    ? localize('Connect the leader (demo) account first.')
                                    : connectedFollowers.length === 0
                                        ? localize('Add at least one client token above.')
                                        : ''}
                            </span>
                        )}
                    </div>

                    {/* Trade log (compact, inside left column) */}
                    {ct.trade_log.length > 0 && (
                        <div className='ct2__card'>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div className='ct2__card-heading' style={{ marginBottom: 0 }}>
                                    {localize('Trade Log')}
                                    <span className='ct2__log-count'>({ct.trade_log.length})</span>
                                </div>
                                <button className='ct2__clear-btn' onClick={() => ct.clearLog()}>
                                    {localize('Clear')}
                                </button>
                            </div>
                            <div className='ct2__log'>
                                {ct.trade_log.map(entry => (
                                    <div key={entry.id} className='ct2__log-row'>
                                        <span className='ct2__log-time'>{fmtDate(entry.timestamp)}</span>
                                        <span className='ct2__log-trade'>
                                            <strong>{entry.symbol}</strong>
                                            {' · '}{entry.contract_type}
                                            {' · '}{entry.duration}{entry.duration_unit}
                                        </span>
                                        <span className='ct2__log-stake'>
                                            {entry.stake.toFixed(2)} {entry.currency}
                                        </span>
                                        <div className='ct2__log-chips'>
                                            {entry.results.map(r => (
                                                <span
                                                    key={r.follower_loginid}
                                                    className={`ct2__log-chip ct2__log-chip--${r.error ? 'err' : 'ok'}`}
                                                    title={r.error ?? `Contract #${r.contract_id}`}
                                                >
                                                    {r.error ? '✕' : '✓'} {r.follower_loginid}
                                                    {r.buy_price !== undefined && ` (${r.buy_price.toFixed(2)})`}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── right column ─────────────────────────────────────────── */}
                <div className='ct2__right'>
                    <div className='ct2__card ct2__card--tall'>
                        <div className='ct2__replicated-header'>
                            <div className='ct2__card-icon ct2__card-icon--grey'>
                                <IconUsers />
                            </div>
                            <div className='ct2__card-heading'>{localize('Replicated Accounts')}</div>
                        </div>
                        <div className='ct2__card-divider' />

                        {ct.followers.length === 0 ? (
                            <div className='ct2__empty-state'>
                                <IconTag />
                                <p>
                                    {localize(
                                        'No accounts linked yet. Add a client API token or create accounts in settings.'
                                    )}
                                </p>
                            </div>
                        ) : (
                            <div className='ct2__account-list'>
                                {ct.followers.map(f => (
                                    <div key={f.token} className='ct2__account-row'>
                                        <div className='ct2__account-row-left'>
                                            <span className={`ct2__acct-status-dot ct2__acct-status-dot--${f.status}`} />
                                            <div className='ct2__account-row-info'>
                                                <span className='ct2__account-row-id'>
                                                    {f.account?.loginid ?? maskToken(f.token)}
                                                </span>
                                                {f.account && (
                                                    <span className='ct2__account-row-bal'>
                                                        {fmtBalance(f.account.balance, f.account.currency)}
                                                        <span className={`ct2__acct-badge ct2__acct-badge--${f.account.is_virtual ? 'demo' : 'real'} ct2__acct-badge--sm`}>
                                                            {f.account.is_virtual ? localize('Demo') : localize('Real')}
                                                        </span>
                                                    </span>
                                                )}
                                                {f.status === 'pending' && (
                                                    <span className='ct2__account-row-status'>{localize('Connecting…')}</span>
                                                )}
                                                {f.status === 'error' && (
                                                    <span className='ct2__account-row-status ct2__account-row-status--err'>
                                                        {f.error || localize('Error')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!ct.is_running && (
                                            <button
                                                className='ct2__remove-btn'
                                                title={localize('Remove')}
                                                onClick={() => ct.removeFollower(f.token)}
                                            >
                                                <IconClose />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default CopyTrading;
