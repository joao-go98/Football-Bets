import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://ciotsunxwnnjmzcavfwn.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpb3RzdW54d25uam16Y2F2ZnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMjE2NjMsImV4cCI6MjA0NTY5NzY2M30.g7iHPPcwJksEfnyvZeiemLB-R5YOOCrKsC_1dd459RA');

// Constants and state management
const STATE = {
    balance: 0,
    bets: [],
    matches: [],
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    userId: '1'  // Add this for testing - replace with your actual user ID
};

class Match {
    constructor(data) {
        this.id = data.id;
        this.homeTeam = data.home_team;
        this.awayTeam = data.away_team;
        this.startTime = new Date(data.commence_time);
        this.status = 'pending';
        this.score = { home: 0, away: 0 };
        this.odds = this.processOdds(data);
        this.advancedOdds = this.generateAdvancedOdds();
        this.bookmaker = data.bookmakers[0]?.title || 'Unknown';
    }

    processOdds(data) {
        const markets = data.bookmakers[0]?.markets[0];
        if (!markets) return null;

        return {
            home: markets.outcomes.find(o => o.name === this.homeTeam)?.price,
            draw: markets.outcomes.find(o => o.name === 'Draw')?.price,
            away: markets.outcomes.find(o => o.name === this.awayTeam)?.price,
            btts_yes: +(Math.random() * (2.5 - 1.5) + 1.5).toFixed(2),
            btts_no: +(Math.random() * (2.5 - 1.5) + 1.5).toFixed(2),
            over2_5: +(Math.random() * (2.5 - 1.5) + 1.5).toFixed(2),
            under2_5: +(Math.random() * (2.5 - 1.5) + 1.5).toFixed(2),
        };
    }
    
    generateAdvancedOdds() {
        return {
            bothTeamsToScore: {
                yes: this.odds.btts_yes,
                no: this.odds.btts_no,
            },
            overUnder: {
                over2_5: this.odds.over2_5,
                under2_5: this.odds.under2_5,
            },
            correctScore: {
                '1-0': +(Math.random() * (12 - 7) + 7).toFixed(2),
                '2-0': +(Math.random() * (15 - 9) + 9).toFixed(2),
                '2-1': +(Math.random() * (11 - 8) + 8).toFixed(2),
                '0-0': +(Math.random() * (14 - 8) + 8).toFixed(2),
            },
            firstGoalscorer: {
                noGoal: +(Math.random() * (14 - 9) + 9).toFixed(2),
                homeTeam: +(Math.random() * (2.8 - 1.8) + 1.8).toFixed(2),
                awayTeam: +(Math.random() * (2.8 - 1.8) + 1.8).toFixed(2)
            }
        };
    }
}

class Bet {

    constructor(matchId, type, odds, amount) {
        this.id = Date.now();
        this.matchId = matchId;
        this.type = type;
        this.odds = odds;
        this.amount = amount;
        this.status = 'active';
        this.potentialWin = (odds * amount).toFixed(2);
    }

    settle(matchResult, matchDetails = {}) {
        if (this.status !== 'active') return;

        let won = false;
        switch (this.type) {
            case 'home':
                won = matchResult === 'home';
                break;
            case 'draw':
                won = matchResult === 'draw';
                break;
            case 'away':
                won = matchResult === 'away';
                break;
            case 'btts_yes':
                won = matchDetails.homeGoals > 0 && matchDetails.awayGoals > 0;
                break;
            case 'over2_5':
                won = (matchDetails.homeGoals + matchDetails.awayGoals) > 2.5;
                break;
            case 'under2_5':
                won = (matchDetails.homeGoals + matchDetails.awayGoals) < 2.5;
                break;
            case 'score_1-0':
                won = matchDetails.homeGoals === 1 && matchDetails.awayGoals === 0;
                break;
            case 'score_2-0':
                won = matchDetails.homeGoals === 2 && matchDetails.awayGoals === 0;
                break;
            case 'score_2-1':
                won = matchDetails.homeGoals === 2 && matchDetails.awayGoals === 1;
                break;
            case 'score_0-0':
                won = matchDetails.homeGoals === 0 && matchDetails.awayGoals === 0;
                break;
            case 'first_home':
                won = matchDetails.firstGoal === 'home';
                break;
            case 'first_away':
                won = matchDetails.firstGoal === 'away';
                break;
            case 'first_nogoal':
                won = matchDetails.firstGoal === 'none';
                break;
        }

        this.status = won ? 'won' : 'lost';
        return won ? parseFloat(this.potentialWin) : 0;
    }
}

