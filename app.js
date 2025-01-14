class Game {
    constructor() {
        this.consonantBlends = [
            'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 
            'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 
            'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'
        ];
        
        this.twoLetterCombos = [
            'co', 're', 'in', 'de', 'pr', 'pa', 'ma', 'di', 'ex', 'un',
            'ac', 'ad', 'ap', 'ba', 'ca', 'ce', 'ci', 'en', 'fo', 'im',
            'me', 'mi', 'mo', 'pe', 'po', 'ra', 'sa', 'se', 'su', 'te'
        ];
        
        this.allPrefixes = [...this.consonantBlends, ...this.twoLetterCombos];
        
        this.achievements = [
            { name: "Word Explorer", threshold: 0.25, className: "achievement-1" },
            { name: "Word Enthusiast", threshold: 0.50, className: "achievement-2" },
            { name: "Word Expert", threshold: 0.75, className: "achievement-3" },
            { name: "Word Champion", threshold: 1.0, className: "achievement-4" }
        ];

        this.pluralEndings = ['s', 'es', 'ers', 'ors', 'ies'];
        this.nonPluralExceptions = ['ss', 'ous', 'ics'];
        
        this.defaultState = {
            prefix: this.getDailyPrefix(),
            syllableCount: this.getDailySyllableCount(),
            foundWords: {},
            totalScore: 0,
            currentAchievement: "",
            possibleWords: 0,
            maxPossiblePoints: 0,
            date: new Date().toLocaleDateString(),
            day: [
                "Sunday", "Monday", "Tuesday", "Wednesday", 
                "Thursday", "Friday", "Saturday"
            ][new Date().getDay()],
        };
        
        this.state = this.loadState() || this.defaultState;
        this.lastApiCall = 0;
        this.API_DELAY = 100;
        this.API_TIMEOUT = 5000;
        
        this.initializeGame();
    }

    async delayIfNeeded() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastApiCall;
        if (timeSinceLastCall < this.API_DELAY) {
            await new Promise(resolve => setTimeout(resolve, this.API_DELAY - timeSinceLastCall));
        }
        this.lastApiCall = Date.now();
    }

    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async initializeGame() {
        await this.estimatePossibleWords();
        this.updateUI();
        this.setupEventListeners();
        this.updateInputPlaceholder();
        this.clearMessage();
    }

    getDailySyllableCount() {
        const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
        return (daysSinceEpoch % 3) + 1;
    }

    getDailyPrefix() {
        const today = new Date();
        const dateString = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
        const index = parseInt(dateString, 10) % this.allPrefixes.length;
        return this.allPrefixes[index];
    }

    isLikelyPlural(word) {
        if (this.nonPluralExceptions.some(ending => word.endsWith(ending))) {
            return false;
        }
        return this.pluralEndings.some(ending => {
            if (ending === 's') {
                return word.endsWith('s') && !word.endsWith('ss');
            }
            return word.endsWith(ending);
        });
    }

    async estimatePossibleWords() {
        try {
            await this.delayIfNeeded();
            const response = await this.fetchWithTimeout(
                `https://api.datamuse.com/words?sp=${this.state.prefix}*&md=sf&max=1000`
            );
            const data = await response.json();
            
            const validWords = data.filter(word => {
                const wordStr = word.word;
                return !this.isLikelyPlural(wordStr) &&
                       word.numSyllables === this.state.syllableCount &&
                       !word.tags?.includes('prop') &&
                       !word.tags?.includes('pl');
            });
            
            this.state.possibleWords = validWords.length;
            
            let maxPoints = 0;
            for (const word of validWords) {
                const frequency = word.tags?.find(tag => tag.startsWith('f:'));
                const points = frequency ? 
                    (parseFloat(frequency.split(':')[1]) > 10 ? 1 : 
                     parseFloat(frequency.split(':')[1]) > 1 ? 2 : 3) 
                    : 3;
                maxPoints += points;
            }
            this.state.maxPossiblePoints = maxPoints;
            this.saveState();
            
        } catch (error) {
            console.error('Error estimating possible words:', error);
            if (error.name === 'AbortError') {
                console.error('API request timed out');
            }
            this.state.possibleWords = 20;
            this.state.maxPossiblePoints = 60;
        }
    }

    async validateWord(word) {
        try {
            if (this.isLikelyPlural(word)) {
                return false;
            }

            const singularForm = this.getSingularForm(word);
            if (singularForm && this.state.foundWords[singularForm]) {
                return false;
            }

            const simplePlural = word + 's';
            const esPlural = word + 'es';
            const iesPlural = word.endsWith('y') ? word.slice(0, -1) + 'ies' : null;
            
            if (this.state.foundWords[simplePlural] || 
                this.state.foundWords[esPlural] || 
                (iesPlural && this.state.foundWords[iesPlural])) {
                return false;
            }

            await this.delayIfNeeded();
            const response = await this.fetchWithTimeout(
                `https://api.datamuse.com/words?sp=${word}&md=sf&max=1`
            );
            const data = await response.json();
            
            if (data.length === 0) return false;
            
            const wordData = data[0];
            const numSyllables = wordData.numSyllables || 0;
            const isPlural = wordData.tags?.includes('pl');
            
            return (
                wordData.word === word &&
                numSyllables === this.state.syllableCount &&
                !wordData.tags?.includes('prop') &&
                word === word.toLowerCase() &&
                !isPlural
            );
        } catch (error) {
            console.error('API Error:', error);
            if (error.name === 'AbortError') {
                this.showMessage('API request timed out. Please try again.', false);
            }
            return false;
        }
    }

    async getWordComplexity(word) {
        try {
            await this.delayIfNeeded();
            const response = await this.fetchWithTimeout(
                `https://api.datamuse.com/words?sp=${word}&md=f`
            );
            const data = await response.json();

            if (data.length > 0 && data[0].tags) {
                const frequencyTag = data[0].tags.find((tag) => tag.startsWith("f:"));
                if (frequencyTag) {
                    const frequency = parseFloat(frequencyTag.split(":")[1]);
                    if (frequency > 10) return 1;
                    if (frequency > 1) return 2;
                    return 3;
                }
            }
            return 3;
        } catch (error) {
            console.error('API Error:', error);
            if (error.name === 'AbortError') {
                console.error('API request timed out');
            }
            return 3;
        }
    }

    getSingularForm(word) {
        if (word.endsWith('ies')) {
            return word.slice(0, -3) + 'y';
        } else if (word.endsWith('es')) {
            return word.slice(0, -2);
        } else if (word.endsWith('s')) {
            return word.slice(0, -1);
        }
        return null;
    }

    loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem("prefixGame"));
            return saved && saved.date === new Date().toLocaleDateString()
                ? saved
                : null;
        } catch (e) {
            return null;
        }
    }

    saveState() {
        localStorage.setItem("prefixGame", JSON.stringify(this.state));
    }
    async submitWord(word) {
        word = word.toLowerCase().trim();
        
        if (!word) return { success: false, message: "Please enter a word" };
        if (!word.startsWith(this.state.prefix.toLowerCase())) {
            return {
                success: false,
                message: `Word must start with "${this.state.prefix}"`,
            };
        }
        if (this.state.foundWords[word]) {
            return { success: false, message: "Word already found!" };
        }

        const singularForm = this.getSingularForm(word);
        if (singularForm && this.state.foundWords[singularForm]) {
            return { 
                success: false, 
                message: "Plural form not allowed - you already found the singular!" 
            };
        }

        const simplePlural = word + 's';
        const esPlural = word + 'es';
        const iesPlural = word.endsWith('y') ? word.slice(0, -1) + 'ies' : null;
        
        if (this.state.foundWords[simplePlural] || 
            this.state.foundWords[esPlural] || 
            (iesPlural && this.state.foundWords[iesPlural])) {
            return { 
                success: false, 
                message: "Singular form not allowed - you already found the plural!" 
            };
        }

        const isValid = await this.validateWord(word);
        if (!isValid) {
            return { 
                success: false, 
                message: `Not a valid ${this.state.syllableCount}-syllable word` 
            };
        }

        const points = await this.getWordComplexity(word);
        
        this.state.foundWords[word] = { 
            points, 
            category: this.getCategory(points) 
        };
        this.state.totalScore += points;
        this.saveState();
        this.updateUI();
        this.updateAchievements();

        return {
            success: true,
            message: `Found "${word}" - ${points} point${points !== 1 ? "s" : ""}!`,
        };
    }

    getCategory(points) {
        if (points === 1) return 'common';
        if (points === 2) return 'moderate';
        return 'challenging';
    }

    updateUI() {
        // Update prefix and syllable count
        const prefix = document.getElementById("currentPrefix");
        if (prefix) prefix.textContent = this.state.prefix.toUpperCase();
        
        const syllableCount = document.getElementById("syllableCount");
        if (syllableCount) syllableCount.textContent = `${this.state.syllableCount}-syllable words`;
        
        // Update date display
        const dateDisplay = document.getElementById("dateDisplay");
        if (dateDisplay) dateDisplay.textContent = `${this.state.day} - ${this.state.date}`;
        
        // Update scores and counts
        const totalScore = document.getElementById("totalScore");
        if (totalScore) totalScore.textContent = this.state.totalScore;
        
        const wordsFound = document.getElementById("wordsFound");
        if (wordsFound) wordsFound.textContent = Object.keys(this.state.foundWords).length;
        
        const foundCount = document.getElementById("foundCount");
        if (foundCount) foundCount.textContent = Object.keys(this.state.foundWords).length;
        
        const possibleWords = document.getElementById("possibleWords");
        if (possibleWords) possibleWords.textContent = this.state.possibleWords;
        
        const possiblePoints = document.getElementById("possiblePoints");
        if (possiblePoints) possiblePoints.textContent = this.state.maxPossiblePoints || 0;
        
        // Update progress bar
        const progress = (Object.keys(this.state.foundWords).length / this.state.possibleWords) * 100;
        const progressBar = document.getElementById("progressBar");
        if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 100)}%`;
            const progressContainer = progressBar.closest('[role="progressbar"]');
            if (progressContainer) {
                progressContainer.setAttribute('aria-valuenow', Math.round(progress));
            }
        }
        
        // Update found words list
        const foundWordsContainer = document.getElementById("foundWords");
        if (foundWordsContainer) {
            const wordsHTML = Object.entries(this.state.foundWords)
                .map(([word, data]) => `
                    <div class="word-chip">
                        ${word}
                        <span class="point-badge ${data.category}">
                            ${data.points}pt${data.points !== 1 ? "s" : ""}
                        </span>
                    </div>
                `)
                .join("");
            foundWordsContainer.innerHTML = wordsHTML;
        }
    }

    updateInputPlaceholder() {
        const input = document.getElementById("wordInput");
        if (input) {
            input.placeholder = `Enter a ${this.state.syllableCount}-syllable word starting with "${this.state.prefix}"`;
            input.value = "";
            input.focus();
        }
    }

    updateAchievements() {
        const progress = Object.keys(this.state.foundWords).length / this.state.possibleWords;
        let newAchievement = "";
        
        for (let i = this.achievements.length - 1; i >= 0; i--) {
            if (progress >= this.achievements[i].threshold) {
                newAchievement = this.achievements[i].name;
                break;
            }
        }
        
        if (newAchievement && newAchievement !== this.state.currentAchievement) {
            this.state.currentAchievement = newAchievement;
            this.saveState();
            this.showAchievementBadge(newAchievement);
            this.showMessage(`Achievement Unlocked: ${newAchievement}!`, true);
        }
    }

    showAchievementBadge(achievementName) {
        const badge = document.getElementById("currentAchievement");
        const achievement = this.achievements.find(a => a.name === achievementName);
        
        if (badge && achievement) {
            badge.textContent = achievementName;
            badge.className = `achievement-badge ${achievement.className}`;
            badge.hidden = false;
            badge.classList.add("achievement-unlock");
            
            setTimeout(() => {
                badge.classList.remove("achievement-unlock");
            }, 500);
        }
    }

    setupEventListeners() {
        const form = document.getElementById("wordForm");
        const input = document.getElementById("wordInput");
        
        if (!form || !input) {
            console.error("Required DOM elements not found");
            return;
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const word = input.value.trim();
            
            this.clearMessage();
            
            if (!word) {
                this.showMessage("Please enter a word", false);
                return;
            }

            const result = await this.submitWord(word);
            this.showMessage(result.message, result.success);

            if (result.success) {
                input.value = "";
            }
            
            input.focus();
        });
    }

    clearMessage() {
        const messageDiv = document.getElementById("message");
        if (messageDiv) {
            messageDiv.style.display = "none";
            messageDiv.textContent = "";
        }
    }

    showMessage(text, isSuccess) {
        const messageDiv = document.getElementById("message");
        if (messageDiv) {
            messageDiv.textContent = text;
            messageDiv.className = `message ${isSuccess ? "success" : "error"}`;
            messageDiv.style.display = "block";
            
            if (isSuccess) {
                setTimeout(() => this.clearMessage(), 3000);
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => new Game());
