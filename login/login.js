const fs = require('fs').promises;
const path = require('path');
const { ipcRenderer } = require('electron');

const usersFile = path.join(__dirname, 'users.json');
const ppDir = path.join(__dirname, '../', 'data', 'img', 'pp');
const templateDir = path.join(__dirname, '../users', 'template');
const defaultProfilePic = 'default.png';

function generateUniqueId() {
    return 'user-' + Math.random().toString(36).substr(2, 9);
}

async function loadUsers() {
    try {
        const data = await fs.readFile(usersFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('No users.json found, starting with empty list');
        return [];
    }
}

async function saveUsers(users) {
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

async function getProfilePics() {
    try {
        const files = await fs.readdir(ppDir);
        return files.filter(file => /\.(jpg|png|jpeg)$/i.test(file));
    } catch (error) {
        console.error('Error reading profile pics:', error);
        return [];
    }
}

async function initUsersList() {
    console.log('Initializing users list');
    const users = await loadUsers();
    const usersList = document.getElementById('usersList');
    
    if (!usersList) {
        console.error('usersList element not found');
        return;
    }

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.tabIndex = 0;
        userCard.onclick = () => selectUser(user.username);
        userCard.onkeydown = (e) => {
            if (e.key === 'Enter') selectUser(user.username);
        };

        const profilePic = document.createElement('div');
        profilePic.className = 'profile-pic';
        if (user.profilePic) {
            const img = document.createElement('img');
            img.src = path.join(ppDir, user.profilePic);
            profilePic.appendChild(img);
        } else {
            const img = document.createElement('img');
            img.src = path.join(ppDir, defaultProfilePic);
            profilePic.appendChild(img);
        }

        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = user.username;

        userCard.appendChild(profilePic);
        userCard.appendChild(username);
        usersList.insertBefore(userCard, document.getElementById('addUserBtn'));
    });

    const addUserBtn = document.getElementById('addUserBtn');
    addUserBtn.tabIndex = 0;
    addUserBtn.onkeydown = (e) => {
        if (e.key === 'Enter') addNewUser();
    };
}

async function addNewUser() {
    console.log('addNewUser called');
    const modal = document.getElementById('addUserModal');
    const select = document.getElementById('profilePicSelect');
    
    const profilePics = await getProfilePics();
    select.innerHTML = '';
    if (profilePics.length === 0) {
        select.innerHTML = '<option value="">No profile pictures available (default will be used)</option>';
    } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Use default picture';
        select.appendChild(defaultOption);

        profilePics.forEach((pic, index) => {
            const option = document.createElement('option');
            option.value = pic;
            option.textContent = `${index}: ${pic}`;
            select.appendChild(option);
        });
    }

    modal.style.display = 'flex';
    document.getElementById('newUsername').focus();
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const profilePic = document.getElementById('profilePicSelect').value;

    if (!username) {
        console.log('No username entered');
        return;
    }

    const users = await loadUsers();
    if (users.some(u => u.username === username)) {
        alert('Username already exists!');
        return;
    }

    const newUser = {
        username,
        profilePic: profilePic || defaultProfilePic
    };

    users.push(newUser);
    await saveUsers(users);

    const userDir = path.join(__dirname, '../users', username);
    await copyDir(templateDir, userDir);

    const settings = {
        username,
        profilePic: profilePic || defaultProfilePic,
        theme: 'dark',
        userId: generateUniqueId(),
        region: 'EU'
    };
    await fs.writeFile(path.join(userDir, 'settings.json'), JSON.stringify(settings, null, 2));

    await fs.writeFile(path.join(userDir, 'games.json'), JSON.stringify([], null, 2));

    console.log(`User ${username} added successfully`);
    closeModal();
    location.reload();
}

function closeModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('newUsername').value = '';
}

async function copyDir(src, dest) {
    try {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    } catch (error) {
        console.error('Error copying template:', error);
    }
}

function selectUser(username) {
    console.log('Selecting user:', username);
    ipcRenderer.send('load-user-profile', username);
}

function setupNavigation() {
    const usersList = document.getElementById('usersList');
    const modal = document.getElementById('addUserModal');
    let gamepads = {};
    let lastMoveTime = 0;
    const moveDelay = 250; // Delay ajusté à 250 ms

    function focusNextUser(direction) {
        const userCards = Array.from(usersList.querySelectorAll('.user-card'));
        const focused = document.activeElement;
        const currentIndex = userCards.indexOf(focused);
        const currentTime = Date.now();

        if (currentTime - lastMoveTime < moveDelay) return;

        let nextIndex;
        if (direction === 'right') {
            nextIndex = currentIndex < userCards.length - 1 ? currentIndex + 1 : 0;
        } else if (direction === 'left') {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : userCards.length - 1;
        }

        if (nextIndex !== undefined) {
            userCards[nextIndex].focus();
            usersList.scrollTo({
                left: userCards[nextIndex].offsetLeft - usersList.offsetWidth / 2 + userCards[nextIndex].offsetWidth / 2,
                behavior: 'smooth'
            });
            lastMoveTime = currentTime;
        }
    }

    function focusModalElement(direction) {
        const elements = [
            document.getElementById('newUsername'),
            document.getElementById('profilePicSelect'),
            document.getElementById('submitNewUser'),
            document.getElementById('cancelNewUser')
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
        if (modal.style.display === 'flex') {
            if (e.key === 'ArrowUp') {
                focusModalElement('up');
                e.preventDefault();
            } else if (e.key === 'ArrowDown') {
                focusModalElement('down');
                e.preventDefault();
            }
        } else {
            if (e.key === 'ArrowLeft') {
                focusNextUser('left');
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                focusNextUser('right');
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
        if (xAxis < -0.1) focusNextUser('left');
        if (xAxis > 0.1) focusNextUser('right');

        if (gamepad.buttons[14].pressed) focusNextUser('left');
        if (gamepad.buttons[15].pressed) focusNextUser('right');
        if (gamepad.buttons[12].pressed && modal.style.display === 'flex') focusModalElement('up');
        if (gamepad.buttons[13].pressed && modal.style.display === 'flex') focusModalElement('down');

        if (gamepad.buttons[0].pressed) {
            document.activeElement.click();
            lastMoveTime = currentTime;
        }
    }

    setInterval(pollGamepads, 100);
}

window.onload = () => {
    console.log('Window loaded');
    initUsersList();
    setupNavigation();
    
    document.getElementById('submitNewUser').addEventListener('click', createUser);
    document.getElementById('cancelNewUser').addEventListener('click', closeModal);
    document.getElementById('addUserBtn').addEventListener('click', addNewUser);
};