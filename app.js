class Game {
    constructor() {
        this.consonantBlends = [
            'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 
            'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 
            'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'
        ];
        
        this.twoLetterCombos = [
            // Most productive combinations
            'co', 're', 'in', 'de', 'pr', 'pa', 'ma', 'di', 'ex', 'un',
            // Highly productive
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

        // List of common plural endings to check
        this.pluralEndings = ['s', 'es', 'ers', 'ors', 'ies'];
        // List of exceptions that end in 's' but aren't plurals
        this.nonPluralExceptions = ['ss', 'ous', 'ics'];
        
        this.defaultState = {
            prefix: this.getDailyPrefix(),
            syllableCount: this.getDailySyllableCount(),
            foundWords: {},
            totalScore: 0,
            currentAchievement: "",
            possibleWords: 0,
            date: new Date().toLocaleDateString(),
            day: [
                "Sunday", "Monday", "Tuesday", "Wednesday", 
                "Thursday", "Friday", "Saturday"
            ][new Date().getDay()],
        };
        
        this.state = this.loadState() || this.defaultState;
        this.initializeGame();
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
        // Check for common exceptions first
        if (this.nonPluralExceptions.some(ending => word.endsWith(ending))) {
            return false;
        }
        
        // Check for common plural endings
        return this.pluralEndings.some(ending => {
            if (ending === 's') {
                // Special case for 's' ending to avoid catching words like 'discuss'
                return word.endsWith('s') && !word.endsWith('ss');
            }
            return word.endsWith(ending);
        });
    }

    async estimatePossibleWords() {
        try {
            const response = await fetch(
                `https://api.datamuse.com/words?sp=${this.state.prefix}*&md=sf&max=1000`
            );
            const data = await response.json();
            
            // Filter valid words using all our plural checks
            const validWords = data.filter(word => {
                const wordStr = word.word;
                return !this.isLikelyPlural(wordStr) &&
                       word.numSyllables === this.state.syllableCount &&
                       !word.tags?.includes('prop') &&
                       !word.tags?.includes('pl');
            });
            
            this.state.possibleWords = validWords.length;
            this.saveState();
        } catch (error) {
            console.error('Error estimating possible words:', error);
            this.state.possibleWords = 20; // Fallback value
        }
    }

    getSingularForm(word) {
        // Basic English plural rules
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

    async validateWord(word) {
        try {
            // Check for likely plurals before API call
            if (this.isLikelyPlural(word)) {
                return false;
            }

            // Check if this word is a plural of an already found word
            const singularForm = this.getSingularForm(word);
            if (singularForm && this.state.foundWords[singularForm]) {
                return false;
            }

            // Check if we already have the plural form of this word
            // Simple 's' plural
            const simplePlural = word + 's';
            if (this.state.foundWords[simplePlural]) {
                return false;
            }
            // 'es' plural
            const esPlural = word + 'es';
            if (this.state.foundWords[esPlural]) {
                return false;
            }
            // 'y' to 'ies' plural
            if (word.endsWith('y')) {
                const iesPlural = word.slice(0, -1) + 'ies';
                if (this.state.foundWords[iesPlural]) {
                    return false;
                }
            }

            const response = await fetch(
                `https://api.datamuse.com/words?sp=${word}&md=sf&max=1`
            );
            const data = await response.json();
            
            if (data.length === 0) return false;
            
            const wordData = data[0];
            const numSyllables = wordData.numSyllables || 0;
            
            // Double-check with Datamuse tags
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
            return false;
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

        // Check for plural forms
        const singularForm = this.getSingularForm(word);
        if (singularForm && this.state.foundWords[singularForm]) {
            return { success: false, message: "Plural form not allowed - you already found the singular!" };
        }
        // Check for existing plural of this word
        const simplePlural = word + 's';
        const esPlural = word + 'es';
        const iesPlural = word.endsWith('y') ? word.slice(0, -1) + 'ies' : null;
        
        if (this.state.foundWords[simplePlural] || 
            this.state.foundWords[esPlural] || 
            (iesPlural && this.state.foundWords[iesPlural])) {
            return { success: false, message: "Singular form not allowed - you already found the plural!" };
        }

        const isValid = await this.validateWord(word);
        if (!isValid) {
            return { success: false, message: `Not a valid ${this.state.syllableCount}-syllable word` };
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

    async getWordComplexity(word) {
        try {
            const response = await fetch(
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
            return 3;
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
            badge.style.display = "block";
            badge.classList.add("achievement-unlock");
            
            setTimeout(() => {
                badge.classList.remove("achievement-unlock");
            }, 500);
        }
    }

    updateUI() {
        document.getElementById("currentPrefix").textContent = 
            this.state.prefix.toUpperCase();
        document.getElementById("syllableCount").textContent = 
            `${this.state.syllableCount}-syllable words`;
        document.getElementById("dateDisplay").textContent = 
            `${this.state.day} - ${this.state.date}`;
        document.getElementById("totalScore").textContent = 
            this.state.totalScore;
        document.getElementById("wordsFound").textContent = 
            Object.keys(this.state.foundWords).length;
        document.getElementById("possibleWords").textContent = 
            this.state.possibleWords;

        const progress = (Object.keys(this.state.foundWords).length / this.state.possibleWords) * 100;
        document.getElementById("progressBar").style.width = 
            `${Math.min(progress, 100)}%`;

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
        document.getElementById("foundWords").innerHTML = wordsHTML;
    }

    updateInputPlaceholder() {
        const input = document.getElementById("wordInput");
        if (input) {
            input.placeholder = `Enter a ${this.state.syllableCount}-syllable word starting with "${this.state.prefix}"...`;
            input.value = "";
            input.removeAttribute('disabled');
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
