// Configuration
const CONFIG = {
    BACKEND_URL: 'https://chrissoffc.my.id:2008'
};

// Global state
let currentState = {
    user: null,
    sessionToken: null,
    selectedRAM: '1000'
};

// Session Management
const sessionManager = {
    save(userData) {
        localStorage.setItem('panel_user', userData.username);
        localStorage.setItem('panel_session', userData.sessionToken);
        localStorage.setItem('panel_time', Date.now().toString());
        
        currentState.user = userData.username;
        currentState.sessionToken = userData.sessionToken;
    },

    load() {
        const user = localStorage.getItem('panel_user');
        const session = localStorage.getItem('panel_session');
        const timestamp = localStorage.getItem('panel_time');
        
        if (user && session && timestamp) {
            const hoursPassed = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60);
            if (hoursPassed < 24) {
                currentState.user = user;
                currentState.sessionToken = session;
                return true;
            }
        }
        return false;
    },

    clear() {
        localStorage.removeItem('panel_user');
        localStorage.removeItem('panel_session');
        localStorage.removeItem('panel_time');
        currentState.user = null;
        currentState.sessionToken = null;
    },

    async verify() {
        if (!currentState.sessionToken) return false;
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/verify-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentState.sessionToken}`
                }
            });
            
            const result = await response.json();
            return response.ok && result.success;
        } catch (error) {
            return false;
        }
    }
};

// UI Management
const ui = {
    show(element) {
        if (typeof element === 'string') element = document.getElementById(element);
        if (element) element.classList.remove('hidden');
    },

    hide(element) {
        if (typeof element === 'string') element = document.getElementById(element);
        if (element) element.classList.add('hidden');
    },

    updateServerStatus(status) {
        const indicators = ['serverStatus', 'serverStatusPanel'];
        const statusTexts = {
            checking: 'Checking...',
            connected: 'Connected',
            disconnected: 'Disconnected'
        };
        
        indicators.forEach(id => {
            const indicator = document.getElementById(id);
            if (indicator) {
                indicator.className = `status-indicator ${status}`;
                const statusText = indicator.querySelector('.status-text');
                if (statusText) {
                    statusText.textContent = statusTexts[status] || 'Unknown';
                }
            }
        });
    },

    showOutput(elementId, content, type = 'info') {
        const output = document.getElementById(elementId);
        if (!output) return;
        
        output.textContent = content;
        output.className = `output active ${type}`;
        output.scrollTop = output.scrollHeight;
    },

    hideOutput(elementId) {
        const output = document.getElementById(elementId);
        if (output) {
            this.hide(output);
            output.className = 'output';
        }
    },

    setLoading(buttonId, loaderId, isLoading) {
        const button = document.getElementById(buttonId);
        const loader = document.getElementById(loaderId);
        
        if (button) button.disabled = isLoading;
        if (loader) loader.classList.toggle('active', isLoading);
    },

    notify(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    },

    addCopyButtons(username, password, loginUrl) {
        const output = document.getElementById('panelOutput');
        if (!output) return;
        
        const copySection = document.createElement('div');
        copySection.className = 'copy-actions';
        
        copySection.innerHTML = `
            <button class="copy-btn" onclick="copyText('${username}')">Copy Username</button>
            <button class="copy-btn" onclick="copyText('${password}')">Copy Password</button>
            <button class="copy-btn open-panel" onclick="window.open('${loginUrl}', '_blank')">Open Panel</button>
        `;
        
        output.appendChild(copySection);
    }
};

// Main Application
const app = {
    async init() {
        // Check server status
        this.checkServerStatus();
        
        // Check existing session
        if (sessionManager.load()) {
            const isValid = await sessionManager.verify();
            if (isValid) {
                this.showPanelScreen();
                return;
            }
            sessionManager.clear();
        }
        
        this.showLoginScreen();
        this.setupKeyboard();
        
        // Set up periodic server status check
        setInterval(() => this.checkServerStatus(), 30000);
    },

    async checkServerStatus() {
        try {
            ui.updateServerStatus('checking');
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/test`);
            const result = await response.json();
            
            if (response.ok && result.success) {
                ui.updateServerStatus('connected');
            } else {
                ui.updateServerStatus('disconnected');
            }
        } catch (error) {
            ui.updateServerStatus('disconnected');
        }
    },

    showLoginScreen() {
        ui.show('loginScreen');
        ui.hide('panelScreen');
        ui.hideOutput('loginOutput');
    },

    showPanelScreen() {
        ui.hide('loginScreen');
        ui.show('panelScreen');
        document.getElementById('userName').textContent = currentState.user || 'User';
        ui.hideOutput('panelOutput');
    },

    async login() {
        const tokenInput = document.getElementById('accessToken');
        const token = tokenInput.value.trim();
        
        if (!token) {
            ui.showOutput('loginOutput', 'Please enter your access token', 'error');
            ui.notify('Token required', 'error');
            return;
        }
        
        ui.setLoading('loginBtn', 'loginLoader', true);
        ui.showOutput('loginOutput', 'Authenticating...', 'loading');
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/token-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: token })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                sessionManager.save(result.data);
                ui.showOutput('loginOutput', 'Login successful! Redirecting...', 'success');
                ui.notify('Login successful', 'success');
                tokenInput.value = '';
                
                setTimeout(() => this.showPanelScreen(), 1500);
            } else {
                throw new Error(result.message || 'Authentication failed');
            }
        } catch (error) {
            ui.showOutput('loginOutput', `Login failed: ${error.message}`, 'error');
            ui.notify('Login failed', 'error');
        } finally {
            ui.setLoading('loginBtn', 'loginLoader', false);
        }
    },

    async logout() {
        if (currentState.sessionToken) {
            try {
                await fetch(`${CONFIG.BACKEND_URL}/api/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentState.sessionToken}`
                    }
                });
            } catch (error) {
                console.error('Logout request failed:', error);
            }
        }
        
        sessionManager.clear();
        
        // Reset forms
        document.getElementById('accessToken').value = '';
        document.getElementById('targetUser').value = '';
        document.getElementById('ramSelector').value = '1000';
        currentState.selectedRAM = '1000';
        
        this.showLoginScreen();
        ui.notify('Logged out successfully', 'info');
    },

    async createPanel() {
        const usernameInput = document.getElementById('targetUser');
        const username = usernameInput.value.trim();
        
        if (!username) {
            ui.showOutput('panelOutput', 'Please enter a username', 'error');
            ui.notify('Username required', 'error');
            return;
        }
        
        if (username.length < 3) {
            ui.showOutput('panelOutput', 'Username must be at least 3 characters', 'error');
            ui.notify('Username too short', 'error');
            return;
        }
        
        if (!currentState.sessionToken) {
            ui.showOutput('panelOutput', 'Session expired. Please login again.', 'error');
            setTimeout(() => this.logout(), 2000);
            return;
        }
        
        ui.setLoading('createBtn', 'createLoader', true);
        ui.showOutput('panelOutput', 'Creating panel...', 'loading');
        
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/create-panel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentState.sessionToken}`
                },
                body: JSON.stringify({
                    username: username,
                    ram: currentState.selectedRAM
                })
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                if (response.status === 401 || response.status === 403) {
                    ui.showOutput('panelOutput', 'Session expired. Please login again.', 'error');
                    setTimeout(() => this.logout(), 2000);
                    return;
                }
                throw new Error(result.message || 'Panel creation failed');
            }
            
            const data = result.data;
            const timestamp = new Date().toLocaleString('id-ID');
            
            const successMsg = `Panel created successfully!