// Fetch odds for Primeira Liga matches
async function fetchPrimeiraLigaOdds(apiKey) {
    const baseUrl = 'https://api.the-odds-api.com/v4/sports/soccer_portugal_primeira_liga/odds/';
    const params = new URLSearchParams({
        apiKey: apiKey,
        regions: 'eu',
        markets: 'h2h',
        oddsFormat: 'decimal',
        bookmakers: 'sport888'
    });

    try {
        const response = await fetch(`${baseUrl}?${params}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.map(match => new Match(match));
    } catch (error) {
        console.error('Error fetching odds:', error);
        throw error;
    }
}

// UI Updates
function updateBalance() {
    const balanceElement = document.querySelector('#balance');
    if (balanceElement) {
        balanceElement.textContent = STATE.balance.toFixed(2);
    }
}

function updateCompetitionInfo() {
    const infoContainer = document.querySelector('#competition-info');
    if (!infoContainer) return;

    const activeMatches = STATE.matches.filter(m => m.status === 'pending').length;
    const activeBets = STATE.bets.filter(b => b.status === 'active').length;

    infoContainer.innerHTML = `
        <div class="competition-stats">
            <div>Active Matches: ${activeMatches}</div>
            <div>Active Bets: ${activeBets}</div>
            <div>Total Bets: ${STATE.bets.length}</div>
        </div>
    `;
}

function displayMatches() {
    const matchesContainer = document.querySelector('#matches');
    if (!matchesContainer) return;

    const now = new Date();

    matchesContainer.innerHTML = STATE.matches
        .filter(match => match.status === 'pending')
        .map(match => {
            const hasExistingBet = STATE.bets.some(bet => 
                bet.matchId === match.id && 
                bet.status === 'active'
            );
            
            const matchStarted = now >= match.startTime;
            const disabled = hasExistingBet || matchStarted;
            
            let statusMessage = '';
            if (hasExistingBet) {
                statusMessage = '<div class="match-status bet-placed">Bet Already Placed</div>';
            } else if (matchStarted) {
                statusMessage = '<div class="match-status match-started">Match Started</div>';
            }

            return `
                <div class="match-card ${disabled ? 'disabled' : ''}" data-match-id="${match.id}">
                    <div class="match-header">
                        <h3>${match.homeTeam} vs ${match.awayTeam}</h3>
                        <span class="match-time ${matchStarted ? 'started' : ''}">${match.startTime.toLocaleString()}</span>
                        ${statusMessage}
                    </div>
                    <div class="betting-sections">
                        <!-- Winner Section -->
                        <div class="betting-section">
                            <h4>Match Winner</h4>
                            <div class="odds-container">
                                <button class="bet-button" data-match-id="${match.id}" data-type="home" data-odds="${match.odds.home}" ${disabled ? 'disabled' : ''}>
                                    Home (${match.odds.home})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="draw" data-odds="${match.odds.draw}" ${disabled ? 'disabled' : ''}>
                                    Draw (${match.odds.draw})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="away" data-odds="${match.odds.away}" ${disabled ? 'disabled' : ''}>
                                    Away (${match.odds.away})
                                </button>
                            </div>
                        </div>

                        <!-- New Betting Types Section -->
                        <div class="betting-section">
                            <h4>New Betting Types</h4>
                            <div class="odds-container">
                                <button class="bet-button" data-match-id="${match.id}" data-type="btts_yes" data-odds="${match.odds.btts_yes}" ${disabled ? 'disabled' : ''}>
                                    BTTS Yes (${match.odds.btts_yes})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="btts_no" data-odds="${match.odds.btts_no}" ${disabled ? 'disabled' : ''}>
                                    BTTS No (${match.odds.btts_no})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="over2_5" data-odds="${match.odds.over2_5}" ${disabled ? 'disabled' : ''}>
                                    Over 2.5 (${match.odds.over2_5})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="under2_5" data-odds="${match.odds.under2_5}" ${disabled ? 'disabled' : ''}>
                                    Under 2.5 (${match.odds.under2_5})
                                </button>
                            </div>
                        </div>

                        <!-- Goals Section -->
                        <div class="betting-section">
                            <h4>Goals</h4>
                            <div class="odds-container">
                                <button class="bet-button" data-match-id="${match.id}" data-type="btts_yes" data-odds="${match.advancedOdds.bothTeamsToScore.yes}" ${disabled ? 'disabled' : ''}>
                                    BTTS Yes (${match.advancedOdds.bothTeamsToScore.yes})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="over2_5" data-odds="${match.advancedOdds.overUnder.over2_5}" ${disabled ? 'disabled' : ''}>
                                    Over 2.5 (${match.advancedOdds.overUnder.over2_5})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="under2_5" data-odds="${match.advancedOdds.overUnder.under2_5}" ${disabled ? 'disabled' : ''}>
                                    Under 2.5 (${match.advancedOdds.overUnder.under2_5})
                                </button>
                            </div>
                        </div>

                        <!-- Correct Score Section -->
                        <div class="betting-section">
                            <h4>Correct Score</h4>
                            <div class="odds-container">
                                ${Object.entries(match.advancedOdds.correctScore).map(([score, odds]) => `
                                    <button class="bet-button" data-match-id="${match.id}" data-type="score_${score}" data-odds="${odds}" ${disabled ? 'disabled' : ''}>
                                        ${score} (${odds})
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- First Goal Section -->
                        <div class="betting-section">
                            <h4>First Goal</h4>
                            <div class="odds-container">
                                <button class="bet-button" data-match-id="${match.id}" data-type="first_home" data-odds="${match.advancedOdds.firstGoalscorer.homeTeam}" ${disabled ? 'disabled' : ''}>
                                    Home (${match.advancedOdds.firstGoalscorer.homeTeam})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="first_nogoal" data-odds="${match.advancedOdds.firstGoalscorer.noGoal}" ${disabled ? 'disabled' : ''}>
                                    No Goal (${match.advancedOdds.firstGoalscorer.noGoal})
                                </button>
                                <button class="bet-button" data-match-id="${match.id}" data-type="first_away" data-odds="${match.advancedOdds.firstGoalscorer.awayTeam}" ${disabled ? 'disabled' : ''}>
                                    Away (${match.advancedOdds.firstGoalscorer.awayTeam})
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="bookmaker-info">
                        Odds by: ${match.bookmaker}
                    </div>
                </div>
            `;
        }).join('');

    // Add event listeners
    attachMatchEventListeners();
}

// Add these styles to your existing styles
const additionalStyles = `
    .match-card.disabled {
        opacity: 0.7;
        position: relative;
    }

    .match-card.disabled .bet-button {
        cursor: not-allowed;
        background: #f0f0f0;
    }

    .match-status {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
    }

    .bet-placed {
        background: #ffd700;
        color: #333;
    }

    .match-started {
        background: #ff4444;
        color: white;
    }

    .match-time {
        color: #666;
    }

    .match-time.started {
        color: #ff4444;
    }

    .odds-container {
        position: relative;
    }

    .match-card.disabled::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.1);
        pointer-events: none;
    }

    .betting-sections {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .betting-section {
        background: #f8f8f8;
        padding: 1rem;
        border-radius: 6px;
    }

    .betting-section h4 {
        margin: 0 0 0.5rem 0;
        color: #444;
        font-size: 0.9rem;
    }

    .odds-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 0.5rem;
    }

    .bet-button {
        font-size: 0.9rem;
        padding: 0.5rem;
    }
`;


// Add validation helper functions
function canPlaceBet(matchId) {
    const match = STATE.matches.find(m => m.id === matchId);
    if (!match) return { allowed: false, reason: 'Match not found' };

    // Check if match has already started
    const now = new Date();
    if (now >= match.startTime) {
        return { allowed: false, reason: 'Match has already started' };
    }

    // Check if user already has a bet on this match
    const existingBet = STATE.bets.find(bet => 
        bet.matchId === matchId && 
        bet.status === 'active'
    );
    
    if (existingBet) {
        return { allowed: false, reason: 'You already have a bet on this match' };
    }

    return { allowed: true };
}

function displayBets() {
    const betsContainer = document.querySelector('#bets');
    if (!betsContainer) return;

    betsContainer.innerHTML = STATE.bets
        .map(bet => {
            const match = STATE.matches.find(m => m.id === bet.matchId);
            if (!match) return '';

            const statusClass = bet.status === 'active' ? 'active' : 
                              bet.status === 'won' ? 'won' : 'lost';

            return `
                <div class="bet-item ${statusClass}">
                    <div class="bet-details">
                        <span class="bet-teams">${match.homeTeam} vs ${match.awayTeam}</span>
                        <span class="bet-type">${bet.type.toUpperCase()}</span>
                        <span class="bet-odds">@${bet.odds}</span>
                        <span class="bet-amount">€${bet.amount}</span>
                    </div>
                    <div class="bet-status">
                        Status: ${bet.status.toUpperCase()}
                    </div>
                    <div class="potential-win">
                        ${bet.status === 'active' ? 
                            `Potential Win: €${bet.potentialWin}` : 
                            bet.status === 'won' ? 
                            `Won: €${bet.potentialWin}` : 
                            'Lost'}
                    </div>
                </div>
            `;
        }).join('');
}

// Event Handlers
function attachMatchEventListeners() {
    document.querySelectorAll('.bet-button').forEach(button => {
        button.addEventListener('click', handleBetClick);
    });

    document.querySelectorAll('.finish-match').forEach(button => {
        button.addEventListener('click', handleFinishMatch);
    });
}

function handleBetClick(event) {
    const button = event.currentTarget;
    const matchId = button.dataset.matchId;
    const betType = button.dataset.type;
    const odds = parseFloat(button.dataset.odds);

    const amount = prompt('Enter bet amount (€):');
    if (!amount) return;

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0 || betAmount > STATE.balance) {
        alert('Invalid bet amount or insufficient balance');
        return;
    }

    placeBet(matchId, betType, odds, betAmount);
}

// Auto-refresh functionality
let refreshTimer = null;

function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
        try {
            const apiKey = 'e6ca1c2332ce938b656b83450b2c2ee0'; // Replace with your actual API key
            const matches = await fetchPrimeiraLigaOdds(apiKey);
            STATE.matches = matches;
            displayMatches();
            updateCompetitionInfo();
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, STATE.refreshInterval);
}

