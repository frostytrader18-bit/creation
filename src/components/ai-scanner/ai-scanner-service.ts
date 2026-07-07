/**
 * AI Scanner Service
 *
 * Connects to the Deriv WebSocket API, fetches tick history for each
 * synthetic-digits market, and scores them for the strongest signal across
 * all contract types (Over/Under + Even/Odd).
 *
 * Priority: 1s volatilities are preferred when they show a meaningful edge
 * (score >= MIN_1S_SCORE).  Plain volatilities are the fallback.
 * Each volatility appears only once in the output.
 */
import DerivAPIBasic from '@deriv/deriv-api/dist/DerivAPIBasic';
import { getSocketURL } from '@/components/shared';

// ─── constants ────────────────────────────────────────────────────────────────

/**
 * Symbols ordered so 1s volatilities come first — the priority group is
 * evaluated before plain volatilities when breaking ties.
 */
export const SCAN_SYMBOLS_1S = [
    { symbol: '1HZ10V',  name: 'Volatility 10 (1s)',  is1s: true  },
    { symbol: '1HZ25V',  name: 'Volatility 25 (1s)',  is1s: true  },
    { symbol: '1HZ50V',  name: 'Volatility 50 (1s)',  is1s: true  },
    { symbol: '1HZ75V',  name: 'Volatility 75 (1s)',  is1s: true  },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s)', is1s: true  },
];

export const SCAN_SYMBOLS_PLAIN = [
    { symbol: 'R_10',    name: 'Volatility 10',       is1s: false },
    { symbol: 'R_25',    name: 'Volatility 25',       is1s: false },
    { symbol: 'R_50',    name: 'Volatility 50',       is1s: false },
    { symbol: 'R_75',    name: 'Volatility 75',       is1s: false },
    { symbol: 'R_100',   name: 'Volatility 100',      is1s: false },
];

/** All symbols: 1s first, then plain — preserves priority ordering. */
export const SCAN_SYMBOLS = [...SCAN_SYMBOLS_1S, ...SCAN_SYMBOLS_PLAIN];

/**
 * Minimum absolute-score edge for a 1s volatility to be considered "fit".
 * Below this threshold the 1s group is skipped and the best plain volatility
 * is returned instead.  ~1.5% edge above the theoretical baseline.
 */
const MIN_1S_SCORE = 0.015;

// ─── types ────────────────────────────────────────────────────────────────────

/** Which contract-type group the winning signal belongs to. */
export type ContractGroup = 'overunder' | 'evenodd';

export type ScanResult = {
    symbol: string;
    name: string;
    is1s: boolean;
    score: number;
    tradeType: string;      // e.g. "Over 2", "Under 7", "Even", "Odd"
    percentage: string;     // formatted win-rate string
    contractGroup: ContractGroup;
    digitCounts: number[];
    entryPoint?: number;    // Over/Under only — digit that most often precedes a win
};

export type ScanProgress = {
    symbol: string;
    index: number;
    total: number;
};

