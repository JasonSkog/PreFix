class VirtualKeyboard {
    constructor(inputElement) {
        this.input = inputElement;
        this.createKeyboard();
        this.currentValue = '';
    }

    createKeyboard() {
        const keyboard = document.createElement('div');
        keyboard.className = 'virtual-keyboard';

        const layout = [
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
            ['z', 'x', 'c', 'v', 'b', 'n', 'm']
        ];

        layout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'keyboard-row';
            
            row.forEach(key => {
                const keyButton = document.createElement('button');
                keyButton.className = 'key';
                keyButton.textContent = key;
                keyButton.addEventListener('click', () => this.handleKeyPress(key));
                rowDiv.appendChild(keyButton);
            });
            
            keyboard.appendChild(rowDiv);
        });

        const bottomRow = document.createElement('div');
        bottomRow.className = 'keyboard-row';

        const backspace = document.createElement('button');
        backspace.className = 'key wide';
        backspace.textContent = '⌫';
        backspace.addEventListener('click', () => this.handleBackspace());
        
        const space = document.createElement('button');
        space.className = 'key space';
        space.textContent = 'space';
        space.addEventListener('click', () => this.handleKeyPress(' '));
        
        const enter = document.createElement('button');
        enter.className = 'key wide';
        enter.textContent = '↵';
        enter.addEventListener('click', () => this.handleEnter());

        bottomRow.appendChild(backspace);
        bottomRow.appendChild(space);
        bottomRow.appendChild(enter);
        keyboard.appendChild(bottomRow);

        document.body.appendChild(keyboard);
    }

    handleKeyPress(key) {
        this.currentValue = this.input.value + key;
        this.input.value = this.currentValue;
        this.input.dispatchEvent(new Event('input'));
    }

    handleBackspace() {
        this.currentValue = this.input.value.slice(0, -1);
        this.input.value = this.currentValue;
        this.input.dispatchEvent(new Event('input'));
    }

    handleEnter() {
        this.input.form.dispatchEvent(new Event('submit'));
    }
}

class Game {
    constructor() {
        this.consonantBlends = [
            'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 
            'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 
            'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'
        ];
        
        this.achievements = [
            { name: "Budding Builder", threshold: 15 },
            { name: "Promising Word Nerd", threshold: 30 },
            { name: "Pro Prefixer", threshold: 40 }
        ];
        
        this.defaultState = {
            prefix: this.getDailyPrefix(),
            foundWords: {},
            totalScore: 0,
            currentAchievement: "",
            date: new Date().toLocaleDateString(),
            day: [
                "Sunday", "Monday", "Tuesday", "Wednesday", 
                "Thursday", "Friday", "Saturday"
            ][new Date().getDay()],
        };
        
        this.state = this.loadState() || this.defaultState;
        this.setupPointsExplanation();
        this.updateUI();
        this.setupEventListeners();
        
        document.getElementById("wordInput").placeholder = 
            "Enter a 2-syllable word starting with the prefix above...";
        
        if (window.innerWidth <= 640) {
            this.keyboard = new VirtualKeyboard(document.getElementById('wordInput'));
        }
    }

    getDailyPrefix() {
        const today = new Date();
        const dateString = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
        const index = parseInt(dateString, 10) % this.consonantBlends.length;
        return this.consonantBlends[index];
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
            const response = await fetch(
                `https://api.datamuse.com/words?sp=${word}&md=sf&max=1`
            );
            const data = await response.json();
            
            if (data.length === 0) return false;
            
            const wordData = data[0];
            const numSyllables = wordData.numSyllables || 0;
            
            return (
                wordData.word === word &&
                numSyllables === 2 &&
                !wordData.tags?.includes('prop') &&
                word === word.toLowerCase()
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

        const isValid = await this.validateWord(word);
        if (!isValid) {
            return { success: false, message: "Not a valid two-syllable word" };
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

    setupPointsExplanation() {
        const explanationHTML = `
            <div class="info-box p-4 bg-gray-100 rounded-lg mb-4">
                <h3 class="font-bold mb-2">How Points Work:</h3>
                <p class="mb-2">Points are awarded based on word frequency in everyday English:</p>
                <ul class="list-disc pl-5">
                    <li class="mb-1"><span class="font-semibold">1 point:</span> Common words (e.g., 'brother', 'present')</li>
                    <li class="mb-1"><span class="font-semibold">2 points:</span> Less common words (e.g., 'broker', 'pristine')</li>
                    <li class="mb-1"><span class="font-semibold">3 points:</span> Rare or challenging words (e.g., 'brooding', 'prescient')</li>
                </ul>
            </div>
            <div class="info-box p-4 bg-gray-100 rounded-lg mb-4">
                <h3 class="font-bold mb-2">Achievement Levels:</h3>
                <ul class="list-disc pl-5">
                    <li class="mb-1"><span class="font-semibold">Budding Builder:</span> Find 15 words</li>
                    <li class="mb-1"><span class="font-semibold">Promising Word Nerd:</span> Find 30 words</li>
                    <li class="mb-1"><span class="font-semibold">Pro Prefixer:</span> Find 40 words</li>
                </ul>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = explanationHTML;
        
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader) {
            gameHeader.parentNode.insertBefore(container, gameHeader.nextSibling);
        }
    }

    updateAchievements() {
        const wordCount = Object.keys(this.state.foundWords).length;
        let newAchievement = "";
        
        for (let i = this.achievements.length - 1; i >= 0; i--) {
            if (wordCount >= this.achievements[i].threshold) {
                newAchievement = this.achievements[i].name;
                break;
            }
        }
        
        if (newAchievement && newAchievement !== this.state.currentAchievement) {
            this.state.currentAchievement = newAchievement;
            this.saveState();
            
            const messageDiv = document.getElementById("message");
            messageDiv.textContent = `Achievement Unlocked: ${newAchievement}!`;
            messageDiv.className = "message success achievement";
            messageDiv.style.display = "block";
            setTimeout(() => {
                messageDiv.style.display = "none";
            }, 5000);
        }
    }

    updateUI() {
        document.getElementById("currentPrefix").textContent = 
            this.state.prefix.toUpperCase();
        document.getElementById("dateDisplay").textContent = 
            `${this.state.day} - ${this.state.date}`;
        document.getElementById("totalScore").textContent = 
            this.state.totalScore;
        document.getElementById("wordsFound").textContent = 
            Object.keys(this.state.foundWords).length;

        const progress = (Object.keys(this.state.foundWords).length / 20) * 100;
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

    setupEventListeners() {
        const form = document.getElementById("wordForm");
        const input = document.getElementById("wordInput");
        const submitBtn = form.querySelector("button");
        const messageDiv = document.getElementById("message");

        const handleSubmit = async (e) => {
            e.preventDefault();
            const result = await this.submitWord(input.value);
            messageDiv.textContent = result.message;
            messageDiv.className = `message ${result.success ? "success" : "error"}`;
            messageDiv.style.display = "block";

            if (result.success) input.value = "";
            setTimeout(() => (messageDiv.style.display = "none"), 3000);
            input.focus();
        };

        form.addEventListener("submit", handleSubmit);
        submitBtn.addEventListener("click", handleSubmit);
        submitBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            handleSubmit(e);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => new Game());