// Styles
const styles = `
    .match-card {
        background: white;
        border: 1px solid #ddd;
        margin: 1rem 0;
        padding: 1rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .match-header {
        margin-bottom: 1rem;
    }

    .match-header h3 {
        margin: 0;
        color: #333;
    }

    .odds-container {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .bet-button {
        flex: 1;
        padding: 0.75rem 1rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        transition: background 0.2s;
    }

    .bet-button:hover {
        background: #e5e5e5;
    }

    .bet-item {
        background: white;
        border: 1px solid #ddd;
        padding: 1rem;
        margin: 0.5rem 0;
        border-radius: 4px;
        transition: transform 0.2s;
    }

    .bet-item:hover {
        transform: translateX(5px);
    }

    .bet-item.active {
        border-left: 4px solid #ffd700;
    }

    .bet-item.won {
        border-left: 4px solid #4caf50;
    }

    .bet-item.lost {
        border-left: 4px solid #f44336;
    }

    .competition-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 4px;
        margin-bottom: 1rem;
    }

    .match-controls {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .finish-match {
        padding: 0.5rem 1rem;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .finish-match:hover {
        background: #45a049;
    }

    .bookmaker-info {
        margin-top: 0.5rem;
        font-size: 0.8rem;
        color: #666;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .bet-item {
        animation: fadeIn 0.3s ease-in;
    }
`;

