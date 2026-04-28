const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let csvData = { headers: [], rows: [] };
let stopRequested = false;

const modelConfig = {
  "gpt-image-1": {
    sizes: [
      { value: "1024x1024", label: "1024 x 1024", price: 0.04 },
      { value: "1536x1024", label: "1536 x 1024 (landscape)", price: 0.08 },
      { value: "1024x1536", label: "1024 x 1536 (portrait)", price: 0.08 },
      { value: "auto", label: "Auto", price: 0.04 },
    ],
  },
  "dall-e-3": {
    sizes: [
      { value: "1024x1024", label: "1024 x 1024", price: 0.04 },
      { value: "1792x1024", label: "1792 x 1024 (landscape)", price: 0.08 },
      { value: "1024x1792", label: "1024 x 1792 (portrait)", price: 0.08 },
    ],
  },
  "dall-e-2": {
    sizes: [
      { value: "256x256", label: "256 x 256", price: 0.016 },
      { value: "512x512", label: "512 x 512", price: 0.018 },
      { value: "1024x1024", label: "1024 x 1024", price: 0.02 },
    ],
  },
};

function getPerImageCost() {
  const model = imageModel.value;
  const size = imageSize.value;
  const entry = modelConfig[model]?.sizes.find((s) => s.value === size);
  return entry?.price ?? 0.04;
}

function populateSizes(model, preferSize) {
  const config = modelConfig[model];
  if (!config) return;
  imageSize.innerHTML = config.sizes
    .map((s) => `<option value="${s.value}">${s.label} (~$${s.price.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')})</option>`)
    .join("");
  const match = config.sizes.find((s) => s.value === preferSize);
  if (match) {
    imageSize.value = preferSize;
  } else {
    imageSize.value = config.sizes[0].value;
  }
  localStorage.setItem("image_size", imageSize.value);
  updateCostEstimate();
}

function getRowCount() {
  if (csvData.rows.length === 0) return 0;
  if (allRowsCheckbox.checked) return csvData.rows.length;
  return Math.min(Number(rowLimitInput.value) || 1, csvData.rows.length);
}

function updateCostEstimate() {
  const costEl = $("#cost-estimate");
  const perImage = getPerImageCost();
  const rows = getRowCount();
  if (rows === 0) {
    costEl.textContent = `~$${perImage.toFixed(2)} per image`;
    return;
  }
  const total = perImage * rows;
  costEl.innerHTML =
    `~$${perImage.toFixed(2)} per image &times; ${rows} row${rows !== 1 ? "s" : ""} = <span class="cost-amount">~$${total.toFixed(2)}</span>`;
}

// --- API Key ---

const apiKeyInput = $("#api-key-input");
const saveKeyBtn = $("#save-key-btn");
const keyStatus = $("#key-status");
const apiKeySection = $("#api-key-section");
const keyBadge = $("#key-badge");

function updateKeyUI(hasKey) {
  if (hasKey) {
    apiKeySection.removeAttribute("open");
    keyBadge.classList.remove("hidden");
  } else {
    apiKeySection.setAttribute("open", "");
    keyBadge.classList.add("hidden");
  }
}

function loadApiKey() {
  const key = localStorage.getItem("openai_api_key") || "";
  apiKeyInput.value = key;
  if (key) {
    keyStatus.textContent = "Key saved";
    keyStatus.className = "status success";
  }
  updateKeyUI(!!key);
}

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Please enter a key";
    keyStatus.className = "status error";
    updateKeyUI(false);
    return;
  }
  localStorage.setItem("openai_api_key", key);
  keyStatus.textContent = "Key saved";
  keyStatus.className = "status success";
  updateKeyUI(true);
});

// --- Master Prompt ---

const masterPrompt = $("#master-prompt");
const imageSize = $("#image-size");
const imageModel = $("#image-model");
const savePromptBtn = $("#save-prompt-btn");
const loadPromptBtn = $("#load-prompt-btn");

imageSize.addEventListener("change", () => {
  localStorage.setItem("image_size", imageSize.value);
  updateCostEstimate();
});

imageModel.addEventListener("change", () => {
  localStorage.setItem("image_model", imageModel.value);
  populateSizes(imageModel.value, imageSize.value);
});

function getPromptHistory() {
  return JSON.parse(localStorage.getItem("prompt_history") || "[]");
}

