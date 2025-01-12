class Game {
  constructor() {
    // Common English consonant blends for word beginnings
    this.consonantBlends = [
      'bl', 'br', 'ch', 'cl', 'cr', 'dr', 'fl', 
      'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 
      'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'
    ];
    
    this.defaultState = {
      prefix: this.getDailyPrefix(),
      foundWords: {},
      totalScore: 0,
      date: new Date().toLocaleDateString(),
      day: [
        "Sunday", "Monday", "Tuesday", "Wednesday", 
        "Thursday", "Friday", "Saturday"
      ][new Date().getDay()],
    };
    
    this.state = this.loadState() || this.defaultState;
    this.updateUI();
    this.setupEventListeners();
  }

  getDailyPrefix() {
    // Use the date to consistently select a prefix for each day
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
      // First, check if it's a valid word using Datamuse
      const response = await fetch(
        `https://api.datamuse.com/words?sp=${word}&md=f&max=1`
      );
      const data = await response.json();
      
      // Check if the word exists in Datamuse results
      return data.length > 0;
    } catch (error) {
      console.error('API Error:', error);
      return false;
    }
  }

  async submitWord(word) {
    word = word.toLowerCase().trim();
    
    // Basic validation
    if (!word) return { success: false, message: "Enter a 2-syllable word starting with the prefix above..." };
    if (!word.startsWith(this.state.prefix.toLowerCase())) {
      return {
        success: false,
        message: `Word must start with "${this.state.prefix}"`,
      };
    }
    if (this.state.foundWords[word]) {
      return { success: false, message: "Word already found!" };
    }

    // Validate word using Datamuse API
    const isValid = await this.validateWord(word);
    if (!isValid) {
      return { success: false, message: "Not a valid word" };
    }

    // Get word complexity and points
    const points = await this.getWordComplexity(word);
    
    // Add word to found words
    this.state.foundWords[word] = { 
      points, 
      category: this.getCategory(points) 
    };
    this.state.totalScore += points;
    this.saveState();
    this.updateUI();

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
          if (frequency > 10) return 1; // Common word
          if (frequency > 1) return 2; // Moderate difficulty
          return 3; // Challenging or rare
        }
      }
      return 3; // Default to challenging if no data
    } catch (error) {
      console.error('API Error:', error);
      return 3; // Default to challenging if API fails
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

// Initialize the game when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => new Game());