// Error handling helper
function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    alert(`An error occurred in ${context}. Please try again.`);
}

// Cleanup function
function cleanup() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initSimulator);

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// Updated Supabase functions
async function fetchBalanceFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('balance')
            .eq('id', STATE.userId)
            .single();

        if (error) {
            console.error('Error fetching balance:', error);
            return STATE.balance;
        }

        return data.balance;
    } catch (error) {
        console.error('Error:', error);
        return STATE.balance;
    }
}

async function updateBalanceInSupabase(newBalance) {
    try {
        const { error } = await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', STATE.userId);

        if (error) {
            console.error('Error updating balance:', error);
            STATE.balance = newBalance;
            updateBalance();
            return;
        }
        
        STATE.balance = newBalance;
        updateBalance();
    } catch (error) {
        console.error('Error:', error);
        STATE.balance = newBalance;
        updateBalance();
    }
}

// Add these new Supabase functions
async function saveBetToSupabase(bet) {
    try {
        const { error } = await supabase
            .from('bets')
            .insert([{
                id: bet.id,
                user_id: STATE.userId,
                match_id: bet.matchId,
                type: bet.type,
                odds: bet.odds,
                amount: bet.amount,
                status: bet.status,
                potential_win: bet.potentialWin
            }]);

        if (error) {
            console.error('Error saving bet:', error);
            throw error;
        }
    } catch (error) {
        console.error('Failed to save bet:', error);
        throw error;
    }
}

