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

        // Create regular letter keys
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

        // Add bottom row with special keys
        const bottomRow = document.createElement('div');
        bottomRow.className = 'keyboard-row';

        // Create special keys...
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

    // ... rest of VirtualKeyboard methods remain the same
}

class Game {
    constructor() {
        // Common English consonant blends
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
        
        // Set input placeholder
        document.getElementById("wordInput").placeholder = 
            "Enter a 2-syllable word starting with the prefix above...";
        
        // Initialize virtual keyboard for mobile
        if (window.innerWidth <= 640) {
            this.keyboard = new VirtualKeyboard(document.getElementById('wordInput'));
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

    // Modified submitWord method (removed super call)
    async submitWord(word) {
        const result = await this.validateAndSubmitWord(word);
        if (result.success) {
            this.updateAchievements();
        }
        return result;
    }
}

// Initialize the game when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => new Game());
