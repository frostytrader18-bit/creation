import React from 'react';
import { LabelPairedCircleStarCaptionBoldIcon } from '@deriv/quill-icons/LabelPaired';
import { Localize } from '@deriv-com/translations';
import './free-bots.scss';

const FREE_BOTS = [
    {
        id: 1,
        name: 'Martingale Bot',
        description: 'Doubles the stake after each loss to recover previous losses with a single win.',
        category: 'Strategy',
        difficulty: 'Intermediate',
    },
    {
        id: 2,
        name: 'D\'Alembert Bot',
        description: 'Increases stake by one unit after a loss and decreases by one unit after a win.',
        category: 'Strategy',
        difficulty: 'Beginner',
    },
    {
        id: 3,
        name: 'Oscars Grind Bot',
        description: 'A conservative positive progression system aimed at grinding out small profits.',
        category: 'Strategy',
        difficulty: 'Beginner',
    },
    {
        id: 4,
        name: 'RSI Bot',
        description: 'Uses the Relative Strength Index indicator to detect overbought and oversold conditions.',
        category: 'Indicator',
        difficulty: 'Advanced',
    },
    {
        id: 5,
        name: 'Volatility Catcher',
        description: 'Targets high-volatility windows to place trades with momentum.',
        category: 'Indicator',
        difficulty: 'Intermediate',
    },
    {
        id: 6,
        name: 'Even/Odd Alternator',
        description: 'Alternates between Even and Odd predictions based on recent digit history.',
        category: 'Digits',
        difficulty: 'Beginner',
    },
];

const DIFFICULTY_COLORS: Record<string, string> = {
    Beginner: '#10b981',
    Intermediate: '#f59e0b',
    Advanced: '#ef4444',
};

const FreeBots = () => {
    return (
        <div className='free-bots'>
            <div className='free-bots__header'>
                <h2 className='free-bots__title'>
                    <Localize i18n_default_text='Free Bots' />
                </h2>
                <p className='free-bots__subtitle'>
                    <Localize i18n_default_text='Download and import ready-made trading bots into your Bot Builder.' />
                </p>
            </div>
            <div className='free-bots__grid'>
                {FREE_BOTS.map(bot => (
                    <div key={bot.id} className='free-bots__card'>
                        <div className='free-bots__card-icon'>
                            <LabelPairedCircleStarCaptionBoldIcon height='32px' width='32px' fill='#f7c53b' />
                        </div>
                        <div className='free-bots__card-body'>
                            <div className='free-bots__card-top'>
                                <span className='free-bots__card-category'>{bot.category}</span>
                                <span
                                    className='free-bots__card-difficulty'
                                    style={{ color: DIFFICULTY_COLORS[bot.difficulty] }}
                                >
                                    {bot.difficulty}
                                </span>
                            </div>
                            <h3 className='free-bots__card-name'>{bot.name}</h3>
                            <p className='free-bots__card-description'>{bot.description}</p>
                        </div>
                        <button className='free-bots__card-btn'>
                            <Localize i18n_default_text='Import to Builder' />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FreeBots;
