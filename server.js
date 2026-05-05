/*
    Advanced Editor
    (c) 2016-2026 Denis Sureau
    scriptol.com / scriptol.fr
    License Creative Common
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { exec } = require('child_process');
const net = require("net");

var PORT = 8080;
const debug = false;
var operatingSystem = "win";

function createHttpServer() {
    return http.createServer((req, res) => {
        let filePath = '.' + req.url;
        if (filePath === './') filePath = './aeditor.html';

        const extname = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.xml': 'application/xml',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end("404 : File not found");
                } else {
                    res.writeHead(500);
                    res.end(`Server error : ${error.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });
}


function safeDirectoryCheck(inputPath) {
    const normalized = path.normalize(inputPath);
    let realPath = normalized;
    const exists = fs.existsSync(normalized);
    if (!exists) {
        return {
            exists: false,
            original: inputPath,
            normalized,
            resolved: normalized
        };
    }
    try {
        realPath = fs.realpathSync.native(normalized);
    } catch (err) {
        console.warn("Enable to resolve the real path : ", err.message);
    }
    const absolute = path.resolve(realPath);
    return {
        exists: true,
        original: inputPath,
        normalized,
        real: realPath,
        resolved: absolute
    };
}

function checkPath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        console.error("Error: " + inputPath);
        return;
    } 
    if(inputPath.length == 2 && inputPath[1]==":") {
        inputPath += "/"
    }
    //let normalizedPath = path.win32.normalize(inputPath);
    const info = safeDirectoryCheck(inputPath);
    return info
}


// Server WebSocket (Replace ipcMain)
function shellSocket(server) {

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log("Client connected");
    let missingDir = ""

    // get list of drives
    const sendDriveList = () => {
        if(operatingSystem != "win") {
            const drives = ["/"]
            ws.send(JSON.stringify({
                type: "DRIVE_LIST",
                drives
            }));  
            return      
        }
    exec('powershell -command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Name"', 
    (err, stdout) => {
        if (err) {
            ws.send(JSON.stringify({
                type: "ERROR",
                message: "Unable to list drives"
            }));
            return;
        }

        const drives = stdout
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => /^[A-Z]$/i.test(l))   // garde C, D, P
            .map(l => l + ":");                // transforme en C:, D:, P:

        ws.send(JSON.stringify({
            type: "DRIVE_LIST",
            drives
        }));
    });
    };

    sendDriveList();    

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'LIST_FOLDER') {
            let info = checkPath(data.path)
            if (!info.exists) {
                console.error("Missing :", info.resolved);
                missingDir = info.resolved
                ws.send(JSON.stringify({
                    type: "ASK_MKDIR",
                    dir: info.resolved
                }));
                return
            } 
            else {
                realPath = info.resolved
                console.log(`Original path : ${data.path} -> Real : ${realPath}`);            
            }           
            
            let fullPath = path.resolve(realPath);

            try {
                const items = fs.readdirSync(fullPath);

                const filesWithInfo = items.map(itemName => {
                    const absolutePath = path.join(fullPath, itemName);
                    let isDirectory = false;
                    try {                            
                        isDirectory = fs.statSync(absolutePath).isDirectory();
                    } catch (e) {
                        // Error permissions, etc.
                        console.error("Error stat at:", absolutePath);
                    }
                    return {
                        name: itemName,                            
                        isDirectory: isDirectory
                    };
                });
                ws.send(JSON.stringify({ 
                    type: 'directory-list',
                    path: fullPath,
                    files: filesWithInfo 
                }));
            }
            catch (err) {
                ws.send(JSON.stringify({ 
                    type: 'error',
                    message: "Enable to open the folder : " + err.message 
                }));
            }
        }
        else if (data.type === 'DIALOG_FILES') {  
            let info = checkPath(data.path)
            let fullPath = path.resolve(info.resolved);               
            try {
                const items = fs.readdirSync(fullPath);
                const filesWithInfo = items.map(itemName => {
                    const absolutePath = path.join(fullPath, itemName);
                    let isDirectory = false;
                    try {                            
                        isDirectory = fs.statSync(absolutePath).isDirectory();
                    } catch (e) {
                        console.error("Error stat at:", absolutePath);
                    }
                    return {
                        name: itemName,                            
                        isDirectory: isDirectory
                    };
                });
                ws.send(JSON.stringify({ 
                    type: 'FILE_LIST',
                    path: fullPath,
                    files: filesWithInfo 
                }));
            }
            catch (err) {
                ws.send(JSON.stringify({ 
                    type: 'error',
                    message: "Enable to open the folder : " + err.message 
                }));
            }
         
        }   
        else if (data.type === 'SAVE_DOC') {
            fs.writeFile(data.filename, data.content, 'utf8', (err) => {
                if (err) {
                    console.error("File not saved:", err);
                    ws.send(JSON.stringify({
                        type: "status",
                        content: "File ${data.filename} not saved !"
                    }));
                } else {
                    console.error(data.filename + "saved");
                    ws.send(JSON.stringify({
                        type: "status",
                        content: data.filename + " saved"
                    }));                        
                }
            });
        }         
        else if (data.type === 'MAKE_DIR') {
            fs.mkdirSync(missingDir, { recursive: true }); 
            ws.send(JSON.stringify({ 
                type: 'directory-list',
                currentPath: missingDir,
                files: [] 
            }));                        
        }    
        else if (data.type === 'GET_CONTENT') {
            const filePath = path.resolve(data.path);

            fs.readFile(filePath, 'utf8', (err, content) => {
                if (err) {
                    ws.send(JSON.stringify({
                        type: "status",
                        content: "Error : Enable to read the file."
                    }));
                    return;
                }

                const ext = path.extname(filePath).substring(1);
                ws.send(JSON.stringify({
                    type: "openDoc",
                    filename: data.path,
                    content: content,
                    ext: ext,
                    project: data.project || null
                }));
            });
        }  
        else if(data.type=="SAVE_CONFIG") {
            var fullpath = path.join(__dirname, data.filename);
            var result = fs.writeFileSync(fullpath, data.content);
            var message = "Setup " + (result ? 'Not saved' : 'Saved') + ' into ' + fullpath;   
            console.log(message)         
        }
        else if(data.type=="QUIT")  {
            console.log("Bye...");
            process.exit(0);
        }
        else if(data.command == "mouse") {
        }
    });  //ws
}); // wss
} // function shellServer

function isPortFree(port) {
    return new Promise(resolve => {
        const socket = new net.Socket();

        socket.once("connect", () => {
            socket.destroy();
            resolve(false); // port occupé
        });

        socket.once("error", err => {
            if (err.code === "ECONNREFUSED") {
                resolve(true); // port libre
            } else {
                resolve(false);
            }
        });

        socket.connect(port, "127.0.0.1");
    });
}

async function findFreePort(start = 8080) {
    let port = start;
    while (!(await isPortFree(port))) {
        port++;
    }
    return port;
}


async function createServerOnFreePort(start = 8080) {
    const port = await findFreePort(start);
    const server = createHttpServer();
    await new Promise(resolve => server.listen(port, resolve));
    return { server, port };
}

(async () => {
    const { server, port } = await createServerOnFreePort(8080);

    shellSocket(server);

    const url = `http://localhost:${port}`;
    console.log(`Started on ${url}`);

    setTimeout(() => {
        if (process.platform === "win32") {
            exec(`start chrome --app=${url}`);
        } else if (process.platform === "darwin") {
            operatingSystem="mac"
            exec(`open -a "Google Chrome" --args --app=${url}`);
        } else {
            operatingSystem="lin"
            exec(`google-chrome --app=${url}`);
        }
    }, 300);
})();

