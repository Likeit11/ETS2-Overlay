const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let isLocked = true;
let isVisible = true;

const configFile = path.join(__dirname, 'config.json');
let config = {
    toggleMode: 'Insert',
    toggleOverlay: 'PageDown',
    openSettings: 'PageUp',
    opacity: 75,
    showTruck: true,
    showJob: true,
    showNav: true
};

// 기존 설정 파일 존재하면 로드
if (fs.existsSync(configFile)) {
    try { config = { ...config, ...JSON.parse(fs.readFileSync(configFile)) }; } catch(e) {}
}

function registerShortcuts() {
    globalShortcut.unregisterAll();
    
    // 편집 모드 토글
    try {
        globalShortcut.register(config.toggleMode, () => {
            isLocked = !isLocked;
            win.setIgnoreMouseEvents(isLocked, { forward: true });
            if (!isLocked) { win.focus(); } else { win.blur(); }
            win.webContents.executeJavaScript(`(() => {
                let b = document.getElementById('overlay-status');
                if(!b) { b = document.createElement('div'); b.id='overlay-status'; b.className='status-banner'; document.body.appendChild(b); }
                b.style.background = ${isLocked} ? 'rgba(0,180,0,0.9)' : 'rgba(255,100,0,0.9)';
                b.innerText = ${isLocked} ? '🔒 클릭 투과 모드 (게임 내 마우스 사용 가능)' : '🔓 편집 모드 (위젯 및 설정 클릭 가능)';
                b.style.display = 'block';
                setTimeout(() => { b.style.display='none'; }, 3000);
            })()`).catch(console.error);
        });
    } catch(e) { console.error("Invalid hotkey: toggleMode"); }

    // 오버레이 숨기기 토글
    try {
        globalShortcut.register(config.toggleOverlay, () => {
            isVisible = !isVisible;
            if (isVisible) win.showInactive(); else win.hide();
        });
    } catch(e) { console.error("Invalid hotkey: toggleOverlay"); }

    // 설정 창 띄우기
    try {
        globalShortcut.register(config.openSettings, () => {
            isLocked = false; // 설정하려면 클릭이 되어야 하므로 풀기
            win.setIgnoreMouseEvents(false, { forward: true });
            isVisible = true;
            win.show();
            win.focus();
            win.webContents.executeJavaScript(`(() => { if(typeof openSettingsModal === 'function') openSettingsModal(); })()`).catch(console.error);
        });
    } catch(e) { console.error("Invalid hotkey: openSettings"); }
}

function createWindow() {
    win = new BrowserWindow({
        fullscreen: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true, // 게임 오버레이다우려면 작업표시줄 숨기기
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // 화면 최상단 강제 고정 (일부체제 전체화면 위로 띄우는 편법 포함)
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);

    win.setIgnoreMouseEvents(isLocked, { forward: true });
    win.loadURL('http://127.0.0.1:25555/skins/my_overlay/index.html');

    registerShortcuts();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(createWindow);
    app.on('window-all-closed', () => app.quit());
}

// HTML쪽에서 셋팅을 저장하면 반영
ipcMain.on('update-shortcuts', (event, newConfig) => {
    config = { ...config, ...newConfig };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    registerShortcuts();
});

ipcMain.handle('get-shortcuts', () => { return config; });

ipcMain.on('close-overlay', () => {
    app.quit();
});
