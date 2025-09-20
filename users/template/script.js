const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const settingsFile = path.join(__dirname, 'settings.json');
const gamesFile = path.join(__dirname, 'games.json');
const libraryFile = path.join(__dirname, '../../', 'data', 'game', 'list.json');
const ppDir = path.join(__dirname, '../../', 'data', 'img', 'pp');
const gameBannerDir = path.join(__dirname, '../../', 'data', 'img', 'game', 'baniere');
const gameLogoDir = path.join(__dirname, '../../', 'data', 'img', 'game', 'img');

async function loadSettings() {
    const data = await fs.readFile(settingsFile, 'utf8');
    return JSON.parse(data);
}

async function loadGames() {
    try {
        const data = await fs.readFile(gamesFile, 'utf8');
        const games = JSON.parse(data);
        return games.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    } catch (error) {
        return [];
    }
}

async function loadLibrary() {
    try {
        const data = await fs.readFile(libraryFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading library:', error);
        return [];
    }
}

async function saveSettings(settings) {
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2));
}

async function saveRecentGames(games) {
    await fs.writeFile(gamesFile, JSON.stringify(games, null, 2));
}

async function getProfilePics() {
    const files = await fs.readdir(ppDir);
    return files.filter(file => /\.(jpg|png|jpeg)$/i.test(file));
}

async function getLocalGameVersion(gameName) {
    const games = await loadLibrary();
    const game = games.find(g => g.name === gameName);
    return game ? game.version : 'Unknown';
}

async function initMenu() {
    const settings = await loadSettings();
    const games = await loadGames();
    const libraryGames = await loadLibrary();

    document.getElementById('username').textContent = settings.username;

    // Charger les jeux récents (Home)
    const recentGames = document.getElementById('recentGames');
    games.forEach(async (game, index) => {
        const div = document.createElement('div');
        div.className = 'game-item';
        div.tabIndex = 0;

        const img = document.createElement('img');
        img.src = index === 0 
            ? path.join(gameBannerDir, `${game.name}.png`)
            : path.join(gameLogoDir, `${game.name}.png`);
        img.className = index === 0 ? 'game-banner' : 'game-logo';
        img.onerror = () => img.src = path.join(ppDir, 'default.png');

        img.style.cursor = 'pointer';
        img.onclick = () => openGameModal(game.name, img.src);

        const name = document.createElement('span');
        name.textContent = game.name;

        const lastPlayed = document.createElement('span');
        lastPlayed.className = 'last-played';
        lastPlayed.textContent = `Last played: ${new Date(game.date).toLocaleString()}`;

        div.appendChild(img);
        div.appendChild(name);
        div.appendChild(lastPlayed);
        recentGames.appendChild(div);
    });

    // Charger la bibliothèque (Library)
    const libraryContainer = document.getElementById('libraryGames');
    libraryGames.forEach(async (game) => {
        const div = document.createElement('div');
        div.className = 'game-item';
        div.tabIndex = 0;

        const img = document.createElement('img');
        img.src = path.join(gameLogoDir, `${game.name}.png`);
        img.className = 'game-logo';
        img.onerror = () => img.src = path.join(ppDir, 'default.png');

        img.style.cursor = 'pointer';
        img.onclick = () => openGameModal(game.name, img.src);

        const name = document.createElement('span');
        name.textContent = game.name;

        div.appendChild(img);
        div.appendChild(name);
        libraryContainer.appendChild(div);
    });

    // Paramètres
    document.getElementById('newUsername').value = settings.username;
    document.getElementById('themeSelect').value = settings.theme;
    document.getElementById('regionSelect').value = settings.region;
    document.getElementById('userId').textContent = settings.userId;

    const ppSelect = document.getElementById('profilePicSelect');
    const profilePics = await getProfilePics();
    ppSelect.innerHTML = '';
    profilePics.forEach(pic => {
        const option = document.createElement('option');
        option.value = pic;
        option.textContent = pic;
        if (pic === settings.profilePic) option.selected = true;
        ppSelect.appendChild(option);
    });

    document.body.className = settings.theme;
}

async function openGameModal(gameName, bannerSrc) {
    const modal = document.getElementById('gameModal');
    document.getElementById('gameModalTitle').textContent = gameName;
    document.getElementById('gameModalBanner').src = bannerSrc;

    const localVersion = await getLocalGameVersion(gameName);
    document.getElementById('gameModalVersion').textContent = `Version: ${localVersion}`;

    document.getElementById('playGameBtn').onclick = () => playGame(gameName);
    document.getElementById('updateGameBtn').onclick = () => {
        const gameZipUrl = `https://rocknite-studio.github.io/ROCKNITE-OS/game/comon/${gameName}/game.zip`;
        window.open(gameZipUrl, '_blank');
    };

    document.getElementById('closeGameModal').onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
    document.getElementById('playGameBtn').focus();
}

