export class UIManager {
    constructor(game) {
        this.game = game;
        this.activeTool = 'brush-land';
        this.isPainting = false;
        this.brushSize = 3;
        this.selectedCountryIds = new Set();
        this.uniteSourceId = null;
        
        this.setupListeners();
        this.setupToolButtons();
        this.setupDiplomacyListeners();
        this.setupOptionsListeners();
        this.updateStats();
    }

    setupListeners() {
        const canvas = this.game.canvas;
        
        const handleAction = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Screen to World Conversion
            const worldX = (clientX - this.game.offsetX) / this.game.zoom;
            const worldY = (clientY - this.game.offsetY) / this.game.zoom;
            
            const x = Math.floor(worldX / this.game.gridSize);
            const y = Math.floor(worldY / this.game.gridSize);
            
            if (this.activeTool === 'brush-land' || this.activeTool === 'brush-water') {
                const type = this.activeTool === 'brush-land' ? 'land' : 'water';
                const halfSize = Math.floor(this.brushSize / 2);
                for (let dy = -halfSize; dy <= halfSize; dy++) {
                    for (let dx = -halfSize; dx <= halfSize; dx++) {
                        this.game.map.setTile(x + dx, y + dy, type);
                    }
                }
            } else if (this.activeTool === 'place-country') {
                this.showCountryModal(x, y);
                this.activeTool = 'brush-land'; 
                this.updateToolUI();
            } else if (this.activeTool === 'diplomacy') {
                const tile = this.game.map.getTile(x, y);
                if (tile && tile.countryId !== null) {
                    this.toggleCountrySelection(tile.countryId);
                }
            } else if (this.activeTool === 'manage-nation') {
                const tile = this.game.map.getTile(x, y);
                if (tile && tile.countryId !== null) {
                    if (this.uniteSourceId !== null) {
                        this.game.sim.uniteCountries(this.uniteSourceId, tile.countryId);
                        this.uniteSourceId = null;
                    } else {
                        this.showNationControlModal(tile.countryId);
                    }
                }
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            this.isPainting = true;
            handleAction(e);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (this.isPainting && (this.activeTool.startsWith('brush'))) {
                handleAction(e);
            }
        });
        window.addEventListener('mouseup', () => this.isPainting = false);

        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            this.isPainting = true;
            handleAction(e);
        }, { passive: false });
        canvas.addEventListener('touchmove', (e) => {
            if (this.isPainting && (this.activeTool.startsWith('brush'))) {
                handleAction(e);
            }
        }, { passive: false });
        canvas.addEventListener('touchend', () => this.isPainting = false);

        // Sim controls
        document.getElementById('play-pause').addEventListener('click', (e) => {
            const running = this.game.togglePlay();
            e.target.innerText = running ? '⏸️' : '▶️';
        });

        document.getElementById('sim-speed').addEventListener('input', (e) => {
            this.game.sim.speed = parseInt(e.target.value);
        });

        document.getElementById('speed-btn').addEventListener('click', (e) => {
            const wrap = document.getElementById('speed-slider-wrap');
            wrap.classList.toggle('hidden');
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('speed-slider-wrap');
            const btn = document.getElementById('speed-btn');
            if (!wrap.contains(e.target) && e.target !== btn) {
                wrap.classList.add('hidden');
            }
        });

        document.getElementById('brush-size').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
        });

        document.getElementById('clear-map').addEventListener('click', () => {
            if (confirm("Clear entire map?")) {
                this.game.map.reset();
                this.game.sim.countries.clear();
                this.selectedCountryIds.clear();
                this.updateDiplomacyUI();
            }
        });

        document.getElementById('toggle-list').addEventListener('click', () => {
            document.getElementById('country-list-container').classList.toggle('collapsed');
        });

        document.getElementById('map-mode-btn').addEventListener('click', (e) => {
            if (this.game.mapMode === 'political') {
                this.game.mapMode = 'alliance';
                e.target.innerText = '🛡️';
                e.target.title = "Map Mode: Alliance";
            } else {
                this.game.mapMode = 'political';
                e.target.innerText = '🗺️';
                e.target.title = "Map Mode: Political";
            }
        });
    }

    setupOptionsListeners() {
        const optionsBtn = document.getElementById('options-btn');
        const optionsModal = document.getElementById('options-modal');
        const closeOptions = document.getElementById('close-options');
        const revoltsToggle = document.getElementById('revolts-toggle');
        const civilWarsToggle = document.getElementById('civilwars-toggle');
        const alliancesToggle = document.getElementById('alliances-toggle');

        optionsBtn.addEventListener('click', () => {
            optionsModal.classList.remove('hidden');
            revoltsToggle.checked = this.game.sim.revoltsEnabled;
            civilWarsToggle.checked = this.game.sim.civilWarsEnabled;
            alliancesToggle.checked = this.game.sim.alliancesEnabled;
        });

        closeOptions.addEventListener('click', () => {
            optionsModal.classList.add('hidden');
        });

        revoltsToggle.addEventListener('change', (e) => {
            this.game.sim.revoltsEnabled = e.target.checked;
        });

        civilWarsToggle.addEventListener('change', (e) => {
            this.game.sim.civilWarsEnabled = e.target.checked;
        });

        alliancesToggle.addEventListener('change', (e) => {
            this.game.sim.alliancesEnabled = e.target.checked;
            if (!e.target.checked) {
                this.game.sim.dissolveAllAlliances();
            }
        });
    }

    setupDiplomacyListeners() {
        document.getElementById('action-war').addEventListener('click', () => this.executeRelationAction('war'));
        document.getElementById('action-deathwar').addEventListener('click', () => this.executeRelationAction('death_war'));
        document.getElementById('action-ally').addEventListener('click', () => this.executeRelationAction('ally'));
        document.getElementById('action-perm-ally').addEventListener('click', () => this.executeRelationAction('permanent_ally'));
        document.getElementById('action-clear').addEventListener('click', () => {
            this.selectedCountryIds.clear();
            this.updateDiplomacyUI();
        });

        this.makeDraggable(document.getElementById('diplomacy-actions'), document.getElementById('diplomacy-drag-handle'));
    }

    makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        const dragMouseDown = (e) => {
            e = e || window.event;
            // Prevent dragging if clicking buttons inside
            if (e.target !== handle && !handle.contains(e.target)) return;
            
            e.preventDefault();
            // Get the mouse cursor position at startup:
            pos3 = e.touches ? e.touches[0].clientX : e.clientX;
            pos4 = e.touches ? e.touches[0].clientY : e.clientY;
            
            // For position absolute relative to body
            // We need to clear the transform if we want simple top/left movement
            element.style.transform = 'none';
            // Set initial position based on current visual location
            const rect = element.getBoundingClientRect();
            element.style.top = rect.top + "px";
            element.style.left = rect.left + "px";
            element.style.bottom = "auto";
            
            document.onmouseup = closeDragElement;
            document.ontouchend = closeDragElement;
            // Call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
            document.ontouchmove = elementDrag;
        };

        const elementDrag = (e) => {
            e = e || window.event;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Calculate the new cursor position:
            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;
            
            // Set the element's new position:
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };

        const closeDragElement = () => {
            // Stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        };

        handle.onmousedown = dragMouseDown;
        handle.ontouchstart = dragMouseDown;
    }

    toggleCountrySelection(id) {
        if (this.selectedCountryIds.has(id)) {
            this.selectedCountryIds.delete(id);
        } else {
            this.selectedCountryIds.add(id);
        }
        this.updateDiplomacyUI();
    }

    updateDiplomacyUI() {
        const count = this.selectedCountryIds.size;
        document.getElementById('selection-count').innerText = count;
        const actionsDiv = document.getElementById('diplomacy-actions');
        
        if (count >= 2) {
            actionsDiv.classList.remove('hidden');
        } else {
            actionsDiv.classList.add('hidden');
        }
    }

    executeRelationAction(type) {
        const ids = Array.from(this.selectedCountryIds);
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                this.game.sim.setRelation(ids[i], ids[j], type);
            }
        }
        this.selectedCountryIds.clear();
        this.updateDiplomacyUI();
    }

    setupToolButtons() {
        const btns = document.querySelectorAll('.tool-btn[data-tool]');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTool = btn.dataset.tool;
                this.updateToolUI();
            });
        });
    }

    updateToolUI() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.activeTool);
        });
    }

    showNationControlModal(countryId) {
        const country = this.game.sim.countries.get(countryId);
        if (!country) return;

        const modal = document.getElementById('nation-control-modal');
        const title = document.getElementById('nc-title');
        title.innerText = `Control: ${country.name}`;
        modal.classList.remove('hidden');

        const setupBtn = (id, callback) => {
            const btn = document.getElementById(id);
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                callback();
                modal.classList.add('hidden');
            });
        };

        setupBtn('nc-collapse', () => this.game.sim.handleCountryDeath(country));
        setupBtn('nc-civilwar', () => this.game.sim.triggerCivilWar(country));
        setupBtn('nc-stronger', () => country.strength *= 1.5);
        setupBtn('nc-weaker', () => country.strength *= 0.6);
        setupBtn('nc-unite', () => {
            this.uniteSourceId = countryId;
            // Optionally provide feedback
            console.log(`Select another nation for ${country.name} to unite with.`);
        });
        setupBtn('nc-focustree', () => this.showFocusTreeEditor(countryId));
        setupBtn('nc-close', () => {});
    }

    showFocusTreeEditor(countryId) {
        const country = this.game.sim.countries.get(countryId);
        if (!country) return;

        const modal = document.getElementById('focus-tree-modal');
        const list = document.getElementById('focus-list-container');
        const nameSpan = document.getElementById('ft-country-name');
        
        nameSpan.innerText = country.name;
        modal.classList.remove('hidden');

        // Copy existing tree or start new
        let workingTree = country.focusTree ? JSON.parse(JSON.stringify(country.focusTree)) : [];

        const renderFoci = () => {
            list.innerHTML = '';
            workingTree.forEach((focus, index) => {
                const item = document.createElement('div');
                item.className = 'focus-item';
                item.innerHTML = `
                    <div class="focus-item-header">
                        <input type="text" value="${focus.name}" data-index="${index}" class="focus-name-input">
                        <button class="remove-focus" data-index="${index}">🗑️</button>
                    </div>
                    <div class="focus-item-body">
                        <select class="focus-effect-select" data-index="${index}">
                            <option value="strength_boost" ${focus.effect === 'strength_boost' ? 'selected' : ''}>💪 Strength Boost</option>
                            <option value="territory_gain" ${focus.effect === 'territory_gain' ? 'selected' : ''}>🗺️ Expand Borders</option>
                            <option value="declare_war" ${focus.effect === 'declare_war' ? 'selected' : ''}>⚔️ Declare War</option>
                            <option value="death_war" ${focus.effect === 'death_war' ? 'selected' : ''}>💀 Death War</option>
                            <option value="revolt_neighbor" ${focus.effect === 'revolt_neighbor' ? 'selected' : ''}>💥 Instigate Revolt</option>
                            <option value="gold_gain" ${focus.effect === 'gold_gain' ? 'selected' : ''}>💰 Economic Focus</option>
                            <option value="custom" ${focus.effect === 'custom' ? 'selected' : ''}>🔮 Custom Description</option>
                        </select>
                        <input type="number" value="${focus.duration}" min="5" max="500" title="Duration (years)" class="focus-duration-input" data-index="${index}">
                        <span class="focus-status-badge ${focus.status}">${focus.status}</span>
                    </div>
                    <div class="focus-item-desc">
                        <textarea class="focus-desc-input" data-index="${index}" placeholder="Describe what this focus does...">${focus.description || ''}</textarea>
                    </div>
                `;
                list.appendChild(item);
            });

            // Add event listeners to inputs
            list.querySelectorAll('.focus-name-input').forEach(input => {
                input.addEventListener('change', (e) => workingTree[e.target.dataset.index].name = e.target.value);
            });
            list.querySelectorAll('.focus-effect-select').forEach(select => {
                select.addEventListener('change', (e) => workingTree[e.target.dataset.index].effect = e.target.value);
            });
            list.querySelectorAll('.focus-duration-input').forEach(input => {
                input.addEventListener('change', (e) => workingTree[e.target.dataset.index].duration = parseInt(e.target.value));
            });
            list.querySelectorAll('.focus-desc-input').forEach(textarea => {
                textarea.addEventListener('change', (e) => workingTree[e.target.dataset.index].description = e.target.value);
            });
            list.querySelectorAll('.remove-focus').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    workingTree.splice(e.target.dataset.index, 1);
                    renderFoci();
                });
            });
        };

        document.getElementById('add-focus-btn').onclick = () => {
            workingTree.push({
                name: 'New Focus',
                effect: 'custom',
                description: '',
                duration: 50,
                status: 'locked',
                progress: 0
            });
            renderFoci();
        };

        document.getElementById('save-focus-tree').onclick = () => {
            country.focusTree = workingTree;
            modal.classList.add('hidden');
        };

        document.getElementById('close-focus-tree').onclick = () => {
            modal.classList.add('hidden');
        };

        renderFoci();
    }

    showCountryModal(x, y) {
        const modal = document.getElementById('country-modal');
        modal.classList.remove('hidden');
        
        const confirmBtn = document.getElementById('confirm-country');
        const cancelBtn = document.getElementById('cancel-country');
        const nameInput = document.getElementById('country-name');
        const colorInput = document.getElementById('country-color');
        const tribeToggle = document.getElementById('country-is-tribe');

        nameInput.value = this.generateRandomName();
        colorInput.value = this.getRandomColor();
        tribeToggle.checked = false;

        const onConfirm = () => {
            this.game.sim.addCountry(nameInput.value, colorInput.value, x, y, tribeToggle.checked);
            cleanup();
        };

        const onCancel = () => cleanup();

        const cleanup = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    }

    generateRandomName() {
        const prefixes = ['New', 'Grand', 'Kingdom of', 'Empire of', 'United', 'Republic of'];
        const roots = ['Zonia', 'Veridia', 'Arithia', 'Oslon', 'Tarkov', 'Ilyria', 'Valoria', 'Koros'];
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${roots[Math.floor(Math.random() * roots.length)]}`;
    }

    getRandomColor() {
        return this.game.sim.generateUniqueColor();
    }

    updateStats() {
        setInterval(() => {
            // Clean up selections of dead countries
            for (const id of this.selectedCountryIds) {
                if (!this.game.sim.countries.has(id)) {
                    this.selectedCountryIds.delete(id);
                }
            }
            this.updateDiplomacyUI();

            document.getElementById('year-val').innerText = this.game.sim.year;
            
            const list = document.getElementById('country-list');
            list.innerHTML = '';
            
            const activeCountries = Array.from(this.game.sim.countries.values())
                .filter(c => !c.isDead)
                .sort((a, b) => b.territories.size - a.territories.size);

            document.getElementById('nation-count').innerText = activeCountries.length;

            activeCountr
