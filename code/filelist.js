/* File Chooser
   File input replacement with path and default value
   for local use of JavaScript on the desktop.
   (c) 2012-2017 By Denis Sureau.
   
   License LGPL 3.0.
   Free to use provided this copyright notice is not removed.

   Requires:
   - Node.js or Electron.
   - A WebSocket connection opened with the server.
   - The explorer.js module.
*/

const {ipcRenderer} = top.require('electron')        

var currentpath = [];
var insidezip = [];
var elementToSelect = null;
var elementToOffset = null;
var ChooserDrag = null;
var customview = [];

// event

/*
ipcRenderer.on("filelist", (event, data) => {
    var jobj = JSON.parse(data);
    switch(jobj.type) {
      case 'dirinfo':  break;
      default:
        alert("File manager: Unknow command " + jobj.type);      
     }
});
*/

function sendFromInterface(a) {
    ipcRenderer.send("interface", JSON.stringify(a));
}


function pathJoin(path, filename)
{
  var last = path.slice(-1);
  if(last != '/' && last != '\\')
    return path + "/" + filename;
  return path + filename;
}

function replaceFilename(path, name)
{
  var lio = path.lastIndexOf("/");
  return path.slice(0, lio +1) + name;
}

/*
  Building the entry for a storage unit
*/ 

function buildDrive(pathname, id)
{
	var balise ="<div class='dir' onDblClick='chDir(\"" + pathname + "\",\"" + id + "\")' onClick='sel(this)' oncontextmenu='return dsel(this)'>";
  balise += '<img src="/images/drive.png">';
	balise += pathname;
	balise += "</div>";
	return(balise);
}

/*
  Building the entry for a directory
*/  

function buildDir(pathname, id)
{
	var balise ="<div class='dir' onDblClick='chDir(\"" + pathname + "\",\"" + id + "\")' onClick='sel(this)' oncontextmenu='return dsel(this)'>";
  balise += '<img src="images/dir.png">';
	balise += pathname;
	balise += "</div>";
	return(balise);
}

/*
  Building the entry for a file
*/  

function buildLink(filepath, fname, panelid, timesize, filedate, ext)
{
    filepath = filepath.replace(/\\/gi, '/');
    var sep = '/';
    if(filepath.slice(-1) == '/')   sep = '';
    var fpath = filepath + sep + fname;
    var balise ="<div class='file' data-url='"+ fpath + "' onDblClick='view(this, \"" + fpath+ "\",\"" + panelid + "\")' onClick='sel(this)' oncontextmenu='return rsel(this)'>";
    balise += '<img src="';
    ext=ext.toLowerCase();
    switch(ext)
    {
    case 'gif':
    case 'jpg':
    case 'png':
    case 'jpeg':
          balise += 'images/img.png';
          break;
    case 'htm':
    case 'html':
    case 'php':
    case 'asp':
          balise += 'images/web.png';
          break;  
    /*      
    case 'zip':
          balise += '/images/zip.png';
          break;
    case 'exe':
    case 'jar':
          balise += '/images/app.png';
          break; 
    */      
    case 'prj':
          balise += 'images/prj.png';
          break;
    case 'md':
          balise += 'images/md.png';
          break;            
    case 'steps':
          balise += 'images/steps.png';
          break;   
    case 'lstp':
          balise += 'images/lstp.png';
          break;
    case 'jvg':      
    case 'svg':                               
          balise += 'images/svg.png';
          break;
    case 'c':
    case 'cpp':
    case 'cs':
    case 'css':
    case 'h':    
    case 'hpp':
    case 'ini':    
    case 'java':    
    case 'jl':
    case 'js':
    case 'json':    
    case 'py':
    case 'rb':
    case 'sol':    
    case 'sql':
    case 'ts':    
    case 'xml': 
          balise += 'images/code.png';
          break;
    default:
          balise += 'images/doc.png'
    }
    balise += '">'; 
    balise += fname;
    balise += '<span class="timesize">' + timesize + ' ' + filedate + '</span>'; 
    balise += '</div>';
    return(balise);
}



/* File Display
  Display a list of files and directories.
  Filtered to images.
  - Call buildLink on images.
  - Call buildDir on directories.
  
  Input: the id of the tag to store the list, 
  and the list as an array of name and the common path.

*/