async function playGame(gameName) {
    const games = await loadLibrary();
    const game = games.find(g => g.name === gameName);
    if (!game) {
        console.error(`Game ${gameName} not found in library`);
        return;
    }

    try {
        if (game.type === 'web') {
            window.open(game.path, '_blank');
        } else {
            const isWindows = process.platform === 'win32';
            const gamePath = path.join(__dirname, '../../', game.path);
            const command = isWindows ? `wine "${gamePath}"` : `"${gamePath}"`;
            await execPromise(command);
            console.log(`Launched ${gameName}`);
        }

        // Mettre à jour la liste des jeux récents
        let recentGames = await loadGames();
        const existingGameIndex = recentGames.findIndex(g => g.name === gameName);
        const currentDate = new Date().toISOString();

        if (existingGameIndex !== -1) {
            // Si le jeu existe déjà dans la liste, mettre à jour la date
            recentGames[existingGameIndex].date = currentDate;
        } else {
            // Sinon, ajouter une nouvelle entrée
            recentGames.push({ name: gameName, date: currentDate });
        }

        // Trier les jeux par date décroissante et limiter à 10
        recentGames = recentGames.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        await saveRecentGames(recentGames);

        // Recharger la page pour mettre à jour l'affichage
        location.reload();
    } catch (error) {
        console.error(`Error launching ${gameName}:`, error);
    }
}

async function saveChanges() {
    const settings = await loadSettings();
    const newUsername = document.getElementById('newUsername').value;
    const newProfilePic = document.getElementById('profilePicSelect').value;
    const newTheme = document.getElementById('themeSelect').value;
    const newRegion = document.getElementById('regionSelect').value;

    const oldUsername = settings.username;
    settings.username = newUsername;
    settings.profilePic = newProfilePic;
    settings.theme = newTheme;
    settings.region = newRegion;
    await saveSettings(settings);

    const usersFile = path.join(__dirname, '../../login', 'users.json');
    const users = JSON.parse(await fs.readFile(usersFile, 'utf8'));
    const userIndex = users.findIndex(u => u.username === oldUsername);
    if (userIndex !== -1) {
        users[userIndex].username = newUsername;
        users[userIndex].profilePic = newProfilePic;
        await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    }

    if (newUsername !== oldUsername) {
        const oldDir = path.join(__dirname, '..', oldUsername);
        const newDir = path.join(__dirname, '..', newUsername);
        await fs.rename(oldDir, newDir);
        location.href = path.join(__dirname, '..', newUsername, 'index.html');
    } else {
        location.reload();
    }
}

function switchTab(event) {
    const tab = event.target.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tab).classList.add('active');
}

function logout() {
    location.href = '../../login/index.html';
}