function savePromptHistory(history) {
  localStorage.setItem("prompt_history", JSON.stringify(history));
}

savePromptBtn.addEventListener("click", () => {
  const text = masterPrompt.value.trim();
  if (!text) return;
  const history = getPromptHistory();
  const entry = {
    id: Date.now(),
    text,
    size: imageSize.value,
    model: imageModel.value,
    date: new Date().toISOString(),
  };
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  savePromptHistory(history);
  keyStatus.textContent = "";
});

loadPromptBtn.addEventListener("click", () => {
  renderPromptHistory();
  $("#prompt-history-modal").classList.remove("hidden");
});

$("#close-history-btn").addEventListener("click", () => {
  $("#prompt-history-modal").classList.add("hidden");
});

$("#prompt-history-modal").addEventListener("click", (e) => {
  if (e.target === $("#prompt-history-modal")) {
    $("#prompt-history-modal").classList.add("hidden");
  }
});

function renderPromptHistory() {
  const list = $("#prompt-history-list");
  const history = getPromptHistory();
  if (history.length === 0) {
    list.innerHTML = "<li>No saved prompts yet.</li>";
    return;
  }
  list.innerHTML = history
    .map(
      (entry) => `
    <li data-id="${entry.id}">
      <button class="delete-prompt" data-id="${entry.id}">&times;</button>
      <div class="prompt-text">${escapeHtml(entry.text)}</div>
      <div class="prompt-meta">${new Date(entry.date).toLocaleString()} &middot; ${entry.size} &middot; ${entry.model}</div>
    </li>`
    )
    .join("");

  list.querySelectorAll("li[data-id]").forEach((li) => {
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-prompt")) return;
      const entry = history.find((h) => h.id === Number(li.dataset.id));
      if (entry) {
        masterPrompt.value = entry.text;
        imageModel.value = entry.model;
        populateSizes(entry.model, entry.size);
        $("#prompt-history-modal").classList.add("hidden");
      }
    });
  });

  list.querySelectorAll(".delete-prompt").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const updated = getPromptHistory().filter((h) => h.id !== id);
      savePromptHistory(updated);
      renderPromptHistory();
    });
  });
}

// --- Sample Data ---

const samples = {
  pirates: {
    prompt: "{{card_name}}: {{description}}, set {{location}}. {{style}}, rich detail, dramatic lighting.",
    csv: `card_name,description,location,style
Captain Blacktide,a fearsome pirate captain with a cursed compass and a parrot on her shoulder,on the deck of a burning galleon at sunset,Golden Age illustration
The Kraken's Maw,a massive tentacled sea monster emerging from a whirlpool,in a stormy open ocean under lightning-filled skies,Dark maritime painting
Smuggler's Cove,a hidden bay with caves full of stolen treasure and rowboats,along a tropical coastline with dense jungle cliffs,Watercolor map art
Cannon Barrage,pirates firing a broadside volley at a royal navy frigate,in a narrow strait between two rocky islands,Action comic book style
Cursed Doubloon,a glowing gold coin with a skull imprint hovering above skeletal hands,in a candlelit treasure vault deep underground,Dark fantasy illustration`,
  },
  space: {
    prompt: "{{card_name}}: {{description}}, {{setting}}. {{style}}, cinematic composition, vivid colors.",
    csv: `card_name,description,setting,style
Nebula Station Kepler,a massive rotating space station orbiting inside a pink and blue nebula,deep space near a dying star,Retro sci-fi poster art
Xenobiologist Zara,an alien scientist in a biosuit examining glowing plant specimens,inside a biodome greenhouse on a jungle moon,Moebius-inspired illustration
Warp Drive Malfunction,a starship tearing through a fractured dimensional rift with sparks and energy arcs,the boundary between normal space and hyperspace,Psychedelic 70s sci-fi
Mining Colony Titan-7,a gritty industrial outpost carved into an asteroid with cargo ships docking,the surface of a barren asteroid belt,Blade Runner cyberpunk
First Contact Protocol,two species meeting for the first time across a holographic table,aboard a diplomatic cruiser with a planet visible through the viewport,Clean futuristic concept art`,
  },
  medieval: {
    prompt: "{{card_name}}: {{description}}, {{location}}. {{style}}, rich colors, detailed.",
    csv: `card_name,description,location,style
The Grand Cathedral,a towering gothic cathedral with stained glass windows and flying buttresses,at the heart of a walled city on a hilltop,Detailed architectural illustration
Harvest Festival,villagers celebrating with overflowing market stalls and musicians in a town square,in a prosperous farming village surrounded by golden wheat fields,Warm Renaissance painting
The King's Council,advisors and nobles gathered around a map-covered war table debating strategy,inside a torch-lit stone castle chamber,Medieval manuscript illumination
Siege of Ironhold,an army with trebuchets and siege towers attacking a fortress on a cliff,at a mountain pass fortress during a snowstorm,Epic battle scene oil painting
The Traveling Merchant,a caravan of wagons and camels loaded with exotic silks and spices crossing a stone bridge,on a busy trade road between two rival kingdoms,Storybook illustration`,
  },
};