/*
  Displays a list of files and dirs.
  Called by the interface when a 'dirdata' event is received
  from the server.
*/

var SORT_BY_NAME = 0;
var SORT_BY_SIZE = 1;
var SORT_BY_DATE = 2;

function sortBySize(a, b) {
  if(a[0] == 'dir') { 
    if(b[0] == 'dir') return 0;
    return -1;
  }
  if(b[0] == 'dir') return 1;
  return parseInt(a[2]) - parseInt(b[2]);
}

function sortByDate(a, b) {
  if(a[0] == 'dir') { 
    if(b[0] == 'dir') return 0;
    return -1;
  }
  if(b[0] == 'dir') return 1;
  var ad = a[3];
  var bd = b[3];
  var astr = parseInt(ad.substr(6,4) + ad.substr(3, 2) + ad.substr(0, 2));
  var bstr = parseInt(bd.substr(6,4) + bd.substr(3, 2) + bd.substr(0, 2));
  if(astr < bstr) return -1;
  if(astr > bstr) return 1;
  return 0;
}

function fileList(jobj, sortMode)
{
	var target = jobj.target;
	insidezip[target]=jobj.iszip;
	var d = document.getElementById(target);
	var extmask = jobj.extmask; 
	var filepath = jobj.path;
	var fpathid = target + "path";
	var fpath = document.getElementById(fpathid);
	fpath.value = filepath;
  
	var listid = target + "list";
	var dir = jobj.list;
    switch(sortMode) {
    case SORT_BY_SIZE:
      dir.sort(sortBySize);
      break;
    case SORT_BY_DATE:
      dir.sort(sortByDate);
      break;  
    default: break;
    }
	var page = "<div class='filechooser'>";
	page += "<div class='flist' id='"+ listid +"' tabindex='0'>";
	var dirlist = "";
	var filelist ="";
	
	for(var i = 0; i < dir.length; i++)
	{
		var item = dir[i];
		var type = item[0];
		var name = item[1];

		if(type=='dir')
		{
			dirlist += buildDir(name, target) + "<br>";
		}
		else
		{
			var timesize = item[2];
            var filedate = item[3];    
			var p = name.lastIndexOf('.');
			var ext = name.slice(p + 1);
			if(extmask && ext != extmask) continue; 
			filelist += buildLink(filepath, name, target, timesize, filedate, ext) + "<br>";
		}
	}
	
	page += dirlist;
	page += filelist;
	page += "</div>";
	page += "</div>";
	d.innerHTML = page;

	if(elementToSelect != null)
	{
		if(elementToSelect == '*') setFirstSelected(target);
		else
		{
			chooserLastSelected = null;
			elementToSelect = getElementByName(elementToSelect, target);
			sel(elementToSelect);
		} 
	}     
	elementToSelect = null;
	elementToOffset = null;

	var currdiv = document.getElementById(listid);
	currdiv.focus();
}

// set entries draggables

function setDrag(id)
{
  var lid = document.getElementById(id);
  var follow = lid.firstChild;
  follow.setAttribute('draggable', true);
  while(follow = follow.nextSibling) {
    follow.setAttribute('draggable', true);
    follow.addEventListener('dragstart', function(evnt) {
      evnt.dataTransfer.effectAllowed = 'copy';
      if(!isSelected(this)) {
        deselectAll(this.parentNode);
        setSelected(this);
      }  
      return false;
    }, false);    
  }  
  return;
}

// change dir called by the interface

function chDir(filepath, target)
{    
	if(filepath.slice(0, 8) == "file:///")
	filepath = filepath.slice(8);
  	var a = {
        'file': 'code/filelist.js', 
        'command': 'chdir', 
        'path': filepath,
        'target': target 
    };
    sendFromInterface(a);
}

function unlocalize(filepath)
{
 	if(filepath.slice(0, 8) == "file:///") return(filepath.slice(8));
    return(filepath);    
}      

function noHTMLchars(s){
    s = s.replace(/&lt;/g, '<');
    s = s.replace(/&gt;/g, '>');
    s = s.replace(/&quot;/g, '"');
    s = s.replace(/&copy;/g, '©');
    return s.replace(/&amp;/g, '&');
}

