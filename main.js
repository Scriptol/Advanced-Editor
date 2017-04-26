/*
  Advanced Editor Node server
	(c) 2012-2017 Denis Sureau
	Free, open source under the GPL 3 License.
*/

const fs = require("fs"),
      url = require("url");
const {app, BrowserWindow, ipcMain} = require('electron');
const explorer = require("explorer");

var mainEvent;

ipcMain.on('interface', (event, data) => {
   mainEvent = event;
   var jo = JSON.parse(data);
   jo.event = event;
   explorer.shell(jo);
})

// Electron part

console.log("Starting Electron...")

function createWindow () {
  var win = new BrowserWindow({ 
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
  
  explorer.setRoot(__dirname)
  console.log("Working directory : " + explorer.getRoot())

  win.loadURL(url.format({
    pathname: __dirname + "/aedit.html",
    protocol: 'File',
    slashes: true
  }))    
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