function setupNavigation() {
    const recentGames = document.getElementById('recentGames');
    const libraryGames = document.getElementById('libraryGames');
    const tabs = document.querySelectorAll('.tab-btn');
    const logoutBtn = document.getElementById('logout');
    const gameModal = document.getElementById('gameModal');
    let gamepads = {};
    let lastMoveTime = 0;
    const moveDelay = 250;

    function focusNextGame(container, direction) {
        const gameItems = Array.from(container.querySelectorAll('.game-item'));
        const focused = document.activeElement;
        const currentIndex = gameItems.indexOf(focused);
        const currentTime = Date.now();

        if (currentTime - lastMoveTime < moveDelay) return;

        let nextIndex;
        if (direction === 'right') {
            nextIndex = currentIndex < gameItems.length - 1 ? currentIndex + 1 : 0;
        } else if (direction === 'left') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : gameItems.length - 1;
        }

        if (nextIndex !== undefined) {
            gameItems[nextIndex].focus();
            container.scrollTo({
                left: gameItems[nextIndex].offsetLeft - container.offsetWidth / 2 + gameItems[nextIndex].offsetWidth / 2,
                behavior: 'smooth'
            });
            lastMoveTime = currentTime;
        }
    }

    function focusNextElement(direction) {
        const activeTab = document.querySelector('.tab-content.active').id;
        if (activeTab === 'home') {
            if (direction === 'left' || direction === 'right') {
                focusNextGame(recentGames, direction);
            } else if (direction === 'down') {
                logoutBtn.focus();
            }
        } else if (activeTab === 'library') {
            if (direction === 'left' || direction === 'right') {
                focusNextGame(libraryGames, direction);
            }
        } else if (activeTab === 'settings') {
            const elements = [
                document.getElementById('newUsername'),
                document.getElementById('profilePicSelect'),
                document.getElementById('themeSelect'),
                document.getElementById('regionSelect'),
                document.getElementById('saveSettings')
            ];
            const focused = document.activeElement;
            const currentIndex = elements.indexOf(focused);
            const currentTime = Date.now();

            if (currentTime - lastMoveTime < moveDelay) return;

            let nextIndex;
            if (direction === 'down') {
                nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
            } else if (direction === 'up') {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
            }

            if (nextIndex !== undefined) {
                elements[nextIndex].focus();
                lastMoveTime = currentTime;
            }
        }

        if (direction === 'tab-left' || direction === 'tab-right') {
            const currentTab = document.querySelector('.tab-btn.active');
            const currentIndex = Array.from(tabs).indexOf(currentTab);
            const currentTime = Date.now();

            if (currentTime - lastMoveTime < moveDelay) return;

            let nextIndex;
            if (direction === 'tab-left') {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
            } else {
                nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
            }
            tabs[nextIndex].focus();
            tabs[nextIndex].click();
            lastMoveTime = currentTime;
        }
    }

    function focusModalElement(direction) {
        if (gameModal.style.display !== 'flex') return;

        const elements = [
            document.getElementById('playGameBtn'),
            document.getElementById('updateGameBtn'),
            document.getElementById('closeGameModal')
        ];
        const focused = document.activeElement;
        const currentIndex = elements.indexOf(focused);
        const currentTime = Date.now();

        if (currentTime - lastMoveTime < moveDelay) return;

        let nextIndex;
        if (direction === 'down') {
            nextIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
        } else if (direction === 'up') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
        }

        if (nextIndex !== undefined) {
            elements[nextIndex].focus();
            lastMoveTime = currentTime;
        }
    }

    document.addEventListener('keydown', (e) => {
        if (gameModal.style.display === 'flex') {
            if (e.key === 'ArrowUp') {
                focusModalElement('up');
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                focusModalElement('down');
                e.preventDefault();
            }
        } else {
            if (e.key === 'ArrowLeft') {
                focusNextElement('left');
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                focusNextElement('right');
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                focusNextElement('up');
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                focusNextElement('down');
                e.preventDefault();
            } else if (e.key === 'Tab') {
                focusNextElement(e.shiftKey ? 'tab-left' : 'tab-right');
                e.preventDefault();
            }
        }
    });

    window.addEventListener('gamepadconnected', (e) => {
        gamepads[e.gamepad.index] = e.gamepad;
        console.log('Gamepad connected:', e.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        delete gamepads[e.gamepad.index];
        console.log('Gamepad disconnected:', e.gamepad.id);
    });

    function pollGamepads() {
        const gamepad = navigator.getGamepads()[Object.keys(gamepads)[0]];
        if (!gamepad) return;
        const currentTime = Date.now();

        if (currentTime - lastMoveTime < moveDelay) return;

        const xAxis = gamepad.axes[0];
        if (xAxis < -0.1) focusNextElement('left');
        if (xAxis > 0.1) focusNextElement('right');

        if (gamepad.buttons[14].pressed) {
            focusNextElement('left');
            lastMoveTime = currentTime;
        }
        if (gamepad.buttons[15].pressed) {
            focusNextElement('right');
            lastMoveTime = currentTime;
        }
        if (gamepad.buttons[12].pressed) {
            focusNextElement('up');
            focusModalElement('up');
            lastMoveTime = currentTime;
        }
        if (gamepad.buttons[13].pressed) {
            focusNextElement('down');
            focusModalElement('down');
            lastMoveTime = currentTime;
        }

        if (gamepad.buttons[4].pressed) {
            focusNextElement('tab-left');
            lastMoveTime = currentTime;
        }
        if (gamepad.buttons[5].pressed) {
            focusNextElement('tab-right');
            lastMoveTime = currentTime;
        }

        if (gamepad.buttons[0].pressed) {
            document.activeElement.click();
            lastMoveTime = currentTime;
        }

        if (gamepad.buttons[1].pressed && document.activeElement === logoutBtn) {
            logout();
            lastMoveTime = currentTime;
        }
    }

    setInterval(pollGamepads, 100);
}

window.onload = () => {
    initMenu();
    setupNavigation();
    document.getElementById('saveSettings').addEventListener('click', saveChanges);
    document.getElementById('logout').addEventListener('click', logout);
    document.getElementById('logout').tabIndex = 0;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.tabIndex = 0;
        btn.addEventListener('click', switchTab);
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btn.click();
        });
    });
};