function view(element, filepath, panelid, forcePage)
{
  if(insidezip[panelid]) // always displayed like a page
  {
    var filename = getNameSelected(element);
    var archive = document.getElementById(panelid +'path').value; 
    var a = {  
         'command': 'textinzip',
         'archive': archive,
         'entryname': filename
     };
    sendFromInterface(a);    
    return;
  }   
  filepath = replaceFilename(filepath, getNameSelected(element));  
  var p = filepath.lastIndexOf('.');
  var ext = filepath.slice(p + 1);
  
  if(forcePage) ext ='';
  
  for(var cv in customview)
  {
	 if(ext == cv)
	 {
		var a = customview[cv];
		a.params.filename = filepath;
		a.params.path = getNameSelected(element);
		a.params.target = panelid;
        sendFromInterface(a);
		return;
	 }
  }
  
  filepath = noHTMLchars(filepath);
  
  switch(ext.toLowerCase())
  {
    case 'gif':
    case 'png':
    case 'jpg':
    case 'jpeg':  
      var a = { 
        'command': 'loadimage', 'path': filepath, 'target': panelid  };
        sendFromInterface(a);
      break;
    case 'zip':
        var a = { 
         'command': 'viewzip', 'path': filepath, 'target': panelid };
        sendFromInterface(a);
      break;
    case 'exe':
    case 'jar':
      var a = {  
         'command': 'execute', 'filename': null, 'path': filepath,'target': panelid };
      sendFromInterface(a);
      break;
    case 'prj':
          openProject(element);
          break; 
    case 'c':
    case 'cpp':
    case 'cs':
    case 'css':
    case 'h':    
    case 'hpp':
    case 'ini':    
    case 'java':    
    case 'jl':
    case 'js': 
    case 'json':       
    case 'py':
    case 'rb':
    case 'sol':    
    case 'sql':
    case 'svg': 
    case 'ts':   
    case 'xml':    
     	edit(element);
      break;      
    default:
     	if(filepath.slice(0, 5) != 'http:')
	     filepath = "file:///" + filepath;
      var a = { 'command': 'viewtext', 'path': filepath, 'target': panelid };
      sendFromInterface(a);
      break;    
  }  
        
}

function nodeClear(node)
{
  var child = node.firstChild;
  while(child)
  {
    child.className="file";
    child = child.nextSibling;
  }  
}

function deselectAll(parent)
{
	var child = parent.firstChild; // child of flist
	while(child)
	{
    if(child.className == 'entrybold')
		{
            child.className="file";  
		}
		child = child.nextSibling;
	}  	  
}

var chooserLastSelected = null;

function setSelected(element)
{
    element.className="entrybold";	     
}

function isSelected(element) {
  return element.className=="entrybold"; 
}


var SyncPath = undefined; // to fill input or not

function sel(element)
{
  if(element.className == 'entrybold')
  {
    element.className="file";
  }
  else
  {
    deselectAll(element.parentNode);
    element.className="entrybold"; 
    var filepath =  element.getAttribute("data-url"); 
    if(filepath != null) {
        SyncPath.value = filepath;
        var pbutton = document.getElementById("prjButton");
        var ibutton = document.getElementById("incButton");
        if(pbutton instanceof HTMLInputElement) { 
            var p = filepath.lastIndexOf('.');
            var ext = filepath.slice(p + 1);
            if(ext == "prj") {       
                pbutton.style.display="inline-block"
                ibutton.style.display="none"
            } 
            else {
                pbutton.style.display="none"
                ibutton.style.display="inline-block"
            }
     }
    }
  }    
  chooserLastSelected = element;
}

/*
  Context menu
*/  


var xMousePosition = 0;
var yMousePosition = 0;

document.onmousemove = function(e)
{
  xMousePosition = e.clientX + window.pageXOffset;
  yMousePosition = e.clientY + window.pageYOffset;
};

function pointFile(element)
{
  deselectAll(element.parentNode);
  element.className='entrybold';
	var parent = element.parentNode.parentNode.parentNode; 
  return parent.id; 	
}

function getPointedContent(panelName)
{
	var slist = getSelected(panelName);
	if(slist.length != 1)
	{
		alert(slist.length + " selected. Select just one file or directory to rename, please.");
		return null;
	}
	return slist[0];
}


function edit(element)
{
  var f = element.getAttribute("data-url");
  parent.AEditFileName = f
  parent.load()
  config.dir = extractDir(f)
  saveIni("aedit.ini.js")
  parent.restartEditor()    
}