export type UnifiedScanOutput = {
    /** The single recommended outcome — 1s volatility when fit, plain otherwise. */
    best: ScanResult;
    /** All scanned results sorted by score (no duplicate volatilities). */
    all: ScanResult[];
    /** Whether the result came from the 1s group. */
    used1s: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getLastDigit(price: number | string): number {
    const str = price.toString();
    return parseInt(str[str.length - 1], 10);
}

function buildDigitCounts(digits: number[]): number[] {
    const counts = new Array(10).fill(0);
    digits.forEach(d => counts[d]++);
    return counts;
}

/**
 * Finds the entry-point digit — the last digit that, when observed, most often
 * precedes a winning tick for the given Over/Under trade type.
 */
function computeEntryPoint(digits: number[], tradeType: string): number {
    const m = tradeType.trim().match(/^(Over|Under)\s+(\d+)$/i);
    if (!m || digits.length < 2) return 0;

    const threshold = parseInt(m[2], 10);
    const isWin = m[1].toLowerCase() === 'over'
        ? (d: number) => d > threshold
        : (d: number) => d < threshold;

    const winCount   = new Array(10).fill(0);
    const totalCount = new Array(10).fill(0);

    for (let i = 0; i < digits.length - 1; i++) {
        const cur  = digits[i];
        const next = digits[i + 1];
        totalCount[cur]++;
        if (isWin(next)) winCount[cur]++;
    }

    let bestDigit = 0;
    let bestProb  = -1;
    let bestObs   = 0;

    for (let d = 0; d < 10; d++) {
        if (totalCount[d] === 0) continue;
        const prob = winCount[d] / totalCount[d];
        if (prob > bestProb || (prob === bestProb && totalCount[d] > bestObs)) {
            bestProb  = prob;
            bestDigit = d;
            bestObs   = totalCount[d];
        }
    }

    return bestDigit;
}

/**
 * Scores a digit stream for a single Over/Under variant.
 * Returns { score, tradeType, percentage } for the stronger side.
 */
function scoreOverUnder(
    digits: number[],
    overThreshold: number,
    underThreshold: number,
    baseline: number
): { score: number; tradeType: string; percentage: string } {
    const total     = digits.length;
    const overRate  = digits.filter(d => d > overThreshold).length  / total;
    const underRate = digits.filter(d => d < underThreshold).length / total;
    const overEdge  = overRate  - baseline;
    const underEdge = underRate - baseline;
    if (overEdge >= underEdge) {
        return {
            score:      Math.abs(overEdge),
            tradeType:  `Over ${overThreshold}`,
            percentage: `${(overRate * 100).toFixed(1)}%`,
        };
    }
    return {
        score:      Math.abs(underEdge),
        tradeType:  `Under ${underThreshold}`,
        percentage: `${(underRate * 100).toFixed(1)}%`,
    };
}

/**
 * Evaluates ALL contract types for a digit stream and returns the single
 * strongest signal, with its associated contract group.
 *
 * Candidates evaluated:
 *   - Over 1 / Under 8  (80% baseline)
 *   - Over 2 / Under 7  (70% baseline)
 *   - Over 3 / Under 6  (60% baseline)
 *   - Even / Odd        (50% baseline, contrarian)
 */
function scoreMarketUnified(digits: number[]): {
    score: number;
    tradeType: string;
    percentage: string;
    contractGroup: ContractGroup;
    entryPoint?: number;
} {
    const total = digits.length;
    if (total === 0) {
        return { score: 0, tradeType: '', percentage: '0%', contractGroup: 'overunder' };
    }

    // ── Over/Under candidates ────────────────────────────────────────────────
    const ou1 = scoreOverUnder(digits, 1, 8, 0.8);
    const ou2 = scoreOverUnder(digits, 2, 7, 0.7);
    const ou3 = scoreOverUnder(digits, 3, 6, 0.6);
    const bestOU = [ou1, ou2, ou3].reduce((a, b) => b.score > a.score ? b : a);

    // ── Even/Odd candidate ───────────────────────────────────────────────────
    // Score = deviation from the 50% baseline (same scale as OU scores).
    // Contrarian: bet against the dominant direction (mean-reversion pattern).
    const evenCount  = digits.filter(d => d % 2 === 0).length;
    const evenPct    = evenCount / total;
    const oddPct     = 1 - evenPct;
    const dominantPct = Math.max(evenPct, oddPct);
    const eoEdge     = dominantPct - 0.5;  // deviation from baseline — comparable to OU scores
    const eoTradeType = evenPct > oddPct ? 'Odd' : 'Even';  // bet against dominant direction

    // ── Pick strongest (both scores are now absolute deviations from baseline) ─
    const ouWins = bestOU.score >= eoEdge;
    if (ouWins) {
        const entryPoint = computeEntryPoint(digits, bestOU.tradeType);
        return { ...bestOU, contractGroup: 'overunder', entryPoint };
    }

    return {
        score:         eoEdge,
        tradeType:     eoTradeType,
        percentage:    `${(dominantPct * 100).toFixed(1)}%`,
        contractGroup: 'evenodd',
    };
}

// ─── WebSocket connection helper ──────────────────────────────────────────────

function openConnection(wsURL: string, timeoutMs = 15_000): Promise<{
    api: InstanceType<typeof DerivAPIBasic>;
    ws: WebSocket;
}> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const ws  = new WebSocket(wsURL);
        const api = new DerivAPIBasic({ connection: ws });

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                ws.close();
                reject(new Error('[AiScanner] WebSocket connection timed out'));
            }
        }, timeoutMs);

        ws.addEventListener('open', () => {
            if (!settled) { settled = true; clearTimeout(timer); resolve({ api, ws }); }
        });
        ws.addEventListener('error', (err) => {
            if (!settled) { settled = true; clearTimeout(timer); reject(err); }
        });
    });
}

// ─── main scan ────────────────────────────────────────────────────────────────

/**
 * Scans all synthetic-digit markets, scores each one across every contract
 * type simultaneously, and returns a single recommended outcome.
 *
 * Priority rule:
 *   1. Evaluate all 1s volatilities — if the best has score >= MIN_1S_SCORE,
 *      that is the recommendation.
 *   2. Otherwise fall back to the best plain volatility.
 *
 * The same volatility never appears more than once in the results list.
 */
export async function scanMarkets(
    tickCount: number,
    onProgress: (p: ScanProgress) => void,
    signal?: AbortSignal
): Promise<UnifiedScanOutput> {
    const wsURL = await getSocketURL();
    const { api, ws } = await openConnection(wsURL);

    const results1s:    ScanResult[] = [];
    const resultsPlain: ScanResult[] = [];

    try {
        for (let i = 0; i < SCAN_SYMBOLS.length; i++) {
            if (signal?.aborted) break;

            const { symbol, name, is1s } = SCAN_SYMBOLS[i];
            onProgress({ symbol, index: i, total: SCAN_SYMBOLS.length });

            try {
                const response = await (api as any).send({
                    ticks_history: symbol,
                    count: Math.min(tickCount, 5000),
                    end: 'latest',
                    style: 'ticks',
                });

                const prices: number[] = response?.history?.prices ?? [];
                const digits     = prices.map(p => getLastDigit(p));
                const digitCounts = buildDigitCounts(digits);
                const { score, tradeType, percentage, contractGroup, entryPoint } =
                    scoreMarketUnified(digits);

                const result: ScanResult = {
                    symbol, name, is1s, score, tradeType, percentage,
                    contractGroup, digitCounts, entryPoint,
                };

                if (is1s) results1s.push(result);
                else      resultsPlain.push(result);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(`[AiScanner] Failed to fetch ${symbol}:`, err);
            }
        }
    } finally {
        try { ws.close(); } catch { /* ignore */ }
    }

    // Sort each group by score descending
    results1s.sort((a, b) => b.score - a.score);
    resultsPlain.sort((a, b) => b.score - a.score);

    // Priority: use 1s if the best 1s has a meaningful edge
    const best1s    = results1s[0]    ?? null;
    const bestPlain = resultsPlain[0] ?? null;

    const used1s = !!(best1s && best1s.score >= MIN_1S_SCORE);
    const best   = used1s ? best1s! : (bestPlain ?? best1s!);

    // Combined list for display: 1s first, then plain (no duplicates — each
    // symbol appears exactly once since SCAN_SYMBOLS has no repeats)
    const all = [...results1s, ...resultsPlain];

    return { best, all, used1s };
}
