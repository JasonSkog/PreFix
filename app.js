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
        this.clearMessage();
        
        const input = document.getElementById("wordInput");
        if (input) {
            input.placeholder = "Enter a 2-syllable word starting with the prefix above...";
            input.value = ""; // Ensure input is clear on start
            input.removeAttribute('disabled'); // Enable input
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
        // Info boxes are now part of the HTML structure
        return;
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
            this.showMessage(`Achievement Unlocked: ${newAchievement}!`, true);
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
        const submitBtn = document.querySelector("button[type='submit']");
        const messageDiv = document.getElementById("message");

        if (!form || !input || !submitBtn || !messageDiv) {
            console.error("Required DOM elements not found");
            return;
        }

        // Enable input field
        input.removeAttribute('disabled');

        const handleSubmit = async (e) => {
            e.preventDefault();
            const word = input.value.trim();
            
            // Only show message if form was actually submitted
            this.clearMessage();
            
            // Don't show error if the input is empty and user is still typing
            if (!word && e.type === 'submit') {
                this.showMessage("Please enter a word", false);
                return;
            }

            const result = await this.submitWord(word);
            this.showMessage(result.message, result.success);

            if (result.success) {
                input.value = ""; // Clear input only on success
            }
            
            input.focus();
        };

        // Remove existing listeners if any
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Re-get elements after clone
        const newInput = document.getElementById("wordInput");
        const newSubmitBtn = document.querySelector("button[type='submit']");
        
        // Add form submit listener
        newForm.addEventListener("submit", handleSubmit);

        // Enable normal keyboard input
        newInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                newForm.dispatchEvent(new Event('submit'));
            }
        });

        // Only add click listener to submit button
        newSubmitBtn.addEventListener("click", (e) => {
            e.preventDefault();
            newForm.dispatchEvent(new Event('submit'));
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