function openProject(element) {
  var pname =  element.getAttribute("data-url");
  parent.loadProject(pname)  
  parent.restartEditor()
}  

function open(element, forcePage)
{
    var isIExplorer = false || !!document.documentMode;
    var target = pointFile(element);
    var fpathid = target + "path";
    var fpath = document.getElementById(fpathid);
    filepath = fpath.value;
    var fname =  getNameSelected(element);
    if(!isIExplorer)
        filepath = filepath.replace(/\\/gi, '/');
    var sep = '/';
    if(filepath.slice(-1) == '/') sep = '';
    if(filepath.slice(-1) == '\\') sep = '';
    var fname = filepath + sep + fname;
    var a = { 
        'command': 'viewtext',
        'path': fname, 
        'open': true,
        'ext': ''
    };
    sendFromInterface(a)    
}


function rsel(element)
{
  var x = document.getElementById('ctxmenu1');
  if(x) x.parentNode.removeChild(x); 
  
  var parent = element.parentNode; 
  var isImage;
  var ext = getNameSelected(element);
  var epos = ext.lastIndexOf('.');
  ext = ext.slice(epos + 1);  
  switch(ext.toLowerCase())
  {
    case 'gif':
    case 'png':
    case 'jpg':
    case 'jpeg':
      isImage = true;
      break;
    default: 
      isImage = false;
  }
 
  var d = document.createElement('div');
  parent.appendChild(d);
  
  d.id = 'ctxmenu1';
  d.className = 'ctxmenu';
  d.style.left = xMousePosition + "px";
  d.style.top = yMousePosition + "px";
  d.onmouseover = function(e) { this.style.cursor = 'pointer'; } 
  d.onclick = function(e) { parent.removeChild(d);  }
  document.body.onclick = function(e) {
    try { parent.removeChild(d);}
    catch(e) {}   
  }
  
  var p = document.createElement('p');
  d.appendChild(p);
  p.onclick=function() { open(element, false) };
  p.setAttribute('class', 'ctxline');
  p.innerHTML = "Open"; 
  
 
  if(isImage)
  {
    var pi = document.createElement('p');
    d.appendChild(pi);
    pi.onclick=function() { open(element, true); };
    pi.setAttribute('class', 'ctxline');
    pi.innerHTML = "Full view";    
  }

    
  var p2 = document.createElement('p');
  d.appendChild(p2);
  p2.onclick=function() { edit(element) };  
  p2.setAttribute('class', 'ctxline');
  p2.innerHTML = "Edit"; 

  var target = pointFile(element);
  
  var p = document.createElement('p');
  d.appendChild(p);
  p.onclick=function() { elementRename(element, target); };
  p.setAttribute('class', 'ctxline');
  p.innerHTML = "Rename"; 

  return false;
}

function openDir(element)
{
  var target = pointFile(element);
  var dirname = getNameSelected(element);
  chDir(dirname, target, false);
}


function dirinfo(element)
{
  var target = pointFile(element);
  var fname = getNameSelected(element);
	var a = { 'command': 'dirinfo', 'target': target, 'filelist': [fname] };  
	sendFromInterface(a);
}

function dsel(element)
{
  var x = document.getElementById('ctxmenu2');
  if(x) x.parentNode.removeChild(x); 
  var parent = element.parentNode; 

  var d = document.createElement('div');
  parent.appendChild(d);
  d.id = 'ctxmenu2';
  d.className = 'ctxmenu';
  d.style.left = xMousePosition + "px";
  d.style.top = yMousePosition + "px";
  d.onmouseover = function(e) { this.style.cursor = 'pointer'; } 
  d.onclick = function(e) { parent.removeChild(d);  }
  document.body.onclick = function(e) {
    try { parent.removeChild(d);}
    catch(e) {}   
  }
  
  var p = document.createElement('p');
  d.appendChild(p);
  p.onclick=function() { openDir(element) };
  p.setAttribute('class', 'ctxline');
  p.innerHTML = "Open";  
    
  var p2 = document.createElement('p');
  d.appendChild(p2);
  p2.onclick=function() { dirinfo(element) };  
  p2.setAttribute('class', 'ctxline');
  p2.innerHTML = "Informations"; 
  
  var p3 = document.createElement('p');
  d.appendChild(p3);
  p3.onclick=function() { elementRename(element, pointFile(element)); };
  p3.setAttribute('class', 'ctxline');
  p3.innerHTML = "Rename";   
  
  return false;
}