const sampleSelect = $("#sample-select");

sampleSelect.addEventListener("change", () => {
  const key = sampleSelect.value;
  if (!key) return;
  const sample = samples[key];
  masterPrompt.value = sample.prompt;
  parseCSV(sample.csv);
  renderCSVPreview();
  csvFileInput.value = "";
});

// --- CSV Parsing ---

const csvFileInput = $("#csv-file");

csvFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  sampleSelect.value = "";
  const reader = new FileReader();
  reader.onload = (ev) => {
    parseCSV(ev.target.result);
    renderCSVPreview();
  };
  reader.readAsText(file);
});

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    csvData = { headers: [], rows: [] };
    return;
  }
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
  csvData = { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function renderCSVPreview() {
  const preview = $("#csv-preview");
  if (csvData.headers.length === 0) {
    preview.classList.add("hidden");
    return;
  }
  preview.classList.remove("hidden");
  $("#csv-row-count").textContent = csvData.rows.length;

  const columnsDiv = $("#csv-columns");
  columnsDiv.innerHTML = "";
  csvData.headers.forEach((h) => {
    const tag = document.createElement("span");
    tag.className = "column-tag";
    tag.textContent = `{{${h}}}`;
    tag.addEventListener("click", () => insertColumnIntoPrompt(h, tag));
    columnsDiv.appendChild(tag);
  });
  updateColumnTagStates();

  const table = $("#csv-table");
  const previewRows = csvData.rows.slice(0, 5);
  table.innerHTML = `
    <thead><tr>${csvData.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${previewRows
      .map(
        (row) =>
          `<tr>${csvData.headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`
      )
      .join("")}</tbody>
  `;

  const rowLimit = $("#row-limit");
  rowLimit.max = csvData.rows.length;
  if (allRowsCheckbox.checked) {
    rowLimit.value = csvData.rows.length;
  } else {
    rowLimit.value = Math.min(1, csvData.rows.length);
  }
  updateCostEstimate();
}

function insertColumnIntoPrompt(column, tag) {
  const placeholder = `{{${column}}}`;
  const textarea = masterPrompt;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  textarea.value = value.slice(0, start) + placeholder + value.slice(end);
  const cursorPos = start + placeholder.length;
  textarea.selectionStart = cursorPos;
  textarea.selectionEnd = cursorPos;
  textarea.focus();
  updateColumnTagStates();
}

function updateColumnTagStates() {
  const prompt = masterPrompt.value;
  $$("#csv-columns .column-tag").forEach((tag) => {
    const col = tag.textContent;
    tag.classList.toggle("inserted", prompt.includes(col));
  });
}

masterPrompt.addEventListener("input", updateColumnTagStates);

// --- Image Generation ---

const generateBtn = $("#generate-btn");
const stopBtn = $("#stop-btn");
const allRowsCheckbox = $("#all-rows");
const rowLimitInput = $("#row-limit");
const progress = $("#progress");
const progressFill = $("#progress-fill");
const progressText = $("#progress-text");
const resultsGrid = $("#results-grid");
const downloadAllBtn = $("#download-all-btn");

allRowsCheckbox.addEventListener("change", () => {
  if (allRowsCheckbox.checked && csvData.rows.length > 0) {
    rowLimitInput.value = csvData.rows.length;
  }
  rowLimitInput.disabled = allRowsCheckbox.checked;
  updateCostEstimate();
});

rowLimitInput.addEventListener("input", updateCostEstimate);

generateBtn.addEventListener("click", startGeneration);
stopBtn.addEventListener("click", () => {
  stopRequested = true;
  stopBtn.disabled = true;
  stopBtn.textContent = "Stopping...";
  progressText.innerHTML = "Stopping after current image finishes...";
  progressFill.style.background = "#f59e0b";
});

const flavorTexts = [
  ["Building networks and growing industries...", "Brass: Birmingham"],
  ["Planning a scientifically managed zoo...", "Ark Nova"],
  ["Mutating diseases are spreading — can we save humanity?", "Pandemic Legacy"],
  ["Vanquishing monsters with strategic cardplay...", "Gloomhaven"],
  ["Deploying agents and battling for control of Arrakis...", "Dune: Imperium"],
  ["Influence, intrigue, and combat in the desert...", "Dune: Imperium"],
  ["Building an intergalactic empire through grand politics...", "Twilight Imperium"],
  ["The Fellowship clashes with Sauron over Middle-earth...", "War of the Ring"],
  ["Competing with rival CEOs to terraform a planet...", "Terraforming Mars"],
  ["Striking from a hidden base... or hunting for it...", "Star Wars: Rebellion"],
  ["Island Spirits joining forces to repel invaders...", "Spirit Island"],
  ["Expanding, researching, and settling the galaxy...", "Gaia Project"],
  ["Reliving the Cold War one card at a time...", "Twilight Struggle"],
  ["Planning, trading, and building an estate to prominence...", "The Castles of Burgundy"],
  ["Searching for signs of alien life in distant signals...", "SETI"],
  ["Crafting a unique deck and slaying the spire together...", "Slay the Spire: The Board Game"],
  ["Forging a path through history, one civilization at a time...", "Through the Ages"],
  ["Determining the fate of Middle-earth in a duel...", "LotR: Duel for Middle-earth"],
  ["Herding cattle across the prairie to Kansas City...", "Great Western Trail"],
  ["Adventuring in the frozen north, building an outpost...", "Frosthaven"],
  ["Testing our economic mettle in the Industrial Revolution...", "Brass: Lancashire"],
  ["Building an interstellar civilization through diplomacy...", "Eclipse"],
  ["Drafting science or military — tough call...", "7 Wonders Duel"],
  ["Surviving an alien-infested spaceship... trust no one...", "Nemesis"],
  ["Five factions vie for dominance in dieselpunk 1920s Europe...", "Scythe"],
  ["Puzzling the life of a Viking — hunt, farm, craft, raid...", "A Feast for Odin"],
  ["Go forth, be bold, and ACQUIRE!...", "Clank! Legacy"],
  ["Merchants trading throughout the Roman Empire...", "Concordia"],
  ["Exploring an island to discover lost ruins...", "Lost Ruins of Arnak"],
  ["Investigating the horrors of Arkham...", "Arkham Horror: TCG"],
  ["Landing a plane silently under pressure...", "Sky Team"],
  ["Deciding the fate of the woodland with asymmetric factions...", "Root"],
  ["Terraforming lands and joining mysterious cults...", "Terra Mystica"],
  ["Wondering which craftsmen will turn up to help...", "Orléans"],
  ["Tossing gobs of unique dice en route to a boss fight...", "Too Many Bones"],
  ["Attracting a beautiful collection of birds...", "Wingspan"],
  ["Building spells and conquering cities as a Mage Knight...", "Mage Knight"],
  ["Vying for hydroelectric dominance — water is power...", "Barrage"],
  ["Leading a class to political and economic victory...", "Hegemony"],
  ["Gathering resources for a village of woodland critters...", "Everdell"],
  ["Exploring the deep sea for the mythic land of Mu...", "The Crew: Mission Deep Sea"],
  ["Crushing grapes and creating a prosperous Tuscan winery...", "Viticulture"],
  ["Optimizing the EV factory before the big board meeting...", "Kanban EV"],
  ["Flicking discs and making trick shots...", "Crokinole"],
  ["Pushing the car to the limit — don't overheat!...", "Heat: Pedal to the Metal"],
  ["Battling Marvel villains with a team of heroes...", "Marvel Champions"],
  ["Strategically managing a fast food empire...", "Food Chain Magnate"],
  ["Developing cities on the seafloor of the future...", "Underwater Cities"],
  ["Building train lines across the United States...", "Ticket to Ride Legacy"],
  ["Deck-building meets tile-laying in the catacombs...", "Clank!: Catacombs"],
  ["Swinging the tides of The Great Game in Afghanistan...", "Pax Pamir"],
  ["Disrupting the ritual — time to slay an Elder God...", "Cthulhu: Death May Die"],
  ["Shipping goods and choosing roles in the colony...", "Puerto Rico"],
  ["Terraforming the world and creating innovations...", "Age of Innovation"],
  ["Creating landscapes and habitats to welcome animals...", "Harmonies"],
  ["Being part of the first Martian colony...", "On Mars"],
  ["Preventing a Soviet bio-threat during the Cold War...", "Pandemic Legacy: Season 0"],
  ["Puzzling together the most harmonious ecosystem...", "Cascadia"],
  ["Using Exosuits and time travel to shape the future...", "Anachrony"],
  ["Expanding a dwarven home through mining and agriculture...", "Caverna"],
  ["Fighting for humanity against the horrors of the Deepwood...", "Oathsworn"],
  ["Don't forget to feed the family... again...", "Agricola"],
  ["Ragnarök has come! Securing a place in Valhalla...", "Blood Rage"],
  ["Renovating an estate and pursuing romance in Victorian England...", "Obsession"],
  ["Serving guests and preparing rooms at the Grand Austria...", "Grand Austria Hotel"],
  ["Deducing who the Demon is... dead players still play...", "Blood on the Clocktower"],
  ["Reconstructing Lisboa after the great earthquake...", "Lisboa"],
  ["The world is a mystery after the pandemic...", "Pandemic Legacy: Season 2"],
  ["Voyaging on the steamship Manticore across the Wandering Sea...", "Sleeping Gods"],
  ["Becoming the most influential clan at Himeji Castle...", "The White Castle"],
  ["Placing workers on gears of the Mayan calendar...", "Tzolk'in"],
  ["Bidding on power plants and managing resources...", "Power Grid"],
  ["Clinging to sanity while investigating Lovecraftian horrors...", "Mansions of Madness"],
  ["Leading a Scottish clan to economic might...", "Clans of Caledonia"],
  ["Tending to sheep on the South Island...", "Great Western Trail: New Zealand"],
  ["Pulling ingredients — hoping the pot won't explode!...", "Quacks of Quedlinburg"],
  ["Defending the homeland as Paladins of the West Kingdom...", "Paladins of the West Kingdom"],
  ["Establishing a supply chain at the bustling port...", "Le Havre"],
  ["Operating a lucrative art gallery and amassing a fortune...", "The Gallerist"],
  ["Exploring ocean depths and publishing research findings...", "Endeavor: Deep Sea"],
  ["Megacorporation versus Netrunner — cat and mouse...", "Android: Netrunner"],
  ["Repelling the Voidborn and restoring Domineum...", "Voidfall"],
  ["Seafaring the 17th century Caribbean for wealth and fame...", "Maracaibo"],
  ["Retracing Darwin's journey to the Galapagos...", "Darwin's Journey"],
  ["Traveling to Asia to discover new birds...", "Wingspan Asia"],
  ["Programming mechs to defeat marauding minions...", "Mechs vs. Minions"],
  ["Reviving civilization 5000 years after the fall...", "Revive"],
  ["Trying to survive in a world of eternal darkness...", "Kingdom Death: Monster"],
  ["Cooperating with fellow astronauts in outer space...", "The Crew"],
  ["Colonizing worlds and taking advantage of others' choices...", "Race for the Galaxy"],
  ["Moving assassins and elders to control the djinns...", "Five Tribes"],
  ["Artfully embellishing palace walls with beautiful tiles...", "Azul"],
  ["Alone against the horror movie killer...", "Final Girl"],
  ["Claiming treasures but trying not to wake the dragon...", "Clank!"],
  ["Deducing and cutting unseen wires before the bomb blows...", "Bomb Busters"],
  ["Embarking on a journey to save — or doom — Middle-earth...", "LotR: Fate of the Fellowship"],
  ["Negotiating a trade deal... does anyone have brick?...", "Catan"],
  ["Flipping tiles and hoping for a monastery...", "Carcassonne"],
  ["Plotting the perfect cross-country train route...", "Ticket to Ride"],
  ["Placing a cathedral in the city... bold move...", "Carcassonne"],
  ["Praying to RNGesus for good dice...", "Any dice game ever"],
  ["Moving the robber... sorry, not sorry...", "Catan"],
  ["Scoring the longest road, hopefully...", "Catan"],
  ["Collecting gems at the market with quiet dignity...", "Splendor"],
  ["Escaping the collapsing temple — grab the treasure!...", "Forbidden Island"],
  ["Convincing the table we're definitely not the werewolf...", "One Night Ultimate Werewolf"],
  ["Stacking blocks very carefully... this isn't Jenga... or is it?...", "Jenga"],
  ["Decoding a ghostly vision from beyond the grave...", "Mysterium"],
  ["Meeple placement in progress, do not disturb...", "Every euro game"],
  ["Rolling for initiative and hoping for the best...", "Every RPG ever"],
  ["Trading sheep for wood at a terrible exchange rate...", "Catan"],
  ["Drawing from the supply pile with trembling hands...", "Dominion"],
  ["Spreading influence across the galaxy, one system at a time...", "Twilight Imperium"],
  ["Quietly backstabbing allies over a nice cup of tea...", "Diplomacy"],
  ["Researching a cure before the next Epidemic card...", "Pandemic"],
  ["Balancing the power grid, one city at a time...", "Power Grid"],
  ["Hiring a crew for a Caribbean voyage...", "Maracaibo"],
  ["Loading cargo onto ships at the harbour...", "Le Havre"],
  ["Upgrading the castle, one hex at a time...", "The Castles of Burgundy"],
  ["Sailing merchants through the cosmos...", "Merchants of Venus"],
  ["Wondering if we should have picked a shorter game...", "Twilight Imperium"],
  ["Reading the rulebook one more time, just to be sure...", "Every board game ever"],
  ["Checking BGG for a rules clarification...", "Every board game ever"],
  ["Accidentally knocking over the meeple tower...", "Every game night"],
  ["Insisting this game is actually really simple once you get going...", "Every heavy euro"],
  ["Reorganizing the insert for the fifth time...", "Every board gamer"],
  ["Sleeving all 500 cards before the first play...", "Every card game"],
  ["Trying to fit the expansion back in the base box...", "Every board game with expansions"],
  ["Explaining the rules for just five more minutes, promise...", "Every game night"],
  ["Setting up the board while everyone else gets snacks...", "Every game night"],
];

const flavorAnimations = ["flavor-fade-in", "flavor-slide-up", "flavor-slide-down", "flavor-zoom-in", "flavor-blur-in", "flavor-typewriter"];

function updateFlavorText(current, total) {
  const [msg, game] = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
  const anim = flavorAnimations[Math.floor(Math.random() * flavorAnimations.length)];
  progressText.className = "";
  void progressText.offsetWidth;
  progressText.innerHTML = `(${current}/${total}) ${escapeHtml(msg)} <span class="flavor-game">— ${escapeHtml(game)}</span>`;
  progressText.classList.add(anim);
}

function randomFlavorText() {
  const [text, game] = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
  return `${text} — ${game}`;
}

async function startGeneration() {
  const apiKey = localStorage.getItem("openai_api_key");
  if (!apiKey) {
    alert("Please save your OpenAI API key first.");
    return;
  }
  const prompt = masterPrompt.value.trim();
  if (!prompt) {
    alert("Please enter a master prompt.");
    return;
  }
  if (csvData.rows.length === 0) {
    alert("Please upload a CSV file.");
    return;
  }

  const limit = allRowsCheckbox.checked
    ? csvData.rows.length
    : Math.min(Number(rowLimitInput.value) || 1, csvData.rows.length);

  const size = imageSize.value;
  const model = imageModel.value;
  const filenamePattern = $("#filename-pattern").value.trim() || "image-{{rowNumber}}";

  stopRequested = false;
  generateBtn.disabled = true;
  stopBtn.classList.remove("hidden");
  progress.classList.remove("hidden");
  resultsGrid.innerHTML = "";
  downloadAllBtn.classList.add("hidden");

  const generatedImages = [];

  for (let i = 0; i < limit; i++) {
    if (stopRequested) break;

    const row = csvData.rows[i];
    const resolvedPrompt = resolvePrompt(prompt, row);
    const filename = resolveFilename(filenamePattern, row, i + 1);

    progressFill.style.width = `${((i) / limit) * 100}%`;
    updateFlavorText(i + 1, limit);
    const flavorInterval = setInterval(() => updateFlavorText(i + 1, limit), 7000);

    try {
      const imageUrl = await generateImage(apiKey, resolvedPrompt, size, model);
      generatedImages.push({ url: imageUrl, prompt: resolvedPrompt, row: i + 1, filename });
      addResultCard(imageUrl, resolvedPrompt, i + 1);
    } catch (err) {
      addErrorCard(err.message, resolvedPrompt, i + 1);
    }

    clearInterval(flavorInterval);
  }

  progressFill.style.width = "100%";
  progressFill.style.background = "";
  progressText.textContent = stopRequested
    ? `Stopped. Generated ${generatedImages.length} of ${limit} images.`
    : `Done. Generated ${generatedImages.length} images.`;
  progressText.style.fontStyle = "normal";

  generateBtn.disabled = false;
  stopBtn.classList.add("hidden");
  stopBtn.disabled = false;
  stopBtn.textContent = "Stop";

  if (generatedImages.length > 0) {
    downloadAllBtn.classList.remove("hidden");
    downloadAllBtn.onclick = () => downloadAll(generatedImages);
  }
}

function resolvePrompt(template, row) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return row[key] !== undefined ? row[key] : match;
  });
}