async function updateBetStatusInSupabase(bet) {
    try {
        const { error } = await supabase
            .from('bets')
            .update({
                status: bet.status
            })
            .eq('id', bet.id)
            .eq('user_id', STATE.userId);

        if (error) {
            console.error('Error updating bet status:', error);
            throw error;
        }
    } catch (error) {
        console.error('Failed to update bet status:', error);
        throw error;
    }
}

async function fetchBetsFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', STATE.userId);

        if (error) {
            console.error('Error fetching bets:', error);
            return [];
        }

        // Convert the data back to Bet objects
        return data.map(betData => {
            const bet = new Bet(
                betData.match_id,
                betData.type,
                betData.odds,
                betData.amount
            );
            bet.id = betData.id;
            bet.status = betData.status;
            return bet;
        });
    } catch (error) {
        console.error('Failed to fetch bets:', error);
        return [];
    }
}

// Modify the placeBet function to save to Supabase
async function placeBet(matchId, betType, odds, amount) {
    try {
        // Validation check
        const validation = canPlaceBet(matchId);
        if (!validation.allowed) {
            alert(validation.reason);
            return;
        }

        const newBalance = STATE.balance - amount;
        await updateBalanceInSupabase(newBalance);
        
        const bet = new Bet(matchId, betType, odds, amount);
        
        // Save bet to Supabase before adding to local state
        await saveBetToSupabase(bet);
        
        STATE.bets.push(bet);

        displayBets();
        displayMatches();
        updateCompetitionInfo();
        
        const match = STATE.matches.find(m => m.id === matchId);
        alert(`Bet placed successfully!\n\nMatch: ${match.homeTeam} vs ${match.awayTeam}\nType: ${betType}\nAmount: €${amount}\nPotential Win: €${bet.potentialWin}`);
    } catch (error) {
        handleError(error, 'placing bet');
    }
}

// Modify handleFinishMatch to update bet status in Supabase
async function handleFinishMatch(event) {
    const matchId = event.currentTarget.dataset.matchId;
    const match = STATE.matches.find(m => m.id === matchId);
    if (!match || match.status !== 'pending') return;

    try {
        const results = ['home', 'draw', 'away'];
        const result = results[Math.floor(Math.random() * results.length)];
        
        match.status = 'finished';
        
        const matchBets = STATE.bets.filter(b => b.matchId === matchId && b.status === 'active');
        let totalWinnings = 0;
        
        for (const bet of matchBets) {
            const winnings = bet.settle(result);
            totalWinnings += winnings;
            // Update bet status in Supabase
            await updateBetStatusInSupabase(bet);
        }

        const newBalance = STATE.balance + totalWinnings;
        await updateBalanceInSupabase(newBalance);

        displayMatches();
        displayBets();
        updateCompetitionInfo();

        alert(`Match finished! Result: ${result.toUpperCase()}\nTotal winnings: €${totalWinnings.toFixed(2)}`);
    } catch (error) {
        handleError(error, 'finishing match');
    }
}

// Modify initSimulator to load bets from Supabase
async function initSimulator() {
    try {
        // Add styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles + additionalStyles;
        document.head.appendChild(styleSheet);

        // Fetch initial balance
        const balance = await fetchBalanceFromSupabase();
        STATE.balance = balance;
        
        // Fetch saved bets
        STATE.bets = await fetchBetsFromSupabase();
        
        // Fetch matches
        const apiKey = 'e6ca1c2332ce938b656b83450b2c2ee0';
        STATE.matches = await fetchPrimeiraLigaOdds(apiKey);
        
        // Update UI
        displayMatches();
        displayBets();
        updateCompetitionInfo();
        updateBalance();
        
        startAutoRefresh();
    } catch (error) {
        console.error('Failed to initialize simulator:', error);
        document.querySelector('#matches').innerHTML = 
            '<p class="error">Failed to load matches. Please try again later.</p>';
    }
}

// At the top of your file, after creating the Supabase client
async function ensureAuthenticated() {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (!user) {
        // Sign in anonymously
        const { data, error: signInError } = await supabase.auth.signInWithOAuth({
            provider: 'anonymous'
        });
        
        if (signInError) {
            console.error('Auth error:', signInError);
            throw signInError;
        }
        
        return data.user;
    }
    
    return user;
}