/*
  getSelected(panelname)
  Return the list of selected items in a panel
  Items are <div> tags
*/

function getSelected(source)
{      
  var source = document.getElementById(source);
	var parent = source.firstChild;	// chooser
	var slist = new Array();
	var child = parent.firstChild.firstChild; // flist.filename
	while(child)
	{
		if(child.className == 'entrybold')
		{
			slist.push(child);
		}
		child = child.nextSibling;
	}  	
	return slist;  
}

function setFirstSelected(target)
{
  var panel = document.getElementById(target);
  var element = panel.firstChild.firstChild.firstChild;
  chooserLastSelected = null;
  sel(element);
}

/* Extract name of selected item as displayed */

function getNameSelected(item)
{
    var data = item.innerHTML;
    var p = data.indexOf('>');
    var name = data.slice(p + 1);
    p = name.indexOf('<');
    if(p > 0)
      name = name.slice(0, p);
    return name;  
}

/* Get element from name in list */

function getElementByName(name, source)
{
  var s = document.getElementById(source);
	var child = s.firstChild.firstChild.firstChild; // flist.filename
	while(child)
	{
		if(getNameSelected(child) == name)
			return child;
  	child = child.nextSibling;
	}  	
	return null;  
}

/* check if directory from picture */

function isDirectory(item)
{
    var img = item.firstChild;
    return img.src.indexOf("dir.png") != -1;
}

/*
  getSelectedNames(panelname)
  Return the list of selected filename or dirnames
*/

function getSelectedNames(source)
{
    var namelist = new Array();
    var slist = getSelected(source);
	for(i = 0; i < slist.length; i++)
	{
        var elem = slist[i].innerHTML;
        var p = elem.indexOf('>');
        elem = elem.slice(p+1);
        p = elem.indexOf('<');
        if(p > 0)
            elem = elem.slice(0, p);
        if(elem=='') continue;      
        namelist.push(elem);
    }
	return namelist;    
}

/*
  selectToDelete(panelname)
  Cross files selected to be deleted
*/  

function selectToDelete(source)
{
  var slist = getSelected(source);
	for(i = 0; i < slist.length; i++)
	{
		var element = slist[i];
        element.style.backgroundColor = 'white';
        element.style.textDecoration = 'line-through';
        element.style.color = 'red';
	}
}

var isCTRL = false;
var isSHIFT = false;
document.onkeyup=function(evt)
{
	if(!evt.ctrlKey) isCTRL=false;
    if(!evt.shiftKey) isSHIFT = false;
}

document.onkeydown=function(evt)
{
  if(evt.shiftKey) isSHIFT = true;
              else isSHIFT = false;
  var code = (evt.keyCode || evt.which);
  switch(code)
  {  
      case 13:
        return true;
      case 37: // left
      case 38: // up
      case 40: // down
        evt.preventDefault(); 
        evt.returnValue = false;     
        passHandler(evt, code);
        return true;    
  }
  
  if(evt.ctrlKey)
  {
    isCTRL = true;

    switch(code)
    {
      case 17: // ctrl key
        break;
		  case 67:  // ctrl-c

        evt.preventDefault();
        evt.returnValue = false;
        passHandler(evt, code);
        isCTRL = false;
        break;
      case 73: // ctrl-i
        break;  
      case 85: // ctrl-u
        evt.preventDefault();
        evt.returnValue = false;
        passHandler(evt, code);
        isCTRL = false;
        break;
      default:
        break;       
    }
    return true;
  }
  
  isCTRL = false;
  return true;
}

// Drive selection

var sto = null;
function chgPath(elem) {
    if(sto != null) clearTimeout(sto);
    sto = setTimeout(function() {
        var npath = elem.value;
        var lastchar = npath.substr(npath.length - 1)
        if(lastchar == "/" || lastchar == "\\" || lastchar == ":") {  
            if(lastchar == ":") npath += "/";
            config.dir = npath;
            chDir(npath, 'lcontent');
            saveIni("aedit.ini.js")
        }
    }, 1500);
}

function alreadyInList(parent, name)
{
	var child = parent.firstChild; // child of flist
	while(child)
	{
        if(getNameSelected(child) == name)
            return true;
		child = child.nextSibling;
	}
    return false;
}
