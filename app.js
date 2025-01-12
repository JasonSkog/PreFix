const GAME_DICTIONARY = {
  twoLetter: {
    br: {
      common: [
        "brother",
        "bracket",
        "brutal",
        "broker",
        "brighten",
        "bravely",
        "broadly",
        "breakdown",
        "breathing",
        "browser",
      ],
      moderate: [
        "brazen",
        "brewing",
        "brevity",
        "brittle",
        "breeches",
        "broiler",
        "bridal",
        "broker",
      ],
      challenging: ["brahmin", "bravado", "brethren", "brigand", "brooding"],
    },
    pr: {
      common: [
        "present",
        "pretty",
        "proper",
        "promise",
        "pressure",
        "preview",
        "product",
        "process",
        "profile",
        "practice",
      ],
      moderate: [
        "priceless",
        "prudent",
        "prophet",
        "prosper",
        "prowess",
        "primal",
        "pretext",
        "probing",
      ],
      challenging: ["prescient", "prism", "prudence", "prowler", "prying"],
    },
  },
  threeLetter: {
    pre: {
      common: [
        "present",
        "prepare",
        "preview",
        "predict",
        "prefer",
        "prefix",
        "presence",
        "pressure",
        "pretend",
        "prepare",
      ],
      moderate: [
        "precious",
        "precinct",
        "precise",
        "predate",
        "predawn",
        "preface",
        "prefect",
        "premise",
      ],
      challenging: [
        "precarious",
        "precedent",
        "preempt",
        "prejudice",
        "premium",
      ],
    },
  },
};

class Game {
  constructor() {
    this.defaultState = {
      prefix: "br",
      prefixType: "twoLetter",
      foundWords: {},
      totalScore: 0,
      date: new Date().toLocaleDateString(),
      day: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ][new Date().getDay()],
    };
    this.state = this.loadState() || this.defaultState;
    this.updateUI();
    this.setupEventListeners();
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

    const prefixWords =
      GAME_DICTIONARY[this.state.prefixType][this.state.prefix.toLowerCase()];
    let category = null;

    for (const [cat, words] of Object.entries(prefixWords)) {
      if (words.includes(word)) {
        category = cat;
        break;
      }
    }

    if (!category) {
      return { success: false, message: "Not a valid two-syllable word" };
    }

    // Only calculate the points if there are no errors.
    // This way we're ensuring the API isn't being bombarded whenever a user makes a mistake.
    const points = await this.getWordComplexity(word);

    this.state.foundWords[word] = { points, category };
    this.state.totalScore += points;
    this.saveState();
    this.updateUI();

    return {
      success: true,
      message: `Found "${word}" - ${points} point${points !== 1 ? "s" : ""}!`,
    };
  }

  updateUI() {
    document.getElementById("currentPrefix").textContent =
      this.state.prefix.toUpperCase();
    document.getElementById(
      "dateDisplay"
    ).textContent = `${this.state.day} - ${this.state.date}`;
    document.getElementById("totalScore").textContent = this.state.totalScore;
    document.getElementById("wordsFound").textContent = Object.keys(
      this.state.foundWords
    ).length;

    const progress = (Object.keys(this.state.foundWords).length / 20) * 100;
    document.getElementById("progressBar").style.width = `${Math.min(
      progress,
      100
    )}%`;

    const wordsHTML = Object.entries(this.state.foundWords)
      .map(
        ([word, data]) => `
                <div class="word-chip">
                    ${word}
                    <span class="point-badge ${data.category}">
                        ${data.points}pt${data.points !== 1 ? "s" : ""}
                    </span>
                </div>
            `
      )
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

    // Handle both form submission and button click
    form.addEventListener("submit", handleSubmit);
    submitBtn.addEventListener("click", handleSubmit);

    // Add touch event for mobile
    submitBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      handleSubmit(e);
    });
  }

  async getWordComplexity(word) {
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
  }
}

// Initialize the game when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => new Game());
