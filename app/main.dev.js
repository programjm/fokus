/* eslint global-require: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `yarn build` or `yarn build-main`, this file is compiled to
 * `./app/main.prod.js` using webpack. This gives us some performance wins.
 *
 * @flow
 */
import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import routes from './constants/routes';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow = null;

const DEVELOPMENT_BUILD =
  process.env.NODE_ENV === 'development' ||
  process.env.DEBUG_PROD === 'true';

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (DEVELOPMENT_BUILD) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

  return Promise.all(
    extensions.map(name => installer.default(installer[name], forceDownload))
  ).catch(console.log);
};

let currentStatus = {
  play: false,
  startTime: new Date(),
  taskName: "",
  duration: 0,
  breakCooldownDuration: 0,
  timerMode: false,
};

global.setCurrentStatus = status => currentStatus = status;
global.getCurrentStatus = () => currentStatus;

global.goToTimerMode = () => {
  const screenDimensions =  screen.getPrimaryDisplay().workAreaSize;
  const displayW = screenDimensions.width;
  const displayH = screenDimensions.height;
  const w = 200, h = 50;
  mainWindow = new BrowserWindow({
    show: false,
    minWidth: w,
    minHeight: h,
    height: h,
    width: w,
    resizable: true,
    draggable: true,
    skipTaskbar: true,
    focusable: true,
    fullscreen: false,
    titleBarStyle: 'hidden',
    frame: false,
    x: Number(displayW) - w,
    y: Number(displayH) - h
  });
  mainWindow.setAlwaysOnTop(true,'floating');
  mainWindow.loadURL(`file://${__dirname}/app.html`);
  mainWindow.setMenuBarVisibility(false);
  currentStatus.timerMode = true;
  mainWindow.on('restore', () => {
    BrowserWindow.getAllWindows()[0].setSkipTaskbar(true); // can hide it when maximized
  })
  mainWindow.show();
};

global.goToMainMode = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    show: false,
    width,
    height,
    kiosk: !DEVELOPMENT_BUILD, //true, except when testing
    skipTaskbar: !DEVELOPMENT_BUILD,
    //focusable: false,
    fullscreen: !DEVELOPMENT_BUILD, //true, except when testing
  });
  mainWindow.setAlwaysOnTop(!DEVELOPMENT_BUILD,"floating");
  mainWindow.loadURL(`file://${__dirname}/app.html`);
  mainWindow.setFullScreen(!DEVELOPMENT_BUILD); // fix: needed for fullscreen to actually activate
  mainWindow.setMenuBarVisibility(false);
  currentStatus.timerMode = false;
  mainWindow.show();
};

// Called when the user presses the minimize button in the timer window
global.minimizeTimer = () => {
  BrowserWindow.getAllWindows()[0].minimize();
  BrowserWindow.getAllWindows()[0].setSkipTaskbar(false); //so user can open it again
}


global.goToSettingsMode = () => {

};
/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  /*// Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }*/
  if (currentStatus.timerMode)
    global.goToTimerMode();
  else
    global.goToMainMode();
});

app.on('ready', async () => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  ) {
    await installExtensions();

    // Register quit key during development
    const ret = globalShortcut.register('CommandOrControl+Q', () => {
      app.quit();
    });

    if (!ret) {
      console.log('registration failed')
    }
  } else {
    // if production build

    // Make the app open on OS login
    app.setLoginItemSettings({
      openAtLogin: true
    });
  }

  global.goToMainMode();

  // @TODO: Use 'ready-to-show' event
  //        https://github.com/electron/electron/blob/master/docs/api/browser-window.md#using-ready-to-show-event
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  ////// Disabled //////
  // const menuBuilder = new MenuBuilder(mainWindow);
  // menuBuilder.buildMenu();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
});
