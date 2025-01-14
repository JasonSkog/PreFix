// Part 1 - Core Game Class and Base Methods
class Game {
    constructor() {
        this.consonantBlends = [
            'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 
            'fr', 'gl', 'gr', 'pl', 'sc', 'sk', 
            'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'
        ];
        
        this.twoLetterCombos = [
            'co', 're', 'in', 'de', 'pr', 'pa', 'ma', 'di', 'ex', 'un',
            'ac', 'ad', 'ap', 'ba', 'ca', 'ce', 'ci', 'en', 'fo', 'im',
            'me', 'mi', 'mo', 'pe', 'po', 'ra', 'sa', 'se', 'su', 'te'
        ];
        
        this.allPrefixes = [...new Set([...this.consonantBlends, ...this.twoLetterCombos])];
        
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
        this.API_MAX_RETRIES = 3;
        
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

   async fetchWithTimeout(url, options = {}, retries = 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (retries < this.API_MAX_RETRIES && 
                (error.name === 'AbortError' || error.message.includes('HTTP error'))) {
                console.log(`Retrying API call, attempt ${retries + 1}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
                return this.fetchWithTimeout(url, options, retries + 1);
            }
            throw error;
        }
    }

    async initializeGame() {
        try {
            await this.estimatePossibleWords();
            this.updateUI();
            this.setupEventListeners();
            this.updateInputPlaceholder();
            this.clearMessage();
        } catch (error) {
            console.error('Error initializing game:', error);
            this.showMessage('Error initializing game. Please refresh the page.', false);
        }
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

    async validateAndGetComplexity(word) {
        try {
            if (this.isLikelyPlural(word)) {
                return { valid: false, complexity: 0 };
            }

            await this.delayIfNeeded();
            const response = await this.fetchWithTimeout(
                `https://api.datamuse.com/words?sp=${word}&md=sf,f&max=1`
            );
            const data = await response.json();
            
            if (data.length === 0) return { valid: false, complexity: 0 };
            
            const wordData = data[0];
            const numSyllables = wordData.numSyllables || 0;
            const isPlural = wordData.tags?.includes('pl');
            
            const valid = (
                wordData.word === word &&
                numSyllables === this.state.syllableCount &&
                !wordData.tags?.includes('prop') &&
                word === word.toLowerCase() &&
                !isPlural
            );

            if (!valid) return { valid: false, complexity: 0 };

            const frequencyTag = wordData.tags?.find((tag) => tag.startsWith("f:"));
            let complexity = 3;
            if (frequencyTag) {
                const frequency = parseFloat(frequencyTag.split(":")[1]);
                if (frequency > 10) complexity = 1;
                else if (frequency > 1) complexity = 2;
            }

            return { valid: true, complexity };
        } catch (error) {
            console.error('API Error:', error);
            return { valid: false, complexity: 0 };
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
            console.error('Error loading game state:', e);
            return null;
        }
    }

    saveState() {
        try {
            localStorage.setItem("prefixGame", JSON.stringify(this.state));
        } catch (error) {
            console.error('Error saving game state:', error);
        }
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

        const { valid, complexity } = await this.validateAndGetComplexity(word);
        if (!valid) {
            return { 
                success: false, 
                message: `Not a valid ${this.state.syllableCount}-syllable word` 
            };
        }

        this.state.foundWords[word] = { 
            points: complexity, 
            category: this.getCategory(complexity) 
        };
        this.state.totalScore += complexity;
        this.saveState();
        this.updateUI();
        this.updateAchievements();

        return {
            success: true,
            message: `Found "${word}" - ${complexity} point${complexity !== 1 ? "s" : ""}!`,
        };
    }

    getCategory(points) {
        if (points === 1) return 'common';
        if (points === 2) return 'moderate';
        return 'challenging';
    }

    updateUI() {
        try {
            const elements = {
                prefix: document.getElementById("currentPrefix"),
                syllableCount: document.getElementById("syllableCount"),
                dateDisplay: document.getElementById("dateDisplay"),
                totalScore: document.getElementById("totalScore"),
                wordsFound: document.getElementById("wordsFound"),
                foundCount: document.getElementById("foundCount"),
                possibleWords: document.getElementById("possibleWords"),
                possiblePoints: document.getElementById("possiblePoints"),
                progressBar: document.getElementById("progressBar"),
                foundWordsContainer: document.getElementById("foundWords")
            };

            if (elements.prefix) elements.prefix.textContent = this.state.prefix.toUpperCase();
            if (elements.syllableCount) elements.syllableCount.textContent = `${this.state.syllableCount}-syllable words`;
            if (elements.dateDisplay) elements.dateDisplay.textContent = `${this.state.day} - ${this.state.date}`;
            if (elements.totalScore) elements.totalScore.textContent = this.state.totalScore;
            
            const foundWordsCount = Object.keys(this.state.foundWords).length;
            if (elements.wordsFound) elements.wordsFound.textContent = foundWordsCount;
            if (elements.foundCount) elements.foundCount.textContent = foundWordsCount;
            if (elements.possibleWords) elements.possibleWords.textContent = this.state.possibleWords;
            if (elements.possiblePoints) elements.possiblePoints.textContent = this.state.maxPossiblePoints || 0;

            const progress = (foundWordsCount / this.state.possibleWords) * 100;
            if (elements.progressBar) {
                elements.progressBar.style.width = `${Math.min(progress, 100)}%`;
                const progressContainer = elements.progressBar.closest('[role="progressbar"]');
                if (progressContainer) {
                    progressContainer.setAttribute('aria-valuenow', Math.round(progress));
                }
            }

            if (elements.foundWordsContainer) {
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
                elements.foundWordsContainer.innerHTML = wordsHTML;
            }
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    updateInputPlaceholder() {
        try {
            const input = document.getElementById("wordInput");
            if (input) {
                input.placeholder = `Enter a ${this.state.syllableCount}-syllable word starting with "${this.state.prefix}"`;
                input.value = "";
                input.focus();
            }
        } catch (error) {
            console.error('Error updating input placeholder:', error);
        }
    }

    updateAchievements() {
        try {
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
        } catch (error) {
            console.error('Error updating achievements:', error);
        }
    }

    showAchievementBadge(achievementName) {
        try {
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
        } catch (error) {
            console.error('Error showing achievement badge:', error);
        }
    }

    setupEventListeners() {
        try {
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
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    clearMessage() {
        try {
            const messageDiv = document.getElementById("message");
            if (messageDiv) {
                messageDiv.style.display = "none";
                messageDiv.textContent = "";
            }
        } catch (error) {
            console.error('Error clearing message:', error);
        }
    }

    showMessage(text, isSuccess) {
        try {
            const messageDiv = document.getElementById("message");
            if (messageDiv) {
                messageDiv.textContent = text;
                messageDiv.className = `message ${isSuccess ? "success" : "error"}`;
                messageDiv.style.display = "block";
                
                if (isSuccess) {
                    setTimeout(() => this.clearMessage(), 3000);
                }
            }
        } catch (error) {
            console.error('Error showing message:', error);
        }
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => new Game());
        });
    }
