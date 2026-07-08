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
    CHART: 6,
    TRADING_VIEW: 7,
    COPY_TRADING: 8,
    ANALYSIS: 9,
    TUTORIAL: 10,
    BULK_TRADER: 11,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-free-bots',
    'id-d-circles',
    'id-analysis-tool',
    'id-market-analyzer',
    'id-charts',
    'id-trading-view',
    'id-copy-trading',
    'id-analysis',
    'id-tutorials',
    'id-bulk-trader',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