function resolveFilename(template, row, rowNumber) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === "rowNumber") return rowNumber;
    return row[key] !== undefined ? row[key] : match;
  });
}

async function generateImage(apiKey, prompt, size, model) {
  const body = {
    model,
    prompt,
    n: 1,
    size,
  };

  if (model === "gpt-image-1") {
    body.output_format = "png";
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const item = data.data[0];

  if (item.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  return item.url;
}

function addResultCard(imageUrl, prompt, rowNum) {
  const card = document.createElement("div");
  card.className = "result-card";
  card.innerHTML = `
    <img src="${imageUrl}" alt="Generated image" loading="lazy" />
    <div class="result-info">
      <p title="${escapeHtml(prompt)}">Row ${rowNum}: ${escapeHtml(prompt.slice(0, 80))}${prompt.length > 80 ? "..." : ""}</p>
    </div>
  `;
  card.addEventListener("click", () => openImageModal(imageUrl, prompt, rowNum));
  resultsGrid.appendChild(card);
}

function addErrorCard(message, prompt, rowNum) {
  const card = document.createElement("div");
  card.className = "result-card error-card";
  card.innerHTML = `
    <div class="result-info">
      <p><strong>Row ${rowNum} failed:</strong> ${escapeHtml(message)}</p>
      <p title="${escapeHtml(prompt)}">${escapeHtml(prompt.slice(0, 100))}</p>
    </div>
  `;
  resultsGrid.appendChild(card);
}

async function downloadAll(images) {
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "Zipping images...";

  const zip = new JSZip();

  for (let i = 0; i < images.length; i++) {
    const { url, filename } = images[i];
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      zip.file(`${filename}.png`, blob);
    } catch {
      console.error(`Failed to add image for row ${images[i].row}`);
    }
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = "generated-images.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  downloadAllBtn.disabled = false;
  downloadAllBtn.textContent = "Download all images";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Image Modal ---

const imageModal = $("#image-modal");
const modalImage = $("#modal-image");
const modalPrompt = $("#modal-prompt");

function openImageModal(imageUrl, prompt, rowNum) {
  modalImage.src = imageUrl;
  modalPrompt.textContent = `Row ${rowNum}: ${prompt}`;
  imageModal.classList.remove("hidden");
}

$("#close-image-btn").addEventListener("click", () => {
  imageModal.classList.add("hidden");
  modalImage.src = "";
});

imageModal.addEventListener("click", (e) => {
  if (e.target === imageModal) {
    imageModal.classList.add("hidden");
    modalImage.src = "";
  }
});

// --- Init ---
loadApiKey();
const savedModel = localStorage.getItem("image_model");
const savedSize = localStorage.getItem("image_size");
if (savedModel && modelConfig[savedModel]) {
  imageModel.value = savedModel;
}
populateSizes(imageModel.value, savedSize || "1024x1024");
