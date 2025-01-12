// Add this at the very beginning of your JavaScript file
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

        // Backspace key
        const backspace = document.createElement('button');
        backspace.className = 'key wide';
        backspace.textContent = '⌫';
        backspace.addEventListener('click', () => this.handleBackspace());
        
        // Space key
        const space = document.createElement('button');
        space.className = 'key space';
        space.textContent = 'space';
        space.addEventListener('click', () => this.handleKeyPress(' '));
        
        // Enter key
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
    // Previous constructor code remains the same
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
this.setupEventListeners();
    if (window.innerWidth <= 640) {
            this.keyboard = new VirtualKeyboard(document.getElementById('wordInput'));
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
    
    // Insert after the game header
    const gameHeader = document.querySelector('.game-header');
    if (gameHeader) {
      gameHeader.parentNode.insertBefore(container, gameHeader.nextSibling);
    }
  }

  updateAchievements() {
    const wordCount = Object.keys(this.state.foundWords).length;
    let newAchievement = "";
    
    // Check achievements in reverse order to get the highest achieved
    for (let i = this.achievements.length - 1; i >= 0; i--) {
      if (wordCount >= this.achievements[i].threshold) {
        newAchievement = this.achievements[i].name;
        break;
      }
    }
    
    // If achievement changed, update and show message
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

  // Modify the existing submitWord method to include achievement checks
  async submitWord(word) {
    const result = await super.submitWord(word);
    if (result.success) {
      this.updateAchievements();
    }
    return result;
  }

  // All other existing methods remain exactly the same
  // Include all previous methods here...
}

// Initialize the game when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => new Game());
