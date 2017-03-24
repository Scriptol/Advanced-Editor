/*
  Advanced Editor Node server
	(c) 2012-2017 Denis Sureau
	Free, open source under the GPL 3 License.
*/

const fs = require("fs");
const {app, BrowserWindow, ipcMain} = require('electron');
const explorer = require("explorer");

var mainEvent;

ipcMain.on('interface', (event, data) => {
   //console.log("Received: " + data) 
   mainEvent = event;
   var jo = JSON.parse(data);
   jo.event = event;
   explorer.shell(jo);
})

// Electron part

console.log("Starting Electron...")

let win = explorer.win;
function createWindow () {
  win = new BrowserWindow({ 
    'width': 1060, 
    'height': 680, 
    'show':false,
    'backgroundColor': '#000',
    "webPreferences" : {
        "nodeIntegration":true,
        "webSecurity": false
    }       
  });
  win.setMenu(null)
  //win.webContents.openDevTools()
  
  process.resourcesPath = __dirname
  console.log("Working directory : " + process.resourcesPath)

  win.loadURL(__dirname + '/aedit.html');
  win.show()
  win.on('closed', () => { win = null })
}

process.on('uncaughtException', function (error) { })

app.on('ready', createWindow)
app.on('quit', function () { });
app.on('window-all-closed', () => {
  console.log("Windows closed, exit.")
  app.quit()
  process.exit(1)
})
app.on('activate', () => {
  if (win === null)  createWindow()
})

