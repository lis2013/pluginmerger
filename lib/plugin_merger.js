var fs = require("fs");
var path = require("path");


function getContents(file){
 var buffer = fs.readFileSync(file);
 var startIndex = 0;
 //remove utf8 bom header
 if( buffer.length > 3 && buffer[0] == 0xef && buffer[1] == 0xbb && buffer[2] == 0xbf){
     startIndex = 3;
 }
 return buffer.toString('utf8', startIndex);
}

function writeContents(files, fileName, contents, debug){
    if(debug){
        contents += '\n@sourceURL=' + fileName;
        contents = 'eval(' + JSON.stringify(contents) + ')';
        var handler = 'console.log("exception:in' + fileName + ':"+ e)';
        handler += 'console.log(e.stack)';
        contents = 'try{' + contents + '}catch(e){' + handler + '}';
    }
    else{
        contents = '//file:' + fileName + '\n' + contents;
    }
    files.push(contents);
}

function writeScriptsToCordovaJs(scripts){
    var cordovaJs = getContents(_cordovaJsPath);
    cordovaJs = cordovaJs.replace(new RegExp("\r\n","gm"), "\n");
    var lines = cordovaJs.split(/[\r\n]/);
    var splitLine = 0;
    for(; splitLine < lines.length; splitLine++){
        if(lines[splitLine].match(/window.cordova\s*=\s*require\('cordova'\);/)){
            break;
        }
    }
    lines.splice(splitLine - 1, 0, scripts);
    fs.writeFileSync( _cordovaJsPath, lines.join('\n'));
}

//Strips the license header. Basically only the first multi-line comment up to to the closing */
function stripLicenses(contents, fileName) {
    contents = contents.replace(new RegExp("\r\n","gm"), "\n");
    var ls = contents.split(/[\r\n]/);
    if(ls[0].match(/\s*\*$/)){
        ls[0] = ls[0].replace(/\s*\/\s*\*$/,'');
        var first_line  =  ls[0];
        ls.shift();
    }

    while (ls[0]) {
        if (ls[0].match(/^\s*\/\*/) || ls[0].match(/^\s*\*/)) {
            ls.shift();
        }
        else if (ls[0].match(/^\s*\*\//)) {
            ls.shift();
            break;
        }
        else {
            console.log("WARNING: file name " + fileName + " is missing the license header");
            break;
        }
    }
    if(first_line){
        ls.splice(0, 0, first_line);
    }
    return ls.join('\n');
}

function stripHeader(contents){
    contents = contents.replace(new RegExp("\r\n","gm"), "\n");
    var ls = contents.split(/[\r\n]/);
    ls[0] = ls[0].replace( /^(cordova\.)/,'');
    return ls.join('\n');
}

function getContentWillWrited(fullPath){
    var c = getContents(fullPath);
    c = stripLicenses(c, fullPath);
    c = stripHeader(c);
    return c;
}

/**
 * merge plugin js to cordvoa.js to facility engine inner cordvoa.js
 * @param cordovaJsPath
 */
module.exports = function(cordovaJsPath){
 if( !fs.existsSync( cordovaJsPath)){
     console.log(cordovaJsPath + " not exists!");
     return;
 }
 var time = new Date().valueOf();
 _cordovaJsPath = cordovaJsPath;
 var dirName = path.dirname( _cordovaJsPath);
 var cordova_plugins_js = getContentWillWrited(path.join( dirName, "cordova_plugins.js" ));
 var pluginScripts = [];
 writeContents(pluginScripts, "cordova_plugins.js", cordova_plugins_js, false);
 var rex = /module.exports\s*=\s*([\s\S]*])/;
 var r = cordova_plugins_js.match(rex);
 if(!r || r.length < 2 ){
     console.log("extract plugin metadata error");
     return;
 }

 var obj = JSON.parse( r[1]);

 obj.forEach(function(entry){
     var fullPath = path.join(dirName, entry.file);
     var c = getContentWillWrited(fullPath);
     writeContents(pluginScripts, entry.file, c, false);
 });

 var scripts = pluginScripts.join('\n');
 writeScriptsToCordovaJs( scripts );
 var end = new Date().valueOf() - time;
 console.log('merge plugin js take time:' + end + ' ms');
};