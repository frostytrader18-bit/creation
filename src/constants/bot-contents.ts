type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    FREE_BOTS: 2,
    D_CIRCLES: 3,
    ANALYSIS_TOOL: 4,
    MARKET_ANALYZER: 5,
    BULK_TRADER: 6,
    CHART: 7,
    TRADING_VIEW: 8,
    COPY_TRADING: 9,
    ANALYSIS: 10,
    TUTORIAL: 11,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-free-bots',
    'id-d-circles',
    'id-analysis-tool',
    'id-market-analyzer',
    'id-bulk-trader',
    'id-charts',
    'id-trading-view',
    'id-copy-trading',
    'id-analysis',
    'id-tutorials',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