Login Details:
Domain: ${data.login_url}
Username: ${data.user.username}
Password: ${data.user.password}

User Info:
User ID: ${data.user.id}
Email: ${data.user.email}

Server Specs:
Server ID: ${data.server.id}
Server Name: ${data.server.name}
RAM: ${data.server.ram}
CPU: ${data.server.cpu}
Storage: ${data.server.disk}

Created: ${timestamp}
By: ${currentState.user}

Panel will be active in 2-3 minutes.`;
            
            ui.showOutput('panelOutput', successMsg, 'success');
            ui.notify('Panel created successfully', 'success');
            
            setTimeout(() => {
                ui.addCopyButtons(data.user.username, data.user.password, data.login_url);
            }, 1000);
            
        } catch (error) {
            const errorMsg = `Panel creation failed: ${error.message}`;
            ui.showOutput('panelOutput', errorMsg, 'error');
            ui.notify('Panel creation failed', 'error');
        } finally {
            ui.setLoading('createBtn', 'createLoader', false);
        }
    },

    updateRAM() {
        const selector = document.getElementById('ramSelector');
        currentState.selectedRAM = selector.value;
    },

    setupKeyboard() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const loginScreen = document.getElementById('loginScreen');
                const panelScreen = document.getElementById('panelScreen');
                
                if (!loginScreen.classList.contains('hidden')) {
                    event.preventDefault();
                    this.login();
                } else if (!panelScreen.classList.contains('hidden')) {
                    event.preventDefault();
                    this.createPanel();
                }
            }
            
            if (event.key === 'Escape') {
                const panelScreen = document.getElementById('panelScreen');
                if (!panelScreen.classList.contains('hidden')) {
                    this.logout();
                }
            }
        });
    }
};

// Global Functions
function toggleTokenVisibility() {
    const tokenInput = document.getElementById('accessToken');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (tokenInput.type === 'password') {
        tokenInput.type = 'text';
        toggleIcon.textContent = '🙈';
    } else {
        tokenInput.type = 'password';
        toggleIcon.textContent = '👁';
    }
}

function initiateLogin() {
    app.login();
}

function terminateSession() {
    app.logout();
}

function executePanelCreation() {
    app.createPanel();
}

function updateResourceDisplay() {
    app.updateRAM();
}

function copyText(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            ui.notify('Copied to clipboard', 'success');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        ui.notify('Copied to clipboard', 'success');
    } catch (error) {
        ui.notify('Copy failed', 'error');
    }
    
    document.body.removeChild(textarea);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
