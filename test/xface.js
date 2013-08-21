// Platform: android
// 3.0.0rc1-1-g1965a39
/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 
     http://www.apache.org/licenses/LICENSE-2.0
 
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
*/
;(function() {
var CORDOVA_JS_BUILD_LABEL = '3.0.0rc1-1-g1965a39';
// file: lib/scripts/require.js

var require,
    define;

(function () {
    var modules = {},
    // Stack of moduleIds currently being built.
        requireStack = [],
    // Map of module ID -> index into requireStack of modules currently being built.
        inProgressModules = {},
        SEPERATOR = ".";



    function build(module) {
        var factory = module.factory,
            localRequire = function (id) {
                var resultantId = id;
                //Its a relative path, so lop off the last portion and add the id (minus "./")
                if (id.charAt(0) === ".") {
                    resultantId = module.id.slice(0, module.id.lastIndexOf(SEPERATOR)) + SEPERATOR + id.slice(2);
                }
                return require(resultantId);
            };
        module.exports = {};
        delete module.factory;
        factory(localRequire, module.exports, module);
        return module.exports;
    }

    require = function (id) {
        if (!modules[id]) {
            throw "module " + id + " not found";
        } else if (id in inProgressModules) {
            var cycle = requireStack.slice(inProgressModules[id]).join('->') + '->' + id;
            throw "Cycle in require graph: " + cycle;
        }
        if (modules[id].factory) {
            try {
                inProgressModules[id] = requireStack.length;
                requireStack.push(id);
                return build(modules[id]);
            } finally {
                delete inProgressModules[id];
                requireStack.pop();
            }
        }
        return modules[id].exports;
    };

    define = function (id, factory) {
        if (modules[id]) {
            throw "module " + id + " already defined";
        }

        modules[id] = {
            id: id,
            factory: factory
        };
    };

    define.remove = function (id) {
        delete modules[id];
    };

    define.moduleMap = modules;
})();

//Export for use in node
if (typeof module === "object" && typeof require === "function") {
    module.exports.require = require;
    module.exports.define = define;
}

// file: lib/cordova.js
define("cordova", function(require, exports, module) {


var channel = require('cordova/channel');

/**
 * Listen for DOMContentLoaded and notify our channel subscribers.
 */
document.addEventListener('DOMContentLoaded', function() {
    channel.onDOMContentLoaded.fire();
}, false);
if (document.readyState == 'complete' || document.readyState == 'interactive') {
    channel.onDOMContentLoaded.fire();
}

/**
 * Intercept calls to addEventListener + removeEventListener and handle deviceready,
 * resume, and pause events.
 */
var m_document_addEventListener = document.addEventListener;
var m_document_removeEventListener = document.removeEventListener;
var m_window_addEventListener = window.addEventListener;
var m_window_removeEventListener = window.removeEventListener;

/**
 * Houses custom event handlers to intercept on document + window event listeners.
 */
var documentEventHandlers = {},
    windowEventHandlers = {};

document.addEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof documentEventHandlers[e] != 'undefined') {
        if (e =='deviceready'){
            function my_handler(){
                var rex = "data=(.*)";
                d = location.href.match( rex );
                if (d && d.length > 1 )
                    handler({"data":d[1]});
                else{
                    handler();
                }
            }
            documentEventHandlers[e].subscribe(my_handler);
            return;
        }
        documentEventHandlers[e].subscribe(handler);
    } else {
        m_document_addEventListener.call(document, evt, handler, capture);
    }
};

window.addEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    if (typeof windowEventHandlers[e] != 'undefined') {
        windowEventHandlers[e].subscribe(handler);
    } else {
        m_window_addEventListener.call(window, evt, handler, capture);
    }
};

document.removeEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubscribing from an event that is handled by a plugin
    if (typeof documentEventHandlers[e] != "undefined") {
        documentEventHandlers[e].unsubscribe(handler);
    } else {
        m_document_removeEventListener.call(document, evt, handler, capture);
    }
};

window.removeEventListener = function(evt, handler, capture) {
    var e = evt.toLowerCase();
    // If unsubscribing from an event that is handled by a plugin
    if (typeof windowEventHandlers[e] != "undefined") {
        windowEventHandlers[e].unsubscribe(handler);
    } else {
        m_window_removeEventListener.call(window, evt, handler, capture);
    }
};

function createEvent(type, data) {
    var event = document.createEvent('Events');
    event.initEvent(type, false, false);
    if (data) {
        for (var i in data) {
            if (data.hasOwnProperty(i)) {
                event[i] = data[i];
            }
        }
    }
    return event;
}

if(typeof window.console === "undefined") {
    window.console = {
        log:function(){}
    };
}
// there are places in the framework where we call `warn` also, so we should make sure it exists
if(typeof window.console.warn === "undefined") {
    window.console.warn = function(msg) {
        this.log("warn: " + msg);
    }
}

var cordova = {
    define:define,
    require:require,
    /**
     * Methods to add/remove your own addEventListener hijacking on document + window.
     */
    addWindowEventHandler:function(event) {
        return (windowEventHandlers[event] = channel.create(event));
    },
    addStickyDocumentEventHandler:function(event) {
        return (documentEventHandlers[event] = channel.createSticky(event));
    },
    addDocumentEventHandler:function(event) {
        return (documentEventHandlers[event] = channel.create(event));
    },
    removeWindowEventHandler:function(event) {
        delete windowEventHandlers[event];
    },
    removeDocumentEventHandler:function(event) {
        delete documentEventHandlers[event];
    },
    /**
     * Retrieve original event handlers that were replaced by Cordova
     *
     * @return object
     */
    getOriginalHandlers: function() {
        return {'document': {'addEventListener': m_document_addEventListener, 'removeEventListener': m_document_removeEventListener},
        'window': {'addEventListener': m_window_addEventListener, 'removeEventListener': m_window_removeEventListener}};
    },
    /**
     * Method to fire event from native code
     * bNoDetach is required for events which cause an exception which needs to be caught in native code
     */
    fireDocumentEvent: function(type, data, bNoDetach) {
        var evt = createEvent(type, data);
        if (typeof documentEventHandlers[type] != 'undefined') {
            if( bNoDetach ) {
              documentEventHandlers[type].fire(evt);
            }
            else {
              setTimeout(function() {
                  // Fire deviceready on listeners that were registered before cordova.js was loaded.
                  if (type == 'deviceready') {
                      document.dispatchEvent(evt);
                  }
                  documentEventHandlers[type].fire(evt);
              }, 0);
            }
        } else {
            document.dispatchEvent(evt);
        }
    },
    fireWindowEvent: function(type, data) {
        var evt = createEvent(type,data);
        if (typeof windowEventHandlers[type] != 'undefined') {
            setTimeout(function() {
                windowEventHandlers[type].fire(evt);
            }, 0);
        } else {
            window.dispatchEvent(evt);
        }
    },

    /**
     * Plugin callback mechanism.
     */
    // Randomize the starting callbackId to avoid collisions after refreshing or navigating.
    // This way, it's very unlikely that any new callback would get the same callbackId as an old callback.
    callbackId: Math.floor(Math.random() * 2000000000),
    callbacks:  {},
    callbackStatus: {
        NO_RESULT: 0,
        OK: 1,
        CLASS_NOT_FOUND_EXCEPTION: 2,
        ILLEGAL_ACCESS_EXCEPTION: 3,
        INSTANTIATION_EXCEPTION: 4,
        MALFORMED_URL_EXCEPTION: 5,
        IO_EXCEPTION: 6,
        INVALID_ACTION: 7,
        JSON_EXCEPTION: 8,
        ERROR: 9
    },

    /**
     * Called by native code when returning successful result from an action.
     */
    callbackSuccess: function(callbackId, args) {
        try {
            cordova.callbackFromNative(callbackId, true, args.status, [args.message], args.keepCallback);
        } catch (e) {
            console.log("Error in error callback: " + callbackId + " = "+e);
        }
    },

    /**
     * Called by native code when returning error result from an action.
     */
    callbackError: function(callbackId, args) {
        // TODO: Deprecate callbackSuccess and callbackError in favour of callbackFromNative.
        // Derive success from status.
        try {
            cordova.callbackFromNative(callbackId, false, args.status, [args.message], args.keepCallback);
        } catch (e) {
            console.log("Error in error callback: " + callbackId + " = "+e);
        }
    },

    /**
     * Called by native code when returning the result from an action.
     */
    callbackFromNative: function(callbackId, success, status, args, keepCallback) {
        var callback = cordova.callbacks[callbackId];
        if (callback) {
            if (success && status == cordova.callbackStatus.OK) {
                callback.success && callback.success.apply(null, args);
            } else if (!success) {
                callback.fail && callback.fail.apply(null, args);
            }

            // Clear callback if not expecting any more results
            if (!keepCallback) {
                delete cordova.callbacks[callbackId];
            }
        }
    },
    addConstructor: function(func) {
        channel.onCordovaReady.subscribe(function() {
            try {
                func();
            } catch(e) {
                console.log("Failed to run constructor: " + e);
            }
        });
    }
};

// Register pause, resume and deviceready channels as events on document.
channel.onPause = cordova.addDocumentEventHandler('pause');
channel.onResume = cordova.addDocumentEventHandler('resume');
channel.onDeviceReady = cordova.addStickyDocumentEventHandler('deviceready');

module.exports = cordova;

});

// file: lib\common\extension\ams.js
define("cordova/plugin/ams", function(require, exports, module) {

/*
 Copyright 2012-2013, Polyvi Inc. (http://www.xface3.com)
 This program is distributed under the terms of the GNU General Public License.

 This file is part of xFace.

 xFace is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 xFace is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with xFace.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
  *该模块定义了xFace应用相关的一系列操作，包括应用的安装，运行，卸载，更新等
  *@module ams
  *@main
  */


/**
  * 该类定义了xFace应用管理的基础api，包括应用的安装、卸载、启动、关闭、更新等（Android, iOS, WP8）<br/>
  * 该类不能通过new来创建相应的对象，可以通过xFace.AMS来直接使用该类中定义的方法
  * @class AMS
  * @platform Android, iOS, WP8
  * @since 3.0.0
  */
var argscheck = require('cordova/argscheck');
var exec = require('cordova/exec');
var AMS = function(){
};

/**
 * 安装一个app（Android, iOS, WP8）
 * @example
        function successCallback(info) {
            console.log(info.appid);
            console.log(info.type);
        };

        function errorCallback(error) {
            console.log(error.appid);
            console.log(error.type);
            console.log(error.errorcode);
        };

        function statusChanged(status) {
            if (AmsState.INSTALL_INSTALLING == status.progress) {
                console.log("installing...");
            }

            if (AmsState.INSTALL_FINISHED == status.progress) {
                console.log("install was done!");
            }
        };

        xFace.AMS.installApplication ("geolocation.zip",successCallback，errorCallback, statusChanged);
 * @method installApplication
 * @param {String} packagePath              app安装包所在相对路径（相对于当前app的工作空间）
 * @param {Function} [successCallback]        成功时的回调函数
 * @param {Object} successCallback.info   与app相关信息object,每个object包含如下属性：
 * @param {Number} successCallback.info.type   操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String} successCallback.info.appid  app的id号
 * @param {Function} [errorCallback]          失败时的回调函数
 * @param {Object} errorCallback.error   包含错误信息的对象，每个object包含如下属性：
 * @param {Number} errorCallback.error.type  发生错误的ams操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String} errorCallback.error.appid  发生错误的app的id号
 * @param {Number} errorCallback.error.errorcode  错误码，具体错误码参考<a href="../classes/AmsError.html" class="crosslink">AmsError</a>
 * @param {Function} [statusChangedCallback]  安装过程的状态回调函数
 * @param {Object} statusChangedCallback.status 安装过程状态，包含如下属性:
 * @param {Number} statusChangedCallback.status.type 指示当前状态是install，uninstall，或update，参考{{#crossLink "AmsOperationType"}}{{/crossLink}}
 * @param {Number} statusChangedCallback.status.progress 安装过程状态码，具体值可参考{{#crossLink "AmsState"}}{{/crossLink}}
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.installApplication = function( packagePath, successCallback, errorCallback, statusChangedCallback)
{
   argscheck.checkArgs('sFFF', 'AMS.installApplication', arguments);
   if(!packagePath || typeof packagePath  != "string"){
        if(typeof errorCallback === "function") {
            errorCallback();
        }
        return;
    }
    function success(data){
        if(data.callback == "progress"){
             if(statusChangedCallback){
                 statusChangedCallback(data);
             }
        }else{
            successCallback();
        }
    };
    exec(success, errorCallback, "AMS", "installApplication",[packagePath]);
};

/**
 * 卸载app（Android, iOS, WP8）
 * @example
        function successCallback(info){
            console.log(info.appid);
            console.log(info.type);
        };
        function errorCallback(error){
            console.log(error.appid);
            console.log(error.type);
            console.log(error.errorcode);
        };
        xFace.AMS.uninstallApplication ("mengfGeolocation",successCallback，errorCallback);
 * @method uninstallApplication
 * @param {String} appId                    用于标识待卸载app的id
 * @param {Function} [successCallback]         卸载成功时的回调函数
 * @param {Object}  successCallback.info   与app相关信息object,每个object包含如下属性：
 * @param {Number}  successCallback.info.type   操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String}  successCallback.info.appid  app的id号
 * @param {Function} [errorCallback]          卸载失败时的回调函数
 * @param {Object}  errorCallback.error      包含错误信息的对象，每个object包含如下属性：
 * @param {Number}  errorCallback.error.type  发生错误的ams操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String}  errorCallback.error.appid  发生错误的app的id号
 * @param {Object}  errorCallback.error.errorcode  错误码，具体错误码参考<a href="../classes/AmsError.html" class="crosslink">AmsError</a>
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.uninstallApplication = function( appId, successCallback, errorCallback)
{
   argscheck.checkArgs('sFF', 'AMS.uninstallApplication', arguments);
   if(!appId || typeof appId  != "string"){
        if(typeof errorCallback === "function") {
            errorCallback();
        }
        return;
    }
    exec(
    //Success callback
    function(s)
    {
        successCallback(s);
    }, errorCallback, "AMS", "uninstallApplication",[appId]);
};

/**
 * 启动app（Android, iOS, WP8）
 * @example
        function successCallback(info){
            console.log(info.appid);
        };
        function errorCallback(error){
            console.log(error.appid);
        };
        if(isAndroid()){
            xFace.AMS.startApplication("appId", successCallback, errorCallback, "Admin;123");
        }
        if(isIOS()){
            xFace.AMS.startApplication("TodoListAppId", successCallback, errorCallback, "www.acme.com?Quarterly%20Report#200806231300");
        }
 * @method startApplication
 * @param {String} appId                    用于标识待启动app的id
 * @param {Function} [successCallback]        成功时的回调函数
 * @param {Object}  successCallback.info   与app相关信息object,每个object包含如下属性：
 * @param {String}  successCallback.info.appid  app的id号
 * @param {Function} [errorCallback]          失败时的回调函数
 * @param {Object}  errorCallback.error     包含错误信息的对象，每个object包含如下属性:
 * @param {String}  errorCallback.error.appid  发生错误的app的id号
 * @param {String}  [params] 程序启动参数，默认值为空 <br /> <a href="http://developer.apple.com/library/ios/#documentation/iPhone/Conceptual/iPhoneOSProgrammingGuide/AdvancedAppTricks/AdvancedAppTricks.html" class="crosslink">iOS: 请参考Custom URL Schemes</a>
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.startApplication = function(appId, successCallback, errorCallback, params)
{
    argscheck.checkArgs('s**S', 'AMS.startApplication', arguments);
    //appId check
    if(!appId || typeof appId  != "string"){
        if(typeof errorCallback === "function") {
            errorCallback("noId");
        }
        return;
    }
    var temp = arguments[1];

    //params check 1
    if( arguments.length == 2 && typeof arguments[1] === "string")
    {
        successCallback = null;
        errorCallback = null;
        params = temp;
    }

    //params check 2
    if(params === null || params === undefined)
    {
        params = "";
    }


    exec(successCallback, errorCallback, "AMS", "startApplication",[appId,params]);
};

/**
 * 关闭当前应用app（Android, iOS, WP8）
 * 如果当前只有一个app,在android平台上则退出xFace;在iOS平台上由于系统限制不退出xFace!!
 * @example
        xFace.AMS.closeApplication();
 * @method closeApplication
 * @platform Android, iOS, WP8
 * @since 3.0.0
 * @deprecated 若应用想关闭自己，请调用xFace.app.close()
 */
AMS.prototype.closeApplication = function()
{
    // FIXME: 接口应该设计为ams.closeApplication(appId)
    require('xFace/extension/privateModule').execCommand("xFace_close_application:", []);
   
};

/**
 * 列出系统已经安装的app列表（Android, iOS, WP8）
 * @example
         function successCallback(apps) {
            var count = apps.length;
            alert(count + " InstalledApps.");
            for(var i = 0; i < count; i++) {
                console.log(apps[i].appid);
                console.log(apps[i].name);
                console.log(apps[i].icon);
                console.log(apps[i].icon_background_color);
                console.log(apps[i].version);
                console.log(apps[i].type);
            }
        };
        function errorCallback() {
            alert("list fail!");
        };
       xFace.AMS.listInstalledApplications(successCallback，errorCallback);
 * @method listInstalledApplications
 * @param {Function} successCallback       获取列表成功时的回调函数
 * @param {Array}  successCallback.app 包含当前已经安装的app列表，每个app对象包含如下属性,
 * @param {String} successCallback.app.appid App的唯一id
 * @param {String} successCallback.app.name  App的名字
 * @param {String} successCallback.app.icon  App的图标的url
 * @param {String} successCallback.app.icon_background_color  App的图标背景颜色
 * @param {String} successCallback.app.version  App的版本
 * @param {String} successCallback.app.type  App的类型(nativeApp: napp; webApp:xapp或app)
 * @param {Function} [errorCallback]         获取列表失败时的回调函数
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.listInstalledApplications = function(successCallback, errorCallback)
{
    argscheck.checkArgs('fF', 'AMS.listInstalledApplications', arguments);
    exec(successCallback, errorCallback, "AMS", "listInstalledApplications",[]);
};

/**
 * 获取默认app可以安装的预设app安装包列表（Android, iOS, WP8）
 * 列表中每一项为一个app安装包的相对路径，可以直接安装/更新
 * @example
        function successCallback(packages){
            var count = packages.length;
            alert(count + " pre set app(s).");
            for(var i = 0; i < count; i++){
                alert(packages[i]);
            }
        }
        function errorCallback(){
            alert("list fail!");
        };
       xFace.AMS.listPresetAppPackages(successCallback，errorCallback);
 * @method listPresetAppPackages
 * @param {Function} successCallback     成功时的回调函数
 * @param {Array} successCallback.packages  预置包名数组对象，每一项均为预置包名
 * @param {Function} [errorCallback]           失败时的回调函数
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.listPresetAppPackages = function(successCallback, errorCallback)
{
    argscheck.checkArgs('fF', 'AMS.listPresetAppPackages', arguments);
    exec(successCallback, errorCallback, "AMS", "listPresetAppPackages", []);
};

/**
 * 更新app（Android, iOS, WP8）
 * @example
        function successCallback(info){
            console.log(info.appid);
            console.log(info.type);
        };
        function errorCallback(error){
            console.log(error.appid);
            console.log(error.type);
            console.log(error.errorcode);
        };
       xFace.AMS.updateApplication("geolocation.zip",successCallback，errorCallback);
 * @method updateApplication
 * @param {String} packagePath              app更新包所在相对路径（相对于当前app的工作空间）
 * @param {Function} [successCallback]        更新成功时的回调函数
 * @param {Object}  successCallback.info   与app相关信息object,每个object包含如下属性：
 * @param {Number}  successCallback.info.type   操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String}  successCallback.info.appid  app的id号
 * @param {Function} [errorCallback]          更新失败时的回调函数
 * @param {Object}  errorCallback.error     包含错误信息的对象，每个object包含如下属性：
 * @param {Number}  errorCallback.error.type  发生错误的ams操作类型,具体类型参考<a href="../classes/AmsOperationType.html" class="crosslink">AmsOperationType</a>
 * @param {String}  errorCallback.error.appid  发生错误的app的id号
 * @param {Object}  errorCallback.error.errorcode  错误码，具体错误码参考<a href="../classes/AmsError.html" class="crosslink">AmsError</a>
 * @param {Function} [statusChangedCallback]  更新过程的状态回调函数
 * @param {Object} statusChangedCallback.status 更新过程状态，包含如下属性:
 * @param {Number} statusChangedCallback.status.type 指示当前状态是install，uninstall，或update，参考{{#crossLink "AmsOperationType"}}{{/crossLink}}
 * @param {Number} statusChangedCallback.status.progress 安装过程状态码，具体值可参考{{#crossLink "AmsState"}}{{/crossLink}}@platform Android, iOS
 * @since 3.0.0
 * @platform Android, iOS, WP8
 */
AMS.prototype.updateApplication = function( packagePath, successCallback, errorCallback, statusChanged)
{
   argscheck.checkArgs('sFFF', 'AMS.updateApplication', arguments);
   if(!packagePath || typeof packagePath  != "string"){
        if(typeof errorCallback === "function") {
            errorCallback();
        }
        return;
    }
    function success(data){
        if(data == "0"){
            successCallback();
        }else{
            statusChanged();
        }
    }
    exec(Success, errorCallback,"AMS", "updateApplication",[packagePath]);
};

/**
 * 获取startApp的app描述信息（Android, iOS, WP8）
 * @example
       function successCallback(app){
            console.log(app.appid);
            console.log(app.name);
            console.log(app.icon);
            console.log(app.icon_background_color);
            console.log(app.version);
            console.log(app.type);
        };
        function errorCallback(){
            alert("failed");
        };
       xFace.AMS.getStartAppInfo(successCallback，errorCallback);
 * @method getStartAppInfo
 * @param {Function} successCallback      成功时的回调函数
 * @param {Object} successCallback.app    当前启动的app的信息，每个app对象包含如下属性,
 * @param {String} successCallback.app.appid,  App的唯一id
 * @param {String} successCallback.app.name,  App的名字
 * @param {String} successCallback.app.icon  App的图标的url
 * @param {String} successCallback.app.icon_background_color  App的图标背景颜色
 * @param {String} successCallback.app.version  App的版本
 * @param {String} successCallback.app.type  App的类型(nativeApp:napp; webApp:xapp或app)
 * @param {Function} [errorCallback]        失败时的回调函数
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
AMS.prototype.getStartAppInfo = function(successCallback, errorCallback)
{
    argscheck.checkArgs('fF', 'AMS.getStartAppInfo', arguments);
    exec(successCallback, errorCallback, "AMS", "getStartAppInfo", []);
};

module.exports = new AMS();

});

// file: lib\android\extension\privateModule.js
define("xFace/extension/privateModule", function(require, exports, module) {

/*
 This file was modified from or inspired by Apache Cordova.

 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements. See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership. The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied. See the License for the
 specific language governing permissions and limitations
 under the License.
*/

var privateModule = function(){};

/**
* 该接口用于js调用native功能（没有返回值）
*/
privateModule.prototype.execCommand = function(type, args) {
     prompt(JSON.stringify(args), type);
};
module.exports = new privateModule();
});

// file: lib/common/plugin/notification.js
define("cordova/plugin/notification", function(require, exports, module) {

var exec = require('cordova/exec');
var platform = require('cordova/platform');

/**
 * Provides access to notifications on the device.
 */

module.exports = {

    /**
     * Open a native alert dialog, with a customizable title and button text.
     *
     * @param {String} message              Message to print in the body of the alert
     * @param {Function} completeCallback   The callback that is called when user clicks on a button.
     * @param {String} title                Title of the alert dialog (default: Alert)
     * @param {String} buttonLabel          Label of the close button (default: OK)
     */
    alert: function(message, completeCallback, title, buttonLabel) {
        var _title = (title || "Alert");
        var _buttonLabel = (buttonLabel || "OK");
        exec(completeCallback, null, "Notification", "alert", [message, _title, _buttonLabel]);
    },

    /**
     * Open a native confirm dialog, with a customizable title and button text.
     * The result that the user selects is returned to the result callback.
     *
     * @param {String} message              Message to print in the body of the alert
     * @param {Function} resultCallback     The callback that is called when user clicks on a button.
     * @param {String} title                Title of the alert dialog (default: Confirm)
     * @param {Array} buttonLabels          Array of the labels of the buttons (default: ['OK', 'Cancel'])
     */
    confirm: function(message, resultCallback, title, buttonLabels) {
        var _title = (title || "Confirm");
        var _buttonLabels = (buttonLabels || ["OK", "Cancel"]);

        // Strings are deprecated!
        if (typeof _buttonLabels === 'string') {
            console.log("Notification.confirm(string, function, string, string) is deprecated.  Use Notification.confirm(string, function, string, array).");
        }

        // Some platforms take an array of button label names.
        // Other platforms take a comma separated list.
        // For compatibility, we convert to the desired type based on the platform.
        if (platform.id == "android" || platform.id == "ios" || platform.id == "windowsphone") {
            if (typeof _buttonLabels === 'string') {
                var buttonLabelString = _buttonLabels;
                _buttonLabels = _buttonLabels.split(","); // not crazy about changing the var type here
            }
        } else {
            if (Array.isArray(_buttonLabels)) {
                var buttonLabelArray = _buttonLabels;
                _buttonLabels = buttonLabelArray.toString();
            }
        }
        exec(resultCallback, null, "Notification", "confirm", [message, _title, _buttonLabels]);
    },

    /**
     * Open a native prompt dialog, with a customizable title and button text.
     * The following results are returned to the result callback:
     *  buttonIndex     Index number of the button selected.
     *  input1          The text entered in the prompt dialog box.
     *
     * @param {String} message              Dialog message to display (default: "Prompt message")
     * @param {Function} resultCallback     The callback that is called when user clicks on a button.
     * @param {String} title                Title of the dialog (default: "Prompt")
     * @param {Array} buttonLabels          Array of strings for the button labels (default: ["OK","Cancel"])
     */
    prompt: function(message, resultCallback, title, buttonLabels) {
        var _message = (message || "Prompt message");
        var _title = (title || "Prompt");
        var _buttonLabels = (buttonLabels || ["OK","Cancel"]);
        exec(resultCallback, null, "Notification", "prompt", [_message, _title, _buttonLabels]);
    },

    /**
     * Causes the device to vibrate.
     *
     * @param {Integer} mills       The number of milliseconds to vibrate for.
     */
    vibrate: function(mills) {
        exec(null, null, "Notification", "vibrate", [mills]);
    },

    /**
     * Causes the device to beep.
     * On Android, the default notification ringtone is played "count" times.
     *
     * @param {Integer} count       The number of beeps.
     */
    beep: function(count) {
        exec(null, null, "Notification", "beep", [count]);
    }
};

});


// file: lib/common/argscheck.js
define("cordova/argscheck", function(require, exports, module) {

var exec = require('cordova/exec');
var utils = require('cordova/utils');

var moduleExports = module.exports;

var typeMap = {
    'A': 'Array',
    'D': 'Date',
    'N': 'Number',
    'S': 'String',
    'F': 'Function',
    'O': 'Object'
};

function extractParamName(callee, argIndex) {
  return (/.*?\((.*?)\)/).exec(callee)[1].split(', ')[argIndex];
}

function checkArgs(spec, functionName, args, opt_callee) {
    if (!moduleExports.enableChecks) {
        return;
    }
    var errMsg = null;
    var typeName;
    for (var i = 0; i < spec.length; ++i) {
        var c = spec.charAt(i),
            cUpper = c.toUpperCase(),
            arg = args[i];
        // Asterix means allow anything.
        if (c == '*') {
            continue;
        }
        typeName = utils.typeName(arg);
        if ((arg === null || arg === undefined) && c == cUpper) {
            continue;
        }
        if (typeName != typeMap[cUpper]) {
            errMsg = 'Expected ' + typeMap[cUpper];
            break;
        }
    }
    if (errMsg) {
        errMsg += ', but got ' + typeName + '.';
        errMsg = 'Wrong type for parameter "' + extractParamName(opt_callee || args.callee, i) + '" of ' + functionName + ': ' + errMsg;
        // Don't log when running unit tests.
        if (typeof jasmine == 'undefined') {
            console.error(errMsg);
        }
        throw TypeError(errMsg);
    }
}

function getValue(value, defaultValue) {
    return value === undefined ? defaultValue : value;
}

moduleExports.checkArgs = checkArgs;
moduleExports.getValue = getValue;
moduleExports.enableChecks = true;


});

// file: lib/common/base64.js
define("cordova/base64", function(require, exports, module) {

var base64 = exports;

base64.fromArrayBuffer = function(arrayBuffer) {
  var array = new Uint8Array(arrayBuffer);
  return uint8ToBase64(array);
};

//------------------------------------------------------------------------------

/* This code is based on the performance tests at http://jsperf.com/b64tests
 * This 12-bit-at-a-time algorithm was the best performing version on all
 * platforms tested.
 */

var b64_6bit = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var b64_12bit;

var b64_12bitTable = function() {
    b64_12bit = [];
    for (var i=0; i<64; i++) {
        for (var j=0; j<64; j++) {
            b64_12bit[i*64+j] = b64_6bit[i] + b64_6bit[j];
        }
    }
    b64_12bitTable = function() { return b64_12bit; };
    return b64_12bit;
}

function uint8ToBase64(rawData) {
    var numBytes = rawData.byteLength;
    var output="";
    var segment;
    var table = b64_12bitTable();
    for (var i=0;i<numBytes-2;i+=3) {
        segment = (rawData[i] << 16) + (rawData[i+1] << 8) + rawData[i+2];
        output += table[segment >> 12];
        output += table[segment & 0xfff];
    }
    if (numBytes - i == 2) {
        segment = (rawData[i] << 16) + (rawData[i+1] << 8);
        output += table[segment >> 12];
        output += b64_6bit[(segment & 0xfff) >> 6];
        output += '=';
    } else if (numBytes - i == 1) {
        segment = (rawData[i] << 16);
        output += table[segment >> 12];
        output += '==';
    }
    return output;
}

});

// file: lib/common/builder.js
define("cordova/builder", function(require, exports, module) {

var utils = require('cordova/utils');

function each(objects, func, context) {
    for (var prop in objects) {
        if (objects.hasOwnProperty(prop)) {
            func.apply(context, [objects[prop], prop]);
        }
    }
}

function clobber(obj, key, value) {
    exports.replaceHookForTesting(obj, key);
    obj[key] = value;
    // Getters can only be overridden by getters.
    if (obj[key] !== value) {
        utils.defineGetter(obj, key, function() {
            return value;
        });
    }
}

function assignOrWrapInDeprecateGetter(obj, key, value, message) {
    if (message) {
        utils.defineGetter(obj, key, function() {
            console.log(message);
            delete obj[key];
            clobber(obj, key, value);
            return value;
        });
    } else {
        clobber(obj, key, value);
    }
}

function include(parent, objects, clobber, merge) {
    each(objects, function (obj, key) {
        try {
          var result = obj.path ? require(obj.path) : {};

          if (clobber) {
              // Clobber if it doesn't exist.
              if (typeof parent[key] === 'undefined') {
                  assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
              } else if (typeof obj.path !== 'undefined') {
                  // If merging, merge properties onto parent, otherwise, clobber.
                  if (merge) {
                      recursiveMerge(parent[key], result);
                  } else {
                      assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
                  }
              }
              result = parent[key];
          } else {
            // Overwrite if not currently defined.
            if (typeof parent[key] == 'undefined') {
              assignOrWrapInDeprecateGetter(parent, key, result, obj.deprecated);
            } else {
              // Set result to what already exists, so we can build children into it if they exist.
              result = parent[key];
            }
          }

          if (obj.children) {
            include(result, obj.children, clobber, merge);
          }
        } catch(e) {
          utils.alert('Exception building cordova JS globals: ' + e + ' for key "' + key + '"');
        }
    });
}

/**
 * Merge properties from one object onto another recursively.  Properties from
 * the src object will overwrite existing target property.
 *
 * @param target Object to merge properties into.
 * @param src Object to merge properties from.
 */
function recursiveMerge(target, src) {
    for (var prop in src) {
        if (src.hasOwnProperty(prop)) {
            if (target.prototype && target.prototype.constructor === target) {
                // If the target object is a constructor override off prototype.
                clobber(target.prototype, prop, src[prop]);
            } else {
                if (typeof src[prop] === 'object' && typeof target[prop] === 'object') {
                    recursiveMerge(target[prop], src[prop]);
                } else {
                    clobber(target, prop, src[prop]);
                }
            }
        }
    }
}

exports.buildIntoButDoNotClobber = function(objects, target) {
    include(target, objects, false, false);
};
exports.buildIntoAndClobber = function(objects, target) {
    include(target, objects, true, false);
};
exports.buildIntoAndMerge = function(objects, target) {
    include(target, objects, true, true);
};
exports.recursiveMerge = recursiveMerge;
exports.assignOrWrapInDeprecateGetter = assignOrWrapInDeprecateGetter;
exports.replaceHookForTesting = function() {};

});

// file: lib/common/channel.js
define("cordova/channel", function(require, exports, module) {

var utils = require('cordova/utils'),
    nextGuid = 1;

/**
 * Custom pub-sub "channel" that can have functions subscribed to it
 * This object is used to define and control firing of events for
 * cordova initialization, as well as for custom events thereafter.
 *
 * The order of events during page load and Cordova startup is as follows:
 *
 * onDOMContentLoaded*         Internal event that is received when the web page is loaded and parsed.
 * onNativeReady*              Internal event that indicates the Cordova native side is ready.
 * onCordovaReady*             Internal event fired when all Cordova JavaScript objects have been created.
 * onDeviceReady*              User event fired to indicate that Cordova is ready
 * onResume                    User event fired to indicate a start/resume lifecycle event
 * onPause                     User event fired to indicate a pause lifecycle event
 * onDestroy*                  Internal event fired when app is being destroyed (User should use window.onunload event, not this one).
 *
 * The events marked with an * are sticky. Once they have fired, they will stay in the fired state.
 * All listeners that subscribe after the event is fired will be executed right away.
 *
 * The only Cordova events that user code should register for are:
 *      deviceready           Cordova native code is initialized and Cordova APIs can be called from JavaScript
 *      pause                 App has moved to background
 *      resume                App has returned to foreground
 *
 * Listeners can be registered as:
 *      document.addEventListener("deviceready", myDeviceReadyListener, false);
 *      document.addEventListener("resume", myResumeListener, false);
 *      document.addEventListener("pause", myPauseListener, false);
 *
 * The DOM lifecycle events should be used for saving and restoring state
 *      window.onload
 *      window.onunload
 *
 */

/**
 * Channel
 * @constructor
 * @param type  String the channel name
 */
var Channel = function(type, sticky) {
    this.type = type;
    // Map of guid -> function.
    this.handlers = {};
    // 0 = Non-sticky, 1 = Sticky non-fired, 2 = Sticky fired.
    this.state = sticky ? 1 : 0;
    // Used in sticky mode to remember args passed to fire().
    this.fireArgs = null;
    // Used by onHasSubscribersChange to know if there are any listeners.
    this.numHandlers = 0;
    // Function that is called when the first listener is subscribed, or when
    // the last listener is unsubscribed.
    this.onHasSubscribersChange = null;
},
    channel = {
        /**
         * Calls the provided function only after all of the channels specified
         * have been fired. All channels must be sticky channels.
         */
        join: function(h, c) {
            var len = c.length,
                i = len,
                f = function() {
                    if (!(--i)) h();
                };
            for (var j=0; j<len; j++) {
                if (c[j].state === 0) {
                    throw Error('Can only use join with sticky channels.');
                }
                c[j].subscribe(f);
            }
            if (!len) h();
        },
        create: function(type) {
            return channel[type] = new Channel(type, false);
        },
        createSticky: function(type) {
            return channel[type] = new Channel(type, true);
        },

        /**
         * cordova Channels that must fire before "deviceready" is fired.
         */
        deviceReadyChannelsArray: [],
        deviceReadyChannelsMap: {},

        /**
         * Indicate that a feature needs to be initialized before it is ready to be used.
         * This holds up Cordova's "deviceready" event until the feature has been initialized
         * and Cordova.initComplete(feature) is called.
         *
         * @param feature {String}     The unique feature name
         */
        waitForInitialization: function(feature) {
            if (feature) {
                var c = channel[feature] || this.createSticky(feature);
                this.deviceReadyChannelsMap[feature] = c;
                this.deviceReadyChannelsArray.push(c);
            }
        },

        /**
         * Indicate that initialization code has completed and the feature is ready to be used.
         *
         * @param feature {String}     The unique feature name
         */
        initializationComplete: function(feature) {
            var c = this.deviceReadyChannelsMap[feature];
            if (c) {
                c.fire();
            }
        }
    };

function forceFunction(f) {
    if (typeof f != 'function') throw "Function required as first argument!";
}

/**
 * Subscribes the given function to the channel. Any time that
 * Channel.fire is called so too will the function.
 * Optionally specify an execution context for the function
 * and a guid that can be used to stop subscribing to the channel.
 * Returns the guid.
 */
Channel.prototype.subscribe = function(f, c) {
    // need a function to call
    forceFunction(f);
    if (this.state == 2) {
        f.apply(c || this, this.fireArgs);
        return;
    }

    var func = f,
        guid = f.observer_guid;
    if (typeof c == "object") { func = utils.close(c, f); }

    if (!guid) {
        // first time any channel has seen this subscriber
        guid = '' + nextGuid++;
    }
    func.observer_guid = guid;
    f.observer_guid = guid;

    // Don't add the same handler more than once.
    if (!this.handlers[guid]) {
        this.handlers[guid] = func;
        this.numHandlers++;
        if (this.numHandlers == 1) {
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};

/**
 * Unsubscribes the function with the given guid from the channel.
 */
Channel.prototype.unsubscribe = function(f) {
    // need a function to unsubscribe
    forceFunction(f);

    var guid = f.observer_guid,
        handler = this.handlers[guid];
    if (handler) {
        delete this.handlers[guid];
        this.numHandlers--;
        if (this.numHandlers === 0) {
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};

/**
 * Calls all functions subscribed to this channel.
 */
Channel.prototype.fire = function(e) {
    var fail = false,
        fireArgs = Array.prototype.slice.call(arguments);
    // Apply stickiness.
    if (this.state == 1) {
        this.state = 2;
        this.fireArgs = fireArgs;
    }
    if (this.numHandlers) {
        // Copy the values first so that it is safe to modify it from within
        // callbacks.
        var toCall = [];
        for (var item in this.handlers) {
            toCall.push(this.handlers[item]);
        }
        for (var i = 0; i < toCall.length; ++i) {
            toCall[i].apply(this, fireArgs);
        }
        if (this.state == 2 && this.numHandlers) {
            this.numHandlers = 0;
            this.handlers = {};
            this.onHasSubscribersChange && this.onHasSubscribersChange();
        }
    }
};


// defining them here so they are ready super fast!
// DOM event that is received when the web page is loaded and parsed.
channel.createSticky('onDOMContentLoaded');

// Event to indicate the Cordova native side is ready.
channel.createSticky('onNativeReady');

// Event to indicate that all Cordova JavaScript objects have been created
// and it's time to run plugin constructors.
channel.createSticky('onCordovaReady');

// Event to indicate that all automatically loaded JS plugins are loaded and ready.
channel.createSticky('onPluginsReady');

// Event to indicate that Cordova is ready
channel.createSticky('onDeviceReady');

// Event to indicate a resume lifecycle event
channel.create('onResume');

// Event to indicate a pause lifecycle event
channel.create('onPause');

// Event to indicate a destroy lifecycle event
channel.createSticky('onDestroy');

// Channels that must fire before "deviceready" is fired.
channel.waitForInitialization('onCordovaReady');
channel.waitForInitialization('onDOMContentLoaded');

module.exports = channel;

});

// file: lib/common/commandProxy.js
define("cordova/commandProxy", function(require, exports, module) {


// internal map of proxy function
var CommandProxyMap = {};

module.exports = {

    // example: cordova.commandProxy.add("Accelerometer",{getCurrentAcceleration: function(successCallback, errorCallback, options) {...},...);
    add:function(id,proxyObj) {
        console.log("adding proxy for " + id);
        CommandProxyMap[id] = proxyObj;
        return proxyObj;
    },

    // cordova.commandProxy.remove("Accelerometer");
    remove:function(id) {
        var proxy = CommandProxyMap[id];
        delete CommandProxyMap[id];
        CommandProxyMap[id] = null;
        return proxy;
    },

    get:function(service,action) {
        return ( CommandProxyMap[service] ? CommandProxyMap[service][action] : null );
    }
};
});

// file: lib/common/plugin/Metadata.js
define("cordova/plugin/Metadata", function(require, exports, module) {

/**
 * Information about the state of the file or directory
 *
 * {Date} modificationTime (readonly)
 */
var Metadata = function(time) {
    this.modificationTime = (typeof time != 'undefined'?new Date(time):null);
};

module.exports = Metadata;

});

// file: lib/android/exec.js
define("cordova/exec", function(require, exports, module) {

/**
 * Execute a cordova command.  It is up to the native side whether this action
 * is synchronous or asynchronous.  The native side can return:
 *      Synchronous: PluginResult object as a JSON string
 *      Asynchronous: Empty string ""
 * If async, the native side will cordova.callbackSuccess or cordova.callbackError,
 * depending upon the result of the action.
 *
 * @param {Function} success    The success callback
 * @param {Function} fail       The fail callback
 * @param {String} service      The name of the service to use
 * @param {String} action       Action to be run in cordova
 * @param {String[]} [args]     Zero or more arguments to pass to the method
 */
var cordova = require('cordova'),
    nativeApiProvider = require('cordova/plugin/android/nativeapiprovider'),
    utils = require('cordova/utils'),
    base64 = require('cordova/base64'),
    jsToNativeModes = {
        PROMPT: 0,
        JS_OBJECT: 1,
        // This mode is currently for benchmarking purposes only. It must be enabled
        // on the native side through the ENABLE_LOCATION_CHANGE_EXEC_MODE
        // constant within CordovaWebViewClient.java before it will work.
        LOCATION_CHANGE: 2
    },
    nativeToJsModes = {
        // Polls for messages using the JS->Native bridge.
        POLLING: 0,
        // For LOAD_URL to be viable, it would need to have a work-around for
        // the bug where the soft-keyboard gets dismissed when a message is sent.
        LOAD_URL: 1,
        // For the ONLINE_EVENT to be viable, it would need to intercept all event
        // listeners (both through addEventListener and window.ononline) as well
        // as set the navigator property itself.
        ONLINE_EVENT: 2,
        // Uses reflection to access private APIs of the WebView that can send JS
        // to be executed.
        // Requires Android 3.2.4 or above.
        PRIVATE_API: 3
    },
    jsToNativeBridgeMode,  // Set lazily.
    nativeToJsBridgeMode = nativeToJsModes.ONLINE_EVENT,
    pollEnabled = false,
    messagesFromNative = [];

function androidExec(success, fail, service, action, args) {
    // Set default bridge modes if they have not already been set.
    // By default, we use the failsafe, since addJavascriptInterface breaks too often
    if (jsToNativeBridgeMode === undefined) {
        androidExec.setJsToNativeBridgeMode(jsToNativeModes.JS_OBJECT);
    }

    // Process any ArrayBuffers in the args into a string.
    for (var i = 0; i < args.length; i++) {
        if (utils.typeName(args[i]) == 'ArrayBuffer') {
            args[i] = base64.fromArrayBuffer(args[i]);
        }
    }

    var callbackId = service + cordova.callbackId++,
        argsJson = JSON.stringify(args);

    if (success || fail) {
        cordova.callbacks[callbackId] = {success:success, fail:fail};
    }

    if (jsToNativeBridgeMode == jsToNativeModes.LOCATION_CHANGE) {
        window.location = 'http://cdv_exec/' + service + '#' + action + '#' + callbackId + '#' + argsJson;
    } else {
        var messages = nativeApiProvider.get().exec(service, action, callbackId, argsJson);
        // If argsJson was received by Java as null, try again with the PROMPT bridge mode.
        // This happens in rare circumstances, such as when certain Unicode characters are passed over the bridge on a Galaxy S2.  See CB-2666.
        if (jsToNativeBridgeMode == jsToNativeModes.JS_OBJECT && messages === "@Null arguments.") {
            androidExec.setJsToNativeBridgeMode(jsToNativeModes.PROMPT);
            androidExec(success, fail, service, action, args);
            androidExec.setJsToNativeBridgeMode(jsToNativeModes.JS_OBJECT);
            return;
        } else {
            androidExec.processMessages(messages);
        }
    }
}

function pollOnce() {
    var msg = nativeApiProvider.get().retrieveJsMessages();
    androidExec.processMessages(msg);
}

function pollingTimerFunc() {
    if (pollEnabled) {
        pollOnce();
        setTimeout(pollingTimerFunc, 50);
    }
}

function hookOnlineApis() {
    function proxyEvent(e) {
        cordova.fireWindowEvent(e.type);
    }
    // The network module takes care of firing online and offline events.
    // It currently fires them only on document though, so we bridge them
    // to window here (while first listening for exec()-releated online/offline
    // events).
    window.addEventListener('online', pollOnce, false);
    window.addEventListener('offline', pollOnce, false);
    cordova.addWindowEventHandler('online');
    cordova.addWindowEventHandler('offline');
    document.addEventListener('online', proxyEvent, false);
    document.addEventListener('offline', proxyEvent, false);
}

hookOnlineApis();

androidExec.jsToNativeModes = jsToNativeModes;
androidExec.nativeToJsModes = nativeToJsModes;

androidExec.setJsToNativeBridgeMode = function(mode) {
    if (mode == jsToNativeModes.JS_OBJECT && !window._cordovaNative) {
        console.log('Falling back on PROMPT mode since _cordovaNative is missing. Expected for Android 3.2 and lower only.');
        mode = jsToNativeModes.PROMPT;
    }
    nativeApiProvider.setPreferPrompt(mode == jsToNativeModes.PROMPT);
    jsToNativeBridgeMode = mode;
};

androidExec.setNativeToJsBridgeMode = function(mode) {
    if (mode == nativeToJsBridgeMode) {
        return;
    }
    if (nativeToJsBridgeMode == nativeToJsModes.POLLING) {
        pollEnabled = false;
    }

    nativeToJsBridgeMode = mode;
    // Tell the native side to switch modes.
    nativeApiProvider.get().setNativeToJsBridgeMode(mode);

    if (mode == nativeToJsModes.POLLING) {
        pollEnabled = true;
        setTimeout(pollingTimerFunc, 1);
    }
};

// Processes a single message, as encoded by NativeToJsMessageQueue.java.
function processMessage(message) {
    try {
        var firstChar = message.charAt(0);
        if (firstChar == 'J') {
            eval(message.slice(1));
        } else if (firstChar == 'S' || firstChar == 'F') {
            var success = firstChar == 'S';
            var keepCallback = message.charAt(1) == '1';
            var spaceIdx = message.indexOf(' ', 2);
            var status = +message.slice(2, spaceIdx);
            var nextSpaceIdx = message.indexOf(' ', spaceIdx + 1);
            var callbackId = message.slice(spaceIdx + 1, nextSpaceIdx);
            var payloadKind = message.charAt(nextSpaceIdx + 1);
            var payload;
            if (payloadKind == 's') {
                payload = message.slice(nextSpaceIdx + 2);
            } else if (payloadKind == 't') {
                payload = true;
            } else if (payloadKind == 'f') {
                payload = false;
            } else if (payloadKind == 'N') {
                payload = null;
            } else if (payloadKind == 'n') {
                payload = +message.slice(nextSpaceIdx + 2);
            } else if (payloadKind == 'A') {
                var data = message.slice(nextSpaceIdx + 2);
                var bytes = window.atob(data);
                var arraybuffer = new Uint8Array(bytes.length);
                for (var i = 0; i < bytes.length; i++) {
                    arraybuffer[i] = bytes.charCodeAt(i);
                }
                payload = arraybuffer.buffer;
            } else if (payloadKind == 'S') {
                payload = window.atob(message.slice(nextSpaceIdx + 2));
            } else {
                payload = JSON.parse(message.slice(nextSpaceIdx + 1));
            }
            cordova.callbackFromNative(callbackId, success, status, [payload], keepCallback);
        } else {
            console.log("processMessage failed: invalid message:" + message);
        }
    } catch (e) {
        console.log("processMessage failed: Message: " + message);
        console.log("processMessage failed: Error: " + e);
        console.log("processMessage failed: Stack: " + e.stack);
    }
}


// This is called from the NativeToJsMessageQueue.java.
androidExec.processMessages = function(messages) {
    if (messages) {
        messagesFromNative.push(messages);
        // Check for the reentrant case, and enqueue the message if that's the case.
        if (messagesFromNative.length > 1) {
            return;
        }
        while (messagesFromNative.length) {
            // Don't unshift until the end so that reentrancy can be detected.
            messages = messagesFromNative[0];
            // The Java side can send a * message to indicate that it
            // still has messages waiting to be retrieved.
            if (messages == '*') {
                messagesFromNative.shift();
                window.setTimeout(pollOnce, 0);
                return;
            }

            var spaceIdx = messages.indexOf(' ');
            var msgLen = +messages.slice(0, spaceIdx);
            var message = messages.substr(spaceIdx + 1, msgLen);
            messages = messages.slice(spaceIdx + msgLen + 1);
            processMessage(message);
            if (messages) {
                messagesFromNative[0] = messages;
            } else {
                messagesFromNative.shift();
            }
        }
    }
};

module.exports = androidExec;

});

// file: lib/common/modulemapper.js
define("cordova/modulemapper", function(require, exports, module) {

var builder = require('cordova/builder'),
    moduleMap = define.moduleMap,
    symbolList,
    deprecationMap;

exports.reset = function() {
    symbolList = [];
    deprecationMap = {};
};

function addEntry(strategy, moduleName, symbolPath, opt_deprecationMessage) {
    if (!(moduleName in moduleMap)) {
        throw new Error('Module ' + moduleName + ' does not exist.');
    }
    symbolList.push(strategy, moduleName, symbolPath);
    if (opt_deprecationMessage) {
        deprecationMap[symbolPath] = opt_deprecationMessage;
    }
}

// Note: Android 2.3 does have Function.bind().
exports.clobbers = function(moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('c', moduleName, symbolPath, opt_deprecationMessage);
};

exports.merges = function(moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('m', moduleName, symbolPath, opt_deprecationMessage);
};

exports.defaults = function(moduleName, symbolPath, opt_deprecationMessage) {
    addEntry('d', moduleName, symbolPath, opt_deprecationMessage);
};

exports.runs = function(moduleName) {
    addEntry('r', moduleName, null);
};

function prepareNamespace(symbolPath, context) {
    if (!symbolPath) {
        return context;
    }
    var parts = symbolPath.split('.');
    var cur = context;
    for (var i = 0, part; part = parts[i]; ++i) {
        cur = cur[part] = cur[part] || {};
    }
    return cur;
}

exports.mapModules = function(context) {
    var origSymbols = {};
    context.CDV_origSymbols = origSymbols;
    for (var i = 0, len = symbolList.length; i < len; i += 3) {
        var strategy = symbolList[i];
        var moduleName = symbolList[i + 1];
        var module = require(moduleName);
        // <runs/>
        if (strategy == 'r') {
            continue;
        }
        var symbolPath = symbolList[i + 2];
        var lastDot = symbolPath.lastIndexOf('.');
        var namespace = symbolPath.substr(0, lastDot);
        var lastName = symbolPath.substr(lastDot + 1);

        var deprecationMsg = symbolPath in deprecationMap ? 'Access made to deprecated symbol: ' + symbolPath + '. ' + deprecationMsg : null;
        var parentObj = prepareNamespace(namespace, context);
        var target = parentObj[lastName];

        if (strategy == 'm' && target) {
            builder.recursiveMerge(target, module);
        } else if ((strategy == 'd' && !target) || (strategy != 'd')) {
            if (!(symbolPath in origSymbols)) {
                origSymbols[symbolPath] = target;
            }
            builder.assignOrWrapInDeprecateGetter(parentObj, lastName, module, deprecationMsg);
        }
    }
};

exports.getOriginalSymbol = function(context, symbolPath) {
    var origSymbols = context.CDV_origSymbols;
    if (origSymbols && (symbolPath in origSymbols)) {
        return origSymbols[symbolPath];
    }
    var parts = symbolPath.split('.');
    var obj = context;
    for (var i = 0; i < parts.length; ++i) {
        obj = obj && obj[parts[i]];
    }
    return obj;
};

exports.loadMatchingModules = function(matchingRegExp) {
    for (var k in moduleMap) {
        if (matchingRegExp.exec(k)) {
            require(k);
        }
    }
};

exports.reset();


});

// file: lib/android/platform.js
define("cordova/platform", function(require, exports, module) {

module.exports = {
    id: "android",
    initialize:function() {
        var channel = require("cordova/channel"),
            cordova = require('cordova'),
            exec = require('cordova/exec'),
            modulemapper = require('cordova/modulemapper');

        modulemapper.loadMatchingModules(/cordova.*\/symbols$/);
        modulemapper.clobbers('cordova/plugin/android/app', 'navigator.app');
        modulemapper.clobbers('cordova/plugin/ams', 'xFace.AMS');
        modulemapper.clobbers('cordova/plugin/notification', 'navigator.notification');

        modulemapper.mapModules(window);

        // Inject a listener for the backbutton on the document.
        var backButtonChannel = cordova.addDocumentEventHandler('backbutton');
        backButtonChannel.onHasSubscribersChange = function() {
            // If we just attached the first handler or detached the last handler,
            // let native know we need to override the back button.
            exec(null, null, "App", "overrideBackbutton", [this.numHandlers == 1]);
        };

        // Add hardware MENU and SEARCH button handlers
        cordova.addDocumentEventHandler('menubutton');
        cordova.addDocumentEventHandler('searchbutton');

        // Let native code know we are all done on the JS side.
        // Native code will then un-hide the WebView.
        channel.join(function() {
            exec(null, null, "App", "show", []);
        }, [channel.onCordovaReady]);
    }
};

});

// file: lib/android/plugin/android/app.js
define("cordova/plugin/android/app", function(require, exports, module) {

var exec = require('cordova/exec');

module.exports = {
  /**
   * Clear the resource cache.
   */
  clearCache:function() {
    exec(null, null, "App", "clearCache", []);
  },

  /**
   * Load the url into the webview or into new browser instance.
   *
   * @param url           The URL to load
   * @param props         Properties that can be passed in to the activity:
   *      wait: int                           => wait msec before loading URL
   *      loadingDialog: "Title,Message"      => display a native loading dialog
   *      loadUrlTimeoutValue: int            => time in msec to wait before triggering a timeout error
   *      clearHistory: boolean              => clear webview history (default=false)
   *      openExternal: boolean              => open in a new browser (default=false)
   *
   * Example:
   *      navigator.app.loadUrl("http://server/myapp/index.html", {wait:2000, loadingDialog:"Wait,Loading App", loadUrlTimeoutValue: 60000});
   */
  loadUrl:function(url, props) {
    exec(null, null, "App", "loadUrl", [url, props]);
  },

  /**
   * Cancel loadUrl that is waiting to be loaded.
   */
  cancelLoadUrl:function() {
    exec(null, null, "App", "cancelLoadUrl", []);
  },

  /**
   * Clear web history in this web view.
   * Instead of BACK button loading the previous web page, it will exit the app.
   */
  clearHistory:function() {
    exec(null, null, "App", "clearHistory", []);
  },

  /**
   * Go to previous page displayed.
   * This is the same as pressing the backbutton on Android device.
   */
  backHistory:function() {
    exec(null, null, "App", "backHistory", []);
  },

  /**
   * Override the default behavior of the Android back button.
   * If overridden, when the back button is pressed, the "backKeyDown" JavaScript event will be fired.
   *
   * Note: The user should not have to call this method.  Instead, when the user
   *       registers for the "backbutton" event, this is automatically done.
   *
   * @param override        T=override, F=cancel override
   */
  overrideBackbutton:function(override) {
    exec(null, null, "App", "overrideBackbutton", [override]);
  },

  /**
   * Exit and terminate the application.
   */
  exitApp:function() {
    return exec(null, null, "App", "exitApp", []);
  }
};

});

// file: lib/android/plugin/android/nativeapiprovider.js
define("cordova/plugin/android/nativeapiprovider", function(require, exports, module) {

/**
 * Exports the ExposedJsApi.java object if available, otherwise exports the PromptBasedNativeApi.
 */

var nativeApi = this._cordovaNative || require('cordova/plugin/android/promptbasednativeapi');
var currentApi = nativeApi;

module.exports = {
    get: function() { return currentApi; },
    setPreferPrompt: function(value) {
        currentApi = value ? require('cordova/plugin/android/promptbasednativeapi') : nativeApi;
    },
    // Used only by tests.
    set: function(value) {
        currentApi = value;
    }
};

});

// file: lib/android/plugin/android/promptbasednativeapi.js
define("cordova/plugin/android/promptbasednativeapi", function(require, exports, module) {

/**
 * Implements the API of ExposedJsApi.java, but uses prompt() to communicate.
 * This is used only on the 2.3 simulator, where addJavascriptInterface() is broken.
 */

module.exports = {
    exec: function(service, action, callbackId, argsJson) {
        return prompt(argsJson, 'gap:'+JSON.stringify([service, action, callbackId]));
    },
    setNativeToJsBridgeMode: function(value) {
        prompt(value, 'gap_bridge_mode:');
    },
    retrieveJsMessages: function() {
        return prompt('', 'gap_poll:');
    }
};

});

// file: lib/android/plugin/android/storage.js
define("cordova/plugin/android/storage", function(require, exports, module) {

var utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    channel = require('cordova/channel');

var queryQueue = {};

/**
 * SQL result set object
 * PRIVATE METHOD
 * @constructor
 */
var DroidDB_Rows = function() {
    this.resultSet = [];    // results array
    this.length = 0;        // number of rows
};

/**
 * Get item from SQL result set
 *
 * @param row           The row number to return
 * @return              The row object
 */
DroidDB_Rows.prototype.item = function(row) {
    return this.resultSet[row];
};

/**
 * SQL result set that is returned to user.
 * PRIVATE METHOD
 * @constructor
 */
var DroidDB_Result = function() {
    this.rows = new DroidDB_Rows();
};

/**
 * Callback from native code when query is complete.
 * PRIVATE METHOD
 *
 * @param id   Query id
 */
function completeQuery(id, data) {
    var query = queryQueue[id];
    if (query) {
        try {
            delete queryQueue[id];

            // Get transaction
            var tx = query.tx;

            // If transaction hasn't failed
            // Note: We ignore all query results if previous query
            //       in the same transaction failed.
            if (tx && tx.queryList[id]) {

                // Save query results
                var r = new DroidDB_Result();
                r.rows.resultSet = data;
                r.rows.length = data.length;
                try {
                    if (typeof query.successCallback === 'function') {
                        query.successCallback(query.tx, r);
                    }
                } catch (ex) {
                    console.log("executeSql error calling user success callback: "+ex);
                }

                tx.queryComplete(id);
            }
        } catch (e) {
            console.log("executeSql error: "+e);
        }
    }
}

/**
 * Callback from native code when query fails
 * PRIVATE METHOD
 *
 * @param reason            Error message
 * @param id                Query id
 */
function failQuery(reason, id) {
    var query = queryQueue[id];
    if (query) {
        try {
            delete queryQueue[id];

            // Get transaction
            var tx = query.tx;

            // If transaction hasn't failed
            // Note: We ignore all query results if previous query
            //       in the same transaction failed.
            if (tx && tx.queryList[id]) {
                tx.queryList = {};

                try {
                    if (typeof query.errorCallback === 'function') {
                        query.errorCallback(query.tx, reason);
                    }
                } catch (ex) {
                    console.log("executeSql error calling user error callback: "+ex);
                }

                tx.queryFailed(id, reason);
            }

        } catch (e) {
            console.log("executeSql error: "+e);
        }
    }
}

/**
 * SQL query object
 * PRIVATE METHOD
 *
 * @constructor
 * @param tx                The transaction object that this query belongs to
 */
var DroidDB_Query = function(tx) {

    // Set the id of the query
    this.id = utils.createUUID();

    // Add this query to the queue
    queryQueue[this.id] = this;

    // Init result
    this.resultSet = [];

    // Set transaction that this query belongs to
    this.tx = tx;

    // Add this query to transaction list
    this.tx.queryList[this.id] = this;

    // Callbacks
    this.successCallback = null;
    this.errorCallback = null;

};

/**
 * Transaction object
 * PRIVATE METHOD
 * @constructor
 */
var DroidDB_Tx = function() {

    // Set the id of the transaction
    this.id = utils.createUUID();

    // Callbacks
    this.successCallback = null;
    this.errorCallback = null;

    // Query list
    this.queryList = {};
};

/**
 * Mark query in transaction as complete.
 * If all queries are complete, call the user's transaction success callback.
 *
 * @param id                Query id
 */
DroidDB_Tx.prototype.queryComplete = function(id) {
    delete this.queryList[id];

    // If no more outstanding queries, then fire transaction success
    if (this.successCallback) {
        var count = 0;
        var i;
        for (i in this.queryList) {
            if (this.queryList.hasOwnProperty(i)) {
                count++;
            }
        }
        if (count === 0) {
            try {
                this.successCallback();
            } catch(e) {
                console.log("Transaction error calling user success callback: " + e);
            }
        }
    }
};

/**
 * Mark query in transaction as failed.
 *
 * @param id                Query id
 * @param reason            Error message
 */
DroidDB_Tx.prototype.queryFailed = function(id, reason) {

    // The sql queries in this transaction have already been run, since
    // we really don't have a real transaction implemented in native code.
    // However, the user callbacks for the remaining sql queries in transaction
    // will not be called.
    this.queryList = {};

    if (this.errorCallback) {
        try {
            this.errorCallback(reason);
        } catch(e) {
            console.log("Transaction error calling user error callback: " + e);
        }
    }
};

/**
 * Execute SQL statement
 *
 * @param sql                   SQL statement to execute
 * @param params                Statement parameters
 * @param successCallback       Success callback
 * @param errorCallback         Error callback
 */
DroidDB_Tx.prototype.executeSql = function(sql, params, successCallback, errorCallback) {

    // Init params array
    if (typeof params === 'undefined') {
        params = [];
    }

    // Create query and add to queue
    var query = new DroidDB_Query(this);
    queryQueue[query.id] = query;

    // Save callbacks
    query.successCallback = successCallback;
    query.errorCallback = errorCallback;

    // Call native code
    exec(null, null, "Storage", "executeSql", [sql, params, query.id]);
};

var DatabaseShell = function() {
};

/**
 * Start a transaction.
 * Does not support rollback in event of failure.
 *
 * @param process {Function}            The transaction function
 * @param successCallback {Function}
 * @param errorCallback {Function}
 */
DatabaseShell.prototype.transaction = function(process, errorCallback, successCallback) {
    var tx = new DroidDB_Tx();
    tx.successCallback = successCallback;
    tx.errorCallback = errorCallback;
    try {
        process(tx);
    } catch (e) {
        console.log("Transaction error: "+e);
        if (tx.errorCallback) {
            try {
                tx.errorCallback(e);
            } catch (ex) {
                console.log("Transaction error calling user error callback: "+e);
            }
        }
    }
};

/**
 * Open database
 *
 * @param name              Database name
 * @param version           Database version
 * @param display_name      Database display name
 * @param size              Database size in bytes
 * @return                  Database object
 */
var DroidDB_openDatabase = function(name, version, display_name, size) {
    exec(null, null, "Storage", "openDatabase", [name, version, display_name, size]);
    var db = new DatabaseShell();
    return db;
};


module.exports = {
  openDatabase:DroidDB_openDatabase,
  failQuery:failQuery,
  completeQuery:completeQuery
};

});

// file: lib/android/plugin/android/storage/openDatabase.js
define("cordova/plugin/android/storage/openDatabase", function(require, exports, module) {


var modulemapper = require('cordova/modulemapper'),
    storage = require('cordova/plugin/android/storage');

var originalOpenDatabase = modulemapper.getOriginalSymbol(window, 'openDatabase');

module.exports = function(name, version, desc, size) {
    // First patch WebSQL if necessary
    if (!originalOpenDatabase) {
        // Not defined, create an openDatabase function for all to use!
        return storage.openDatabase.apply(this, arguments);
    }

    // Defined, but some Android devices will throw a SECURITY_ERR -
    // so we wrap the whole thing in a try-catch and shim in our own
    // if the device has Android bug 16175.
    try {
        return originalOpenDatabase(name, version, desc, size);
    } catch (ex) {
        if (ex.code !== 18) {
            throw ex;
        }
    }
    return storage.openDatabase(name, version, desc, size);
};



});

// file: lib/android/plugin/android/storage/symbols.js
define("cordova/plugin/android/storage/symbols", function(require, exports, module) {


var modulemapper = require('cordova/modulemapper');

modulemapper.clobbers('cordova/plugin/android/storage/openDatabase', 'openDatabase');


});

// file: lib/common/plugin/echo.js
define("cordova/plugin/echo", function(require, exports, module) {

var exec = require('cordova/exec'),
    utils = require('cordova/utils');

/**
 * Sends the given message through exec() to the Echo plugin, which sends it back to the successCallback.
 * @param successCallback  invoked with a FileSystem object
 * @param errorCallback  invoked if error occurs retrieving file system
 * @param message  The string to be echoed.
 * @param forceAsync  Whether to force an async return value (for testing native->js bridge).
 */
module.exports = function(successCallback, errorCallback, message, forceAsync) {
    var action = 'echo';
    var messageIsMultipart = (utils.typeName(message) == "Array");
    var args = messageIsMultipart ? message : [message];

    if (utils.typeName(message) == 'ArrayBuffer') {
        if (forceAsync) {
            console.warn('Cannot echo ArrayBuffer with forced async, falling back to sync.');
        }
        action += 'ArrayBuffer';
    } else if (messageIsMultipart) {
        if (forceAsync) {
            console.warn('Cannot echo MultiPart Array with forced async, falling back to sync.');
        }
        action += 'MultiPart';
    } else if (forceAsync) {
        action += 'Async';
    }

    exec(successCallback, errorCallback, "Echo", action, args);
};


});

// file: lib/common/pluginloader.js
define("cordova/pluginloader", function(require, exports, module) {

var channel = require('cordova/channel');
var modulemapper = require('cordova/modulemapper');

// Helper function to inject a <script> tag.
function injectScript(url, onload, onerror) {
    var script = document.createElement("script");
    // onload fires even when script fails loads with an error.
    script.onload = onload;
    script.onerror = onerror || onload;
    script.src = url;
    document.head.appendChild(script);
}

function onScriptLoadingComplete(moduleList) {
    // Loop through all the plugins and then through their clobbers and merges.
    for (var i = 0, module; module = moduleList[i]; i++) {
        if (module) {
            try {
                if (module.clobbers && module.clobbers.length) {
                    for (var j = 0; j < module.clobbers.length; j++) {
                        modulemapper.clobbers(module.id, module.clobbers[j]);
                    }
                }

                if (module.merges && module.merges.length) {
                    for (var k = 0; k < module.merges.length; k++) {
                        modulemapper.merges(module.id, module.merges[k]);
                    }
                }

                // Finally, if runs is truthy we want to simply require() the module.
                // This can be skipped if it had any merges or clobbers, though,
                // since the mapper will already have required the module.
                if (module.runs && !(module.clobbers && module.clobbers.length) && !(module.merges && module.merges.length)) {
                    modulemapper.runs(module.id);
                }
            }
            catch(err) {
                // error with module, most likely clobbers, should we continue?
            }
        }
    }

    finishPluginLoading();
}

// Called when:
// * There are plugins defined and all plugins are finished loading.
// * There are no plugins to load.
function finishPluginLoading() {
    channel.onPluginsReady.fire();
}

// Handler for the cordova_plugins.js content.
// See plugman's plugin_loader.js for the details of this object.
// This function is only called if the really is a plugins array that isn't empty.
// Otherwise the onerror response handler will just call finishPluginLoading().
function handlePluginsObject(path, moduleList) {
    // Now inject the scripts.
    var scriptCounter = moduleList.length;

    if (!scriptCounter) {
        onScriptLoadingComplete();
        return;
    }
    function scriptLoadedCallback() {
        if (!--scriptCounter) {
            onScriptLoadingComplete(moduleList);
        }
    }

    for (var i = 0; i < moduleList.length; i++) {
        injectScript(path + moduleList[i].file, scriptLoadedCallback);
    }
}

function injectPluginScript(pathPrefix) {
    injectScript(pathPrefix + 'cordova_plugins.js', function(){
        try {
            var moduleList = require("cordova/plugin_list");
            handlePluginsObject(pathPrefix, moduleList);
        } catch (e) {
            // Error loading cordova_plugins.js, file not found or something
            // this is an acceptable error, pre-3.0.0, so we just move on.
            finishPluginLoading();
        }
    },finishPluginLoading); // also, add script load error handler for file not found
}

function findCordovaPath() {
    var path = null;
    var scripts = document.getElementsByTagName('script');
    var term = 'xface.js';
    for (var n = scripts.length-1; n>-1; n--) {
        var src = scripts[n].src;
        if (src.indexOf(term) == (src.length - term.length)) {
            path = src.substring(0, src.length - term.length);
            break;
        }
    }
    return path;
}

// Tries to load all plugins' js-modules.
// This is an async process, but onDeviceReady is blocked on onPluginsReady.
// onPluginsReady is fired when there are no plugins to load, or they are all done.
exports.load = function() {
    var moduleList = require("cordova/plugin_list");
    onScriptLoadingComplete(moduleList);

};


});

// file: lib/common/symbols.js
define("cordova/symbols", function(require, exports, module) {

var modulemapper = require('cordova/modulemapper');

// Use merges here in case others symbols files depend on this running first,
// but fail to declare the dependency with a require().
modulemapper.merges('cordova', 'cordova');
modulemapper.clobbers('cordova/exec', 'cordova.exec');
modulemapper.clobbers('cordova/exec', 'Cordova.exec');

});

// file: lib/common/utils.js
define("cordova/utils", function(require, exports, module) {

var utils = exports;

/**
 * Defines a property getter / setter for obj[key].
 */
utils.defineGetterSetter = function(obj, key, getFunc, opt_setFunc) {
    if (Object.defineProperty) {
        var desc = {
            get: getFunc,
            configurable: true
        };
        if (opt_setFunc) {
            desc.set = opt_setFunc;
        }
        Object.defineProperty(obj, key, desc);
    } else {
        obj.__defineGetter__(key, getFunc);
        if (opt_setFunc) {
            obj.__defineSetter__(key, opt_setFunc);
        }
    }
};

/**
 * Defines a property getter for obj[key].
 */
utils.defineGetter = utils.defineGetterSetter;

utils.arrayIndexOf = function(a, item) {
    if (a.indexOf) {
        return a.indexOf(item);
    }
    var len = a.length;
    for (var i = 0; i < len; ++i) {
        if (a[i] == item) {
            return i;
        }
    }
    return -1;
};

/**
 * Returns whether the item was found in the array.
 */
utils.arrayRemove = function(a, item) {
    var index = utils.arrayIndexOf(a, item);
    if (index != -1) {
        a.splice(index, 1);
    }
    return index != -1;
};

utils.typeName = function(val) {
    return Object.prototype.toString.call(val).slice(8, -1);
};

/**
 * Returns an indication of whether the argument is an array or not
 */
utils.isArray = function(a) {
    return utils.typeName(a) == 'Array';
};

/**
 * Returns an indication of whether the argument is a Date or not
 */
utils.isDate = function(d) {
    return utils.typeName(d) == 'Date';
};

/**
 * Does a deep clone of the object.
 */
utils.clone = function(obj) {
    if(!obj || typeof obj == 'function' || utils.isDate(obj) || typeof obj != 'object') {
        return obj;
    }

    var retVal, i;

    if(utils.isArray(obj)){
        retVal = [];
        for(i = 0; i < obj.length; ++i){
            retVal.push(utils.clone(obj[i]));
        }
        return retVal;
    }

    retVal = {};
    for(i in obj){
        if(!(i in retVal) || retVal[i] != obj[i]) {
            retVal[i] = utils.clone(obj[i]);
        }
    }
    return retVal;
};

/**
 * Returns a wrapped version of the function
 */
utils.close = function(context, func, params) {
    if (typeof params == 'undefined') {
        return function() {
            return func.apply(context, arguments);
        };
    } else {
        return function() {
            return func.apply(context, params);
        };
    }
};

/**
 * Create a UUID
 */
utils.createUUID = function() {
    return UUIDcreatePart(4) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(2) + '-' +
        UUIDcreatePart(6);
};

/**
 * Extends a child object from a parent object using classical inheritance
 * pattern.
 */
utils.extend = (function() {
    // proxy used to establish prototype chain
    var F = function() {};
    // extend Child from Parent
    return function(Child, Parent) {
        F.prototype = Parent.prototype;
        Child.prototype = new F();
        Child.__super__ = Parent.prototype;
        Child.prototype.constructor = Child;
    };
}());

/**
 * Alerts a message in any available way: alert or console.log.
 */
utils.alert = function(msg) {
    if (window.alert) {
        window.alert(msg);
    } else if (console && console.log) {
        console.log(msg);
    }
};


//------------------------------------------------------------------------------
function UUIDcreatePart(length) {
    var uuidpart = "";
    for (var i=0; i<length; i++) {
        var uuidchar = parseInt((Math.random() * 256), 10).toString(16);
        if (uuidchar.length == 1) {
            uuidchar = "0" + uuidchar;
        }
        uuidpart += uuidchar;
    }
    return uuidpart;
}


});
//file:cordova_plugins.js
define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\DirectoryEntry.js",
        "id": "org.apache.cordova.core.file.DirectoryEntry",
        "clobbers": [
            "window.DirectoryEntry"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\DirectoryReader.js",
        "id": "org.apache.cordova.core.file.DirectoryReader",
        "clobbers": [
            "window.DirectoryReader"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\Entry.js",
        "id": "org.apache.cordova.core.file.Entry",
        "clobbers": [
            "window.Entry"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\File.js",
        "id": "org.apache.cordova.core.file.File",
        "clobbers": [
            "window.File"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileEntry.js",
        "id": "org.apache.cordova.core.file.FileEntry",
        "clobbers": [
            "window.FileEntry"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileError.js",
        "id": "org.apache.cordova.core.file.FileError",
        "clobbers": [
            "window.FileError"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileReader.js",
        "id": "org.apache.cordova.core.file.FileReader",
        "clobbers": [
            "window.FileReader"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileSystem.js",
        "id": "org.apache.cordova.core.file.FileSystem",
        "clobbers": [
            "window.FileSystem"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileUploadOptions.js",
        "id": "org.apache.cordova.core.file.FileUploadOptions",
        "clobbers": [
            "window.FileUploadOptions"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileUploadResult.js",
        "id": "org.apache.cordova.core.file.FileUploadResult",
        "clobbers": [
            "window.FileUploadResult"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\FileWriter.js",
        "id": "org.apache.cordova.core.file.FileWriter",
        "clobbers": [
            "window.FileWriter"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\Flags.js",
        "id": "org.apache.cordova.core.file.Flags",
        "clobbers": [
            "window.Flags"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\LocalFileSystem.js",
        "id": "org.apache.cordova.core.file.LocalFileSystem",
        "clobbers": [
            "window.LocalFileSystem"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\Metadata.js",
        "id": "org.apache.cordova.core.file.Metadata",
        "clobbers": [
            "window.Metadata"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\ProgressEvent.js",
        "id": "org.apache.cordova.core.file.ProgressEvent",
        "clobbers": [
            "window.ProgressEvent"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\requestFileSystem.js",
        "id": "org.apache.cordova.core.file.requestFileSystem",
        "clobbers": [
            "window.requestFileSystem"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file\\www\\resolveLocalFileSystemURI.js",
        "id": "org.apache.cordova.core.file.resolveLocalFileSystemURI",
        "clobbers": [
            "window.resolveLocalFileSystemURI"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file-transfer\\www\\FileTransferError.js",
        "id": "org.apache.cordova.core.file-transfer.FileTransferError",
        "clobbers": [
            "window.FileTransferError"
        ]
    },
    {
        "file": "plugins\\org.apache.cordova.core.file-transfer\\www\\FileTransfer.js",
        "id": "org.apache.cordova.core.file-transfer.FileTransfer",
        "clobbers": [
            "window.FileTransfer"
        ]
    },
    {
        "file": "plugins\\com.polyvi.xface.extension.zbar\\www\\zbar.js",
        "id": "com.polyvi.xface.extension.zbar.Zbar",
        "clobbers": [
            "window.Zbar"
        ]
    },
    {
        "file": "plugins\\com.polyvi.plugins.advancedfiletransfer\\www\\AdvancedFileTransfer.js",
        "id": "com.polyvi.plugins.advancedfiletransfer.AdvancedFileTransfer",
        "clobbers": [
            "window.AdvancedFileTransfer"
        ]
    },
	{
        "file": "plugins\\com.polyvi.xface.extension.push\\www\\PushNotification.js",
        "id": "com.polyvi.xface.extension.push.PushNotification",
        "clobbers": [
            "window.PushNotification"
        ]
    }
];
});
//file:plugins\org.apache.cordova.core.file\www\DirectoryEntry.js
define("org.apache.cordova.core.file.DirectoryEntry", function(require, exports, module) {

var argscheck = require('cordova/argscheck'),
    utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    Entry = require('./Entry'),
    FileError = require('./FileError'),
    DirectoryReader = require('./DirectoryReader');

/**
 * An interface representing a directory on the file system.
 *
 * {boolean} isFile always false (readonly)
 * {boolean} isDirectory always true (readonly)
 * {DOMString} name of the directory, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the directory (readonly)
 * TODO: implement this!!! {FileSystem} filesystem on which the directory resides (readonly)
 */
var DirectoryEntry = function(name, fullPath) {
     DirectoryEntry.__super__.constructor.call(this, false, true, name, fullPath);
};

utils.extend(DirectoryEntry, Entry);

/**
 * Creates a new DirectoryReader to read entries from this directory
 */
DirectoryEntry.prototype.createReader = function() {
    return new DirectoryReader(this.fullPath);
};

/**
 * Creates or looks up a directory
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a directory
 * @param {Flags} options to create or exclusively create the directory
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getDirectory = function(path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getDirectory', arguments);
    var win = successCallback && function(result) {
        var entry = new DirectoryEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getDirectory", [this.fullPath, path, options]);
};

/**
 * Deletes a directory and all of it's contents
 *
 * @param {Function} successCallback is called with no parameters
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.removeRecursively = function(successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'DirectoryEntry.removeRecursively', arguments);
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, "File", "removeRecursively", [this.fullPath]);
};

/**
 * Creates or looks up a file
 *
 * @param {DOMString} path either a relative or absolute path from this directory in which to look up or create a file
 * @param {Flags} options to create or exclusively create the file
 * @param {Function} successCallback is called with the new entry
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryEntry.prototype.getFile = function(path, options, successCallback, errorCallback) {
    argscheck.checkArgs('sOFF', 'DirectoryEntry.getFile', arguments);
    var win = successCallback && function(result) {
        var FileEntry = require('./FileEntry');
        var entry = new FileEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getFile", [this.fullPath, path, options]);
};

module.exports = DirectoryEntry;
});

//file:plugins\org.apache.cordova.core.file\www\DirectoryReader.js
define("org.apache.cordova.core.file.DirectoryReader", function(require, exports, module) {

var exec = require('cordova/exec'),
    FileError = require('./FileError') ;

/**
 * An interface that lists the files and directories in a directory.
 */
function DirectoryReader(path) {
    this.path = path || null;
    this.hasReadEntries = false;
}

/**
 * Returns a list of entries from a directory.
 *
 * @param {Function} successCallback is called with a list of entries
 * @param {Function} errorCallback is called with a FileError
 */
DirectoryReader.prototype.readEntries = function(successCallback, errorCallback) {
    // If we've already read and passed on this directory's entries, return an empty list.
    if (this.hasReadEntries) {
        successCallback([]);
        return;
    }
    var reader = this;
    var win = typeof successCallback !== 'function' ? null : function(result) {
        var retVal = [];
        for (var i=0; i<result.length; i++) {
            var entry = null;
            if (result[i].isDirectory) {
                entry = new (require('./DirectoryEntry'))();
            }
            else if (result[i].isFile) {
                entry = new (require('./FileEntry'))();
            }
            entry.isDirectory = result[i].isDirectory;
            entry.isFile = result[i].isFile;
            entry.name = result[i].name;
            entry.fullPath = result[i].fullPath;
            retVal.push(entry);
        }
        reader.hasReadEntries = true;
        successCallback(retVal);
    };
    var fail = typeof errorCallback !== 'function' ? null : function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "readEntries", [this.path]);
};

module.exports = DirectoryReader;
});

//file:plugins\org.apache.cordova.core.file\www\Entry.js
define("org.apache.cordova.core.file.Entry", function(require, exports, module) {

var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec'),
    FileError = require('./FileError'),
    Metadata = require('./Metadata');

/**
 * Represents a file or directory on the local file system.
 *
 * @param isFile
 *            {boolean} true if Entry is a file (readonly)
 * @param isDirectory
 *            {boolean} true if Entry is a directory (readonly)
 * @param name
 *            {DOMString} name of the file or directory, excluding the path
 *            leading to it (readonly)
 * @param fullPath
 *            {DOMString} the absolute full path to the file or directory
 *            (readonly)
 */
function Entry(isFile, isDirectory, name, fullPath, fileSystem) {
    this.isFile = !!isFile;
    this.isDirectory = !!isDirectory;
    this.name = name || '';
    this.fullPath = fullPath || '';
    this.filesystem = fileSystem || null;
}

/**
 * Look up the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 */
Entry.prototype.getMetadata = function(successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.getMetadata', arguments);
    var success = successCallback && function(lastModified) {
        var metadata = new Metadata(lastModified);
        successCallback(metadata);
    };
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };

    exec(success, fail, "File", "getMetadata", [this.fullPath]);
};

/**
 * Set the metadata of the entry.
 *
 * @param successCallback
 *            {Function} is called with a Metadata object
 * @param errorCallback
 *            {Function} is called with a FileError
 * @param metadataObject
 *            {Object} keys and values to set
 */
Entry.prototype.setMetadata = function(successCallback, errorCallback, metadataObject) {
    argscheck.checkArgs('FFO', 'Entry.setMetadata', arguments);
    exec(successCallback, errorCallback, "File", "setMetadata", [this.fullPath, metadataObject]);
};

/**
 * Move a file or directory to a new location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to move this entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new DirectoryEntry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.moveTo = function(parent, newName, successCallback, errorCallback) {
    argscheck.checkArgs('oSFF', 'Entry.moveTo', arguments);
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    // source path
    var srcPath = this.fullPath,
        // entry name
        name = newName || this.name,
        success = function(entry) {
            if (entry) {
                if (successCallback) {
                    // create appropriate Entry object
                    var result = (entry.isDirectory) ? new (require('./DirectoryEntry'))(entry.name, entry.fullPath) : new (require('org.apache.cordova.core.file.FileEntry'))(entry.name, entry.fullPath);
                    successCallback(result);
                }
            }
            else {
                // no Entry object returned
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        };

    // copy
    exec(success, fail, "File", "moveTo", [srcPath, parent.fullPath, name]);
};

/**
 * Copy a directory to a different location.
 *
 * @param parent
 *            {DirectoryEntry} the directory to which to copy the entry
 * @param newName
 *            {DOMString} new name of the entry, defaults to the current name
 * @param successCallback
 *            {Function} called with the new Entry object
 * @param errorCallback
 *            {Function} called with a FileError
 */
Entry.prototype.copyTo = function(parent, newName, successCallback, errorCallback) {
    argscheck.checkArgs('oSFF', 'Entry.copyTo', arguments);
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };

        // source path
    var srcPath = this.fullPath,
        // entry name
        name = newName || this.name,
        // success callback
        success = function(entry) {
            if (entry) {
                if (successCallback) {
                    // create appropriate Entry object
                    var result = (entry.isDirectory) ? new (require('./DirectoryEntry'))(entry.name, entry.fullPath) : new (require('org.apache.cordova.core.file.FileEntry'))(entry.name, entry.fullPath);
                    successCallback(result);
                }
            }
            else {
                // no Entry object returned
                fail && fail(FileError.NOT_FOUND_ERR);
            }
        };

    // copy
    exec(success, fail, "File", "copyTo", [srcPath, parent.fullPath, name]);
};

/**
 * Return a URL that can be used to identify this entry.
 */
Entry.prototype.toURL = function() {
    // fullPath attribute contains the full URL
    return this.fullPath;
};

/**
 * Returns a URI that can be used to identify this entry.
 *
 * @param {DOMString} mimeType for a FileEntry, the mime type to be used to interpret the file, when loaded through this URI.
 * @return uri
 */
Entry.prototype.toURI = function(mimeType) {
    console.log("DEPRECATED: Update your code to use 'toURL'");
    // fullPath attribute contains the full URI
    return this.toURL();
};

/**
 * Remove a file or directory. It is an error to attempt to delete a
 * directory that is not empty. It is an error to attempt to delete a
 * root directory of a file system.
 *
 * @param successCallback {Function} called with no parameters
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.remove = function(successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.remove', arguments);
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(successCallback, fail, "File", "remove", [this.fullPath]);
};

/**
 * Look up the parent DirectoryEntry of this entry.
 *
 * @param successCallback {Function} called with the parent DirectoryEntry object
 * @param errorCallback {Function} called with a FileError
 */
Entry.prototype.getParent = function(successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'Entry.getParent', arguments);
    var win = successCallback && function(result) {
        var DirectoryEntry = require('./DirectoryEntry');
        var entry = new DirectoryEntry(result.name, result.fullPath);
        successCallback(entry);
    };
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getParent", [this.fullPath]);
};

module.exports = Entry;
});

//file:plugins\org.apache.cordova.core.file\www\File.js
define("org.apache.cordova.core.file.File", function(require, exports, module) {

/**
 * Constructor.
 * name {DOMString} name of the file, without path information
 * fullPath {DOMString} the full path of the file, including the name
 * type {DOMString} mime type
 * lastModifiedDate {Date} last modified date
 * size {Number} size of the file in bytes
 */

var File = function(name, fullPath, type, lastModifiedDate, size){
    this.name = name || '';
    this.fullPath = fullPath || null;
    this.type = type || null;
    this.lastModifiedDate = lastModifiedDate || null;
    this.size = size || 0;

    // These store the absolute start and end for slicing the file.
    this.start = 0;
    this.end = this.size;
};

/**
 * Returns a "slice" of the file. Since Cordova Files don't contain the actual
 * content, this really returns a File with adjusted start and end.
 * Slices of slices are supported.
 * start {Number} The index at which to start the slice (inclusive).
 * end {Number} The index at which to end the slice (exclusive).
 */
File.prototype.slice = function(start, end) {
    var size = this.end - this.start;
    var newStart = 0;
    var newEnd = size;
    if (arguments.length) {
        if (start < 0) {
            newStart = Math.max(size + start, 0);
        } else {
            newStart = Math.min(size, start);
        }
    }

    if (arguments.length >= 2) {
        if (end < 0) {
            newEnd = Math.max(size + end, 0);
        } else {
            newEnd = Math.min(end, size);
        }
    }

    var newFile = new File(this.name, this.fullPath, this.type, this.lastModifiedData, this.size);
    newFile.start = this.start + newStart;
    newFile.end = this.start + newEnd;
    return newFile;
};


module.exports = File;
});

//file:plugins\org.apache.cordova.core.file\www\FileEntry.js
define("org.apache.cordova.core.file.FileEntry", function(require, exports, module) {

var utils = require('cordova/utils'),
    exec = require('cordova/exec'),
    Entry = require('./Entry'),
    FileWriter = require('./FileWriter'),
    File = require('./File'),
    FileError = require('./FileError');

/**
 * An interface representing a file on the file system.
 *
 * {boolean} isFile always true (readonly)
 * {boolean} isDirectory always false (readonly)
 * {DOMString} name of the file, excluding the path leading to it (readonly)
 * {DOMString} fullPath the absolute full path to the file (readonly)
 * {FileSystem} filesystem on which the file resides (readonly)
 */
var FileEntry = function(name, fullPath) {
     FileEntry.__super__.constructor.apply(this, [true, false, name, fullPath]);
};

utils.extend(FileEntry, Entry);

/**
 * Creates a new FileWriter associated with the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new FileWriter
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.createWriter = function(successCallback, errorCallback) {
    this.file(function(filePointer) {
        var writer = new FileWriter(filePointer);

        if (writer.fileName === null || writer.fileName === "") {
            errorCallback && errorCallback(new FileError(FileError.INVALID_STATE_ERR));
        } else {
            successCallback && successCallback(writer);
        }
    }, errorCallback);
};

/**
 * Returns a File that represents the current state of the file that this FileEntry represents.
 *
 * @param {Function} successCallback is called with the new File object
 * @param {Function} errorCallback is called with a FileError
 */
FileEntry.prototype.file = function(successCallback, errorCallback) {
    var win = successCallback && function(f) {
        var file = new File(f.name, f.fullPath, f.type, f.lastModifiedDate, f.size);
        successCallback(file);
    };
    var fail = errorCallback && function(code) {
        errorCallback(new FileError(code));
    };
    exec(win, fail, "File", "getFileMetadata", [this.fullPath]);
};


module.exports = FileEntry;
});

//file:plugins\org.apache.cordova.core.file\www\FileError.js
define("org.apache.cordova.core.file.FileError", function(require, exports, module) {

/**
 * FileError
 */
function FileError(error) {
  this.code = error || null;
}

// File error codes
// Found in DOMException
FileError.NOT_FOUND_ERR = 1;
FileError.SECURITY_ERR = 2;
FileError.ABORT_ERR = 3;

// Added by File API specification
FileError.NOT_READABLE_ERR = 4;
FileError.ENCODING_ERR = 5;
FileError.NO_MODIFICATION_ALLOWED_ERR = 6;
FileError.INVALID_STATE_ERR = 7;
FileError.SYNTAX_ERR = 8;
FileError.INVALID_MODIFICATION_ERR = 9;
FileError.QUOTA_EXCEEDED_ERR = 10;
FileError.TYPE_MISMATCH_ERR = 11;
FileError.PATH_EXISTS_ERR = 12;

module.exports = FileError;
});

//file:plugins\org.apache.cordova.core.file\www\FileReader.js
define("org.apache.cordova.core.file.FileReader", function(require, exports, module) {

var exec = require('cordova/exec'),
    modulemapper = require('cordova/modulemapper'),
    utils = require('cordova/utils'),
    File = require('./File'),
    FileError = require('./FileError'),
    ProgressEvent = require('./ProgressEvent'),
    origFileReader = modulemapper.getOriginalSymbol(this, 'FileReader');

/**
 * This class reads the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To read from the SD card, the file name is "sdcard/my_file.txt"
 * @constructor
 */
var FileReader = function() {
    this._readyState = 0;
    this._error = null;
    this._result = null;
    this._fileName = '';
    this._realReader = origFileReader ? new origFileReader() : {};
};

// States
FileReader.EMPTY = 0;
FileReader.LOADING = 1;
FileReader.DONE = 2;

utils.defineGetter(FileReader.prototype, 'readyState', function() {
    return this._fileName ? this._readyState : this._realReader.readyState;
});

utils.defineGetter(FileReader.prototype, 'error', function() {
    return this._fileName ? this._error: this._realReader.error;
});

utils.defineGetter(FileReader.prototype, 'result', function() {
    return this._fileName ? this._result: this._realReader.result;
});

function defineEvent(eventName) {
    utils.defineGetterSetter(FileReader.prototype, eventName, function() {
        return this._realReader[eventName] || null;
    }, function(value) {
        this._realReader[eventName] = value;
    });
}
defineEvent('onloadstart');    // When the read starts.
defineEvent('onprogress');     // While reading (and decoding) file or fileBlob data, and reporting partial file data (progress.loaded/progress.total)
defineEvent('onload');         // When the read has successfully completed.
defineEvent('onerror');        // When the read has failed (see errors).
defineEvent('onloadend');      // When the request has completed (either in success or failure).
defineEvent('onabort');        // When the read has been aborted. For instance, by invoking the abort() method.

function initRead(reader, file) {
    // Already loading something
    if (reader.readyState == FileReader.LOADING) {
      throw new FileError(FileError.INVALID_STATE_ERR);
    }

    reader._result = null;
    reader._error = null;
    reader._readyState = FileReader.LOADING;

    if (typeof file.fullPath == 'string') {
        reader._fileName = file.fullPath;
    } else {
        reader._fileName = '';
        return true;
    }

    reader.onloadstart && reader.onloadstart(new ProgressEvent("loadstart", {target:reader}));
}

/**
 * Abort reading file.
 */
FileReader.prototype.abort = function() {
    if (origFileReader && !this._fileName) {
        return this._realReader.abort();
    }
    this._result = null;

    if (this._readyState == FileReader.DONE || this._readyState == FileReader.EMPTY) {
      return;
    }

    this._readyState = FileReader.DONE;

    // If abort callback
    if (typeof this.onabort === 'function') {
        this.onabort(new ProgressEvent('abort', {target:this}));
    }
    // If load end callback
    if (typeof this.onloadend === 'function') {
        this.onloadend(new ProgressEvent('loadend', {target:this}));
    }
};

/**
 * Read text file.
 *
 * @param file          {File} File object containing file properties
 * @param encoding      [Optional] (see http://www.iana.org/assignments/character-sets)
 */
FileReader.prototype.readAsText = function(file, encoding) {
    if (initRead(this, file)) {
        return this._realReader.readAsText(file, encoding);
    }

    // Default encoding is UTF-8
    var enc = encoding ? encoding : "UTF-8";
    var me = this;
    var execArgs = [this._fileName, enc, file.start, file.end];

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // Save result
            me._result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // DONE state
            me._readyState = FileReader.DONE;

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            // null result
            me._result = null;

            // Save error
            me._error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsText", execArgs);
};


/**
 * Read file and return data as a base64 encoded data url.
 * A data url is of the form:
 *      data:[<mediatype>][;base64],<data>
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsDataURL = function(file) {
    if (initRead(this, file)) {
        return this._realReader.readAsDataURL(file);
    }

    var me = this;
    var execArgs = [this._fileName, file.start, file.end];

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            // Save result
            me._result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            me._result = null;

            // Save error
            me._error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsDataURL", execArgs);
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsBinaryString = function(file) {
    if (initRead(this, file)) {
        return this._realReader.readAsBinaryString(file);
    }

    var me = this;
    var execArgs = [this._fileName, file.start, file.end];

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            me._result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            me._result = null;

            // Save error
            me._error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsBinaryString", execArgs);
};

/**
 * Read file and return data as a binary data.
 *
 * @param file          {File} File object containing file properties
 */
FileReader.prototype.readAsArrayBuffer = function(file) {
    if (initRead(this, file)) {
        return this._realReader.readAsArrayBuffer(file);
    }

    var me = this;
    var execArgs = [this._fileName, file.start, file.end];

    // Read file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            me._result = r;

            // If onload callback
            if (typeof me.onload === "function") {
                me.onload(new ProgressEvent("load", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me._readyState === FileReader.DONE) {
                return;
            }

            // DONE state
            me._readyState = FileReader.DONE;

            me._result = null;

            // Save error
            me._error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {target:me}));
            }

            // If onloadend callback
            if (typeof me.onloadend === "function") {
                me.onloadend(new ProgressEvent("loadend", {target:me}));
            }
        }, "File", "readAsArrayBuffer", execArgs);
};

module.exports = FileReader;
});

//file:plugins\org.apache.cordova.core.file\www\FileSystem.js
define("org.apache.cordova.core.file.FileSystem", function(require, exports, module) {

var DirectoryEntry = require('./DirectoryEntry');

/**
 * An interface representing a file system
 *
 * @constructor
 * {DOMString} name the unique name of the file system (readonly)
 * {DirectoryEntry} root directory of the file system (readonly)
 */
var FileSystem = function(name, root) {
    this.name = name || null;
    if (root) {
        this.root = new DirectoryEntry(root.name, root.fullPath);
    }
};

module.exports = FileSystem;
});

//file:plugins\org.apache.cordova.core.file\www\FileUploadOptions.js
define("org.apache.cordova.core.file.FileUploadOptions", function(require, exports, module) {

/**
 * Options to customize the HTTP request used to upload files.
 * @constructor
 * @param fileKey {String}   Name of file request parameter.
 * @param fileName {String}  Filename to be used by the server. Defaults to image.jpg.
 * @param mimeType {String}  Mimetype of the uploaded file. Defaults to image/jpeg.
 * @param params {Object}    Object with key: value params to send to the server.
 * @param headers {Object}   Keys are header names, values are header values. Multiple
 *                           headers of the same name are not supported.
 */
var FileUploadOptions = function(fileKey, fileName, mimeType, params, headers, httpMethod) {
    this.fileKey = fileKey || null;
    this.fileName = fileName || null;
    this.mimeType = mimeType || null;
    this.params = params || null;
    this.headers = headers || null;
    this.httpMethod = httpMethod || null;
};

module.exports = FileUploadOptions;
});

//file:plugins\org.apache.cordova.core.file\www\FileUploadResult.js
define("org.apache.cordova.core.file.FileUploadResult", function(require, exports, module) {

/**
 * FileUploadResult
 * @constructor
 */
var FileUploadResult = function() {
    this.bytesSent = 0;
    this.responseCode = null;
    this.response = null;
};

module.exports = FileUploadResult;
});

//file:plugins\org.apache.cordova.core.file\www\FileWriter.js
define("org.apache.cordova.core.file.FileWriter", function(require, exports, module) {

var exec = require('cordova/exec'),
    FileError = require('./FileError'),
    ProgressEvent = require('./ProgressEvent');

/**
 * This class writes to the mobile device file system.
 *
 * For Android:
 *      The root directory is the root of the file system.
 *      To write to the SD card, the file name is "sdcard/my_file.txt"
 *
 * @constructor
 * @param file {File} File object containing file properties
 * @param append if true write to the end of the file, otherwise overwrite the file
 */
var FileWriter = function(file) {
    this.fileName = "";
    this.length = 0;
    if (file) {
        this.fileName = file.fullPath || file;
        this.length = file.size || 0;
    }
    // default is to write at the beginning of the file
    this.position = 0;

    this.readyState = 0; // EMPTY

    this.result = null;

    // Error
    this.error = null;

    // Event handlers
    this.onwritestart = null;   // When writing starts
    this.onprogress = null;     // While writing the file, and reporting partial file data
    this.onwrite = null;        // When the write has successfully completed.
    this.onwriteend = null;     // When the request has completed (either in success or failure).
    this.onabort = null;        // When the write has been aborted. For instance, by invoking the abort() method.
    this.onerror = null;        // When the write has failed (see errors).
};

// States
FileWriter.INIT = 0;
FileWriter.WRITING = 1;
FileWriter.DONE = 2;

/**
 * Abort writing file.
 */
FileWriter.prototype.abort = function() {
    // check for invalid state
    if (this.readyState === FileWriter.DONE || this.readyState === FileWriter.INIT) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // set error
    this.error = new FileError(FileError.ABORT_ERR);

    this.readyState = FileWriter.DONE;

    // If abort callback
    if (typeof this.onabort === "function") {
        this.onabort(new ProgressEvent("abort", {"target":this}));
    }

    // If write end callback
    if (typeof this.onwriteend === "function") {
        this.onwriteend(new ProgressEvent("writeend", {"target":this}));
    }
};

/**
 * Writes data to the file
 *
 * @param data text or blob to be written
 */
FileWriter.prototype.write = function(data) {

    var that=this;
    var supportsBinary = (typeof window.Blob !== 'undefined' && typeof window.ArrayBuffer !== 'undefined');
    var isBinary;

    // Check to see if the incoming data is a blob
    if (data instanceof File || (supportsBinary && data instanceof Blob)) {
        var fileReader = new FileReader();
        fileReader.onload = function() {
            // Call this method again, with the arraybuffer as argument
            FileWriter.prototype.write.call(that, this.result);
        };
        if (supportsBinary) {
            fileReader.readAsArrayBuffer(data);
        } else {
            fileReader.readAsText(data);
        }
        return;
    }

    // Mark data type for safer transport over the binary bridge
    isBinary = supportsBinary && (data instanceof ArrayBuffer);

    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === "function") {
        me.onwritestart(new ProgressEvent("writestart", {"target":me}));
    }

    // Write file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // position always increases by bytes written because file would be extended
            me.position += r;
            // The length of the file is now where we are done writing.

            me.length = me.position;

            // DONE state
            me.readyState = FileWriter.DONE;

            // If onwrite callback
            if (typeof me.onwrite === "function") {
                me.onwrite(new ProgressEvent("write", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        }, "File", "write", [this.fileName, data, this.position, isBinary]);
};

/**
 * Moves the file pointer to the location specified.
 *
 * If the offset is a negative number the position of the file
 * pointer is rewound.  If the offset is greater than the file
 * size the position is set to the end of the file.
 *
 * @param offset is the location to move the file pointer to.
 */
FileWriter.prototype.seek = function(offset) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    if (!offset && offset !== 0) {
        return;
    }

    // See back from end of file.
    if (offset < 0) {
        this.position = Math.max(offset + this.length, 0);
    }
    // Offset is bigger than file size so set position
    // to the end of the file.
    else if (offset > this.length) {
        this.position = this.length;
    }
    // Offset is between 0 and file size so set the position
    // to start writing.
    else {
        this.position = offset;
    }
};

/**
 * Truncates the file to the size specified.
 *
 * @param size to chop the file at.
 */
FileWriter.prototype.truncate = function(size) {
    // Throw an exception if we are already writing a file
    if (this.readyState === FileWriter.WRITING) {
        throw new FileError(FileError.INVALID_STATE_ERR);
    }

    // WRITING state
    this.readyState = FileWriter.WRITING;

    var me = this;

    // If onwritestart callback
    if (typeof me.onwritestart === "function") {
        me.onwritestart(new ProgressEvent("writestart", {"target":this}));
    }

    // Write file
    exec(
        // Success callback
        function(r) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Update the length of the file
            me.length = r;
            me.position = Math.min(me.position, r);

            // If onwrite callback
            if (typeof me.onwrite === "function") {
                me.onwrite(new ProgressEvent("write", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        },
        // Error callback
        function(e) {
            // If DONE (cancelled), then don't do anything
            if (me.readyState === FileWriter.DONE) {
                return;
            }

            // DONE state
            me.readyState = FileWriter.DONE;

            // Save error
            me.error = new FileError(e);

            // If onerror callback
            if (typeof me.onerror === "function") {
                me.onerror(new ProgressEvent("error", {"target":me}));
            }

            // If onwriteend callback
            if (typeof me.onwriteend === "function") {
                me.onwriteend(new ProgressEvent("writeend", {"target":me}));
            }
        }, "File", "truncate", [this.fileName, size]);
};

module.exports = FileWriter;
});

//file:plugins\org.apache.cordova.core.file\www\Flags.js
define("org.apache.cordova.core.file.Flags", function(require, exports, module) {

/**
 * Supplies arguments to methods that lookup or create files and directories.
 *
 * @param create
 *            {boolean} file or directory if it doesn't exist
 * @param exclusive
 *            {boolean} used with create; if true the command will fail if
 *            target path exists
 */
function Flags(create, exclusive) {
    this.create = create || false;
    this.exclusive = exclusive || false;
}

module.exports = Flags;
});

//file:plugins\org.apache.cordova.core.file\www\LocalFileSystem.js
define("org.apache.cordova.core.file.LocalFileSystem", function(require, exports, module) {

var exec = require('cordova/exec');

/**
 * Represents a local file system.
 */
var LocalFileSystem = function() {

};

LocalFileSystem.TEMPORARY = 0; //temporary, with no guarantee of persistence
LocalFileSystem.PERSISTENT = 1; //persistent

module.exports = LocalFileSystem;
});

//file:plugins\org.apache.cordova.core.file\www\Metadata.js
define("org.apache.cordova.core.file.Metadata", function(require, exports, module) {

/**
 * Information about the state of the file or directory
 *
 * {Date} modificationTime (readonly)
 */
var Metadata = function(time) {
    this.modificationTime = (typeof time != 'undefined'?new Date(time):null);
};

module.exports = Metadata;
});

//file:plugins\org.apache.cordova.core.file\www\ProgressEvent.js
define("org.apache.cordova.core.file.ProgressEvent", function(require, exports, module) {

// If ProgressEvent exists in global context, use it already, otherwise use our own polyfill
// Feature test: See if we can instantiate a native ProgressEvent;
// if so, use that approach,
// otherwise fill-in with our own implementation.
//
// NOTE: right now we always fill in with our own. Down the road would be nice if we can use whatever is native in the webview.
var ProgressEvent = (function() {
    /*
    var createEvent = function(data) {
        var event = document.createEvent('Events');
        event.initEvent('ProgressEvent', false, false);
        if (data) {
            for (var i in data) {
                if (data.hasOwnProperty(i)) {
                    event[i] = data[i];
                }
            }
            if (data.target) {
                // TODO: cannot call <some_custom_object>.dispatchEvent
                // need to first figure out how to implement EventTarget
            }
        }
        return event;
    };
    try {
        var ev = createEvent({type:"abort",target:document});
        return function ProgressEvent(type, data) {
            data.type = type;
            return createEvent(data);
        };
    } catch(e){
    */
        return function ProgressEvent(type, dict) {
            this.type = type;
            this.bubbles = false;
            this.cancelBubble = false;
            this.cancelable = false;
            this.lengthComputable = false;
            this.loaded = dict && dict.loaded ? dict.loaded : 0;
            this.total = dict && dict.total ? dict.total : 0;
            this.target = dict && dict.target ? dict.target : null;
        };
    //}
})();

module.exports = ProgressEvent;
});

//file:plugins\org.apache.cordova.core.file\www\requestFileSystem.js
define("org.apache.cordova.core.file.requestFileSystem", function(require, exports, module) {

var argscheck = require('cordova/argscheck'),
    FileError = require('./FileError'),
    FileSystem = require('./FileSystem'),
    exec = require('cordova/exec');

/**
 * Request a file system in which to store application data.
 * @param type  local file system type
 * @param size  indicates how much storage space, in bytes, the application expects to need
 * @param successCallback  invoked with a FileSystem object
 * @param errorCallback  invoked if error occurs retrieving file system
 */
var requestFileSystem = function(type, size, successCallback, errorCallback) {
    argscheck.checkArgs('nnFF', 'requestFileSystem', arguments);
    var fail = function(code) {
        errorCallback && errorCallback(new FileError(code));
    };

    if (type < 0 || type > 3) {
        fail(FileError.SYNTAX_ERR);
    } else {
        // if successful, return a FileSystem object
        var success = function(file_system) {
            if (file_system) {
                if (successCallback) {
                    // grab the name and root from the file system object
                    var result = new FileSystem(file_system.name, file_system.root);
                    successCallback(result);
                }
            }
            else {
                // no FileSystem object returned
                fail(FileError.NOT_FOUND_ERR);
            }
        };
        exec(success, fail, "File", "requestFileSystem", [type, size]);
    }
};

module.exports = requestFileSystem;
});

//file:plugins\org.apache.cordova.core.file\www\resolveLocalFileSystemURI.js
define("org.apache.cordova.core.file.resolveLocalFileSystemURI", function(require, exports, module) {

var argscheck = require('cordova/argscheck'),
    DirectoryEntry = require('./DirectoryEntry'),
    FileEntry = require('./FileEntry'),
    FileError = require('./FileError'),
    exec = require('cordova/exec');

/**
 * Look up file system Entry referred to by local URI.
 * @param {DOMString} uri  URI referring to a local file or directory
 * @param successCallback  invoked with Entry object corresponding to URI
 * @param errorCallback    invoked if error occurs retrieving file system entry
 */
module.exports = function(uri, successCallback, errorCallback) {
    argscheck.checkArgs('sFF', 'resolveLocalFileSystemURI', arguments);
    // error callback
    var fail = function(error) {
        errorCallback && errorCallback(new FileError(error));
    };
    // sanity check for 'not:valid:filename'
    if(!uri || uri.split(":").length > 2) {
        setTimeout( function() {
            fail(FileError.ENCODING_ERR);
        },0);
        return;
    }
    // if successful, return either a file or directory entry
    var success = function(entry) {
        var result;
        if (entry) {
            if (successCallback) {
                // create appropriate Entry object
                result = (entry.isDirectory) ? new DirectoryEntry(entry.name, entry.fullPath) : new FileEntry(entry.name, entry.fullPath);
                successCallback(result);
            }
        }
        else {
            // no Entry object returned
            fail(FileError.NOT_FOUND_ERR);
        }
    };

    exec(success, fail, "File", "resolveLocalFileSystemURI", [uri]);
};
});

//file:plugins\org.apache.cordova.core.file-transfer\www\FileTransferError.js
define("org.apache.cordova.core.file-transfer.FileTransferError", function(require, exports, module) {

/**
 * FileTransferError
 * @constructor
 */
var FileTransferError = function(code, source, target, status, body) {
    this.code = code || null;
    this.source = source || null;
    this.target = target || null;
    this.http_status = status || null;
    this.body = body || null;
};

FileTransferError.FILE_NOT_FOUND_ERR = 1;
FileTransferError.INVALID_URL_ERR = 2;
FileTransferError.CONNECTION_ERR = 3;
FileTransferError.ABORT_ERR = 4;

module.exports = FileTransferError;
});

//file:plugins\org.apache.cordova.core.file-transfer\www\FileTransfer.js
define("org.apache.cordova.core.file-transfer.FileTransfer", function(require, exports, module) {

var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec'),
    FileTransferError = require('./FileTransferError'),
    ProgressEvent = require('org.apache.cordova.core.file.ProgressEvent');

function newProgressEvent(result) {
    var pe = new ProgressEvent();
    pe.lengthComputable = result.lengthComputable;
    pe.loaded = result.loaded;
    pe.total = result.total;
    return pe;
}

function getBasicAuthHeader(urlString) {
    var header =  null;

    if (window.btoa) {
        // parse the url using the Location object
        var url = document.createElement('a');
        url.href = urlString;

        var credentials = null;
        var protocol = url.protocol + "//";
        var origin = protocol + url.host;

        // check whether there are the username:password credentials in the url
        if (url.href.indexOf(origin) !== 0) { // credentials found
            var atIndex = url.href.indexOf("@");
            credentials = url.href.substring(protocol.length, atIndex);
        }

        if (credentials) {
            var authHeader = "Authorization";
            var authHeaderValue = "Basic " + window.btoa(credentials);

            header = {
                name : authHeader,
                value : authHeaderValue
            };
        }
    }

    return header;
}

var idCounter = 0;

/**
 * FileTransfer uploads a file to a remote server.
 * @constructor
 */
var FileTransfer = function() {
    this._id = ++idCounter;
    this.onprogress = null; // optional callback
};

/**
* Given an absolute file path, uploads a file on the device to a remote server
* using a multipart HTTP request.
* @param filePath {String}           Full path of the file on the device
* @param server {String}             URL of the server to receive the file
* @param successCallback (Function}  Callback to be invoked when upload has completed
* @param errorCallback {Function}    Callback to be invoked upon error
* @param options {FileUploadOptions} Optional parameters such as file name and mimetype
* @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
*/
FileTransfer.prototype.upload = function(filePath, server, successCallback, errorCallback, options, trustAllHosts) {
    argscheck.checkArgs('ssFFO*', 'FileTransfer.upload', arguments);
    // check for options
    var fileKey = null;
    var fileName = null;
    var mimeType = null;
    var params = null;
    var chunkedMode = true;
    var headers = null;
    var httpMethod = null;
    var basicAuthHeader = getBasicAuthHeader(server);
    if (basicAuthHeader) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    if (options) {
        fileKey = options.fileKey;
        fileName = options.fileName;
        mimeType = options.mimeType;
        headers = options.headers;
        httpMethod = options.httpMethod || "POST";
        if (httpMethod.toUpperCase() == "PUT"){
            httpMethod = "PUT";
        } else {
            httpMethod = "POST";
        }
        if (options.chunkedMode !== null || typeof options.chunkedMode != "undefined") {
            chunkedMode = options.chunkedMode;
        }
        if (options.params) {
            params = options.params;
        }
        else {
            params = {};
        }
    }

    var fail = errorCallback && function(e) {
        var error = new FileTransferError(e.code, e.source, e.target, e.http_status, e.body);
        errorCallback(error);
    };

    var self = this;
    var win = function(result) {
        if (typeof result.lengthComputable != "undefined") {
            if (self.onprogress) {
                self.onprogress(newProgressEvent(result));
            }
        } else {
            successCallback && successCallback(result);
        }
    };
    exec(win, fail, 'FileTransfer', 'upload', [filePath, server, fileKey, fileName, mimeType, params, trustAllHosts, chunkedMode, headers, this._id, httpMethod]);
};

/**
 * Downloads a file form a given URL and saves it to the specified directory.
 * @param source {String}          URL of the server to receive the file
 * @param target {String}         Full path of the file on the device
 * @param successCallback (Function}  Callback to be invoked when upload has completed
 * @param errorCallback {Function}    Callback to be invoked upon error
 * @param trustAllHosts {Boolean} Optional trust all hosts (e.g. for self-signed certs), defaults to false
 * @param options {FileDownloadOptions} Optional parameters such as headers
 */
FileTransfer.prototype.download = function(source, target, successCallback, errorCallback, trustAllHosts, options) {
    argscheck.checkArgs('ssFF*', 'FileTransfer.download', arguments);
    var self = this;

    var basicAuthHeader = getBasicAuthHeader(source);
    if (basicAuthHeader) {
        options = options || {};
        options.headers = options.headers || {};
        options.headers[basicAuthHeader.name] = basicAuthHeader.value;
    }

    var headers = null;
    if (options) {
        headers = options.headers || null;
    }

    var win = function(result) {
        if (typeof result.lengthComputable != "undefined") {
            if (self.onprogress) {
                return self.onprogress(newProgressEvent(result));
            }
        } else if (successCallback) {
            var entry = null;
            if (result.isDirectory) {
                entry = new (require('org.apache.cordova.core.file.DirectoryEntry'))();
            }
            else if (result.isFile) {
                entry = new (require('org.apache.cordova.core.file.FileEntry'))();
            }
            entry.isDirectory = result.isDirectory;
            entry.isFile = result.isFile;
            entry.name = result.name;
            entry.fullPath = result.fullPath;
            successCallback(entry);
        }
    };

    var fail = errorCallback && function(e) {
        var error = new FileTransferError(e.code, e.source, e.target, e.http_status, e.body);
        errorCallback(error);
    };

    exec(win, fail, 'FileTransfer', 'download', [source, target, trustAllHosts, this._id, headers]);
};

/**
 * Aborts the ongoing file transfer on this object. The original error
 * callback for the file transfer will be called if necessary.
 */
FileTransfer.prototype.abort = function() {
    exec(null, null, 'FileTransfer', 'abort', [this._id]);
};

module.exports = FileTransfer;
});

//file:plugins\com.polyvi.xface.extension.zbar\www\zbar.js
define("com.polyvi.xface.extension.zbar.Zbar", function(require, exports, module) {
n/*
 Copyright 2012-2013, Polyvi Inc. (http://www.xface3.com)
 This program is distributed under the terms of the GNU General Public License.

 This file is part of xFace.

 xFace is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 xFace is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU Geeral Public License
 along with xFace.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * 该模块提供条形码扫描的功能
 * @module zbar
 * @main zbar
 */

 /**
  * Zbar扩展提供条形码扫描的功能（Android, iOS, WP8）<br/>
  * 该类不能通过new来创建相应的对象，只能通过xFace.BarcodeScanner对象来直接使用该类中定义的方法
  * @class Zbar
  * @static
  * @platform Android, iOS, WP8
  * @since 3.0.0
  */
var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec');
function Zbar(){}

/**
 * 启动条形码扫描器（Android, iOS, WP8）<br/>
 * 该方法通过异步方式尝试扫描条形码。如果扫描成功，成功回调被调用并传回barcode的字符串；否则失败回调被调用。
  @example
      function start() {
          Zbar.start(success, fail);
      }
      function success(barcode) {
          alert(barcode);
          alert("success");
      }
      function fail() {
          alert("fail to scanner barcode" );
      }
 * @method start
 * @param {Function} successCallback   成功回调函数
 * @param {String} successCallback.barcode 扫描码结果
 * @param {Function} [errorCallback]   失败回调函数
 * @platform Android, iOS, WP8
 * @since 3.0.0
 */
Zbar.prototype.start = function(successCallback, errorCallback){
    argscheck.checkArgs('FF', 'Zbar.start', arguments);
    exec(successCallback, errorCallback, "Zbar", "start", []);
};

module.exports = new Zbar();
});

//file:plugins\com.polyvi.plugins.advancedfiletransfer\www\AdvancedFileTransfer.js
define("com.polyvi.plugins.advancedfiletransfer.AdvancedFileTransfer", function(require, exports, module) {
/*
 Copyright 2012-2013, Polyvi Inc. (http://www.xface3.com)
 This program is distributed under the terms of the GNU General Public License.

 This file is part of xFace.

 xFace is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 xFace is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with xFace.  If not, see <http://www.gnu.org/licenses/>.
 */

 /**
 * 该模块提供条文件下载功能
 * @module AdvancedFileTransfer
 * @main AdvancedFileTransfer
 */

	var require = cordova.require;
	var exec = require('cordova/exec');
	var DirectoryEntry = require('org.apache.cordova.core.file.DirectoryEntry');
    var FileEntry = require('org.apache.cordova.core.file.FileEntry');

	var AdvancedFileTransfer = function(source, target, isUpload){
		this.source = source;
		this.target = target;
	    this.isUpload = isUpload || false;
	    this.onprogress = null;
	};

/**
 * 开始文件下载（Android）<br/>
  @example
      var source = "http://www.polyvi.net:8012/develop/TrafficStats/chmdecoder.zip";
      var target = "/mnt/sdcard/fileloadfile/chmdecoder.zip";
      function download(){
        var fileTransfer = new AdvancedFileTransfer(source, target);
        fileTransfer.download(downloadSuccess, downloadFail);
      };
      function downloadSuccess(result){
        if(result.status == "unfinished"){
          var res = "completeSize:" + result.loaded;
          document.getElementById('status').innerText = "downloading";
          document.getElementById('result').innerText = res;
        }else{
          var res = "file: " + result.name + " has been downloaded";
          document.getElementById('status').innerText = "download successfully";
          document.getElementById('result').innerText = res;
        }
      };
      function downloadFail(result){
        var res = "result code " + result.code;
        document.getElementById('status').innerText = "fail";
        document.getElementById('result').innerText = res;
      };		
 */
	AdvancedFileTransfer.prototype.download = function(successCallback, errorCallback){
		var win = function(result) {
	        var entry = null;
	        if (result.isDirectory) {
	            entry = new DirectoryEntry();
	        }
	        else if (result.isFile) {
	            entry = new FileEntry();
	        }
	        entry.isDirectory = result.isDirectory;
	        entry.isFile = result.isFile;
	        entry.name = result.name;
	        entry.fullPath = result.fullPath;
	        successCallback(entry);
	    };	 
		exec(successCallback, errorCallback, "AdvancedFileTransfer", "download", [this.source, this.target]);
	};

/**
 * 暂停文件传输（Android）<br/> 
  @example
      function pause(){
        var fileTransfer = new AdvancedFileTransfer(source, target);
        fileTransfer.pause();
      };
 */
	AdvancedFileTransfer.prototype.pause = function(){
		exec(null, null, "AdvancedFileTransfer", "pause", [this.source]);
	};

/**
 * 取消文件传输任务（Android）<br/> 
  @example
      function cancel(){
        var fileTransfer = new AdvancedFileTransfer(source, target);
        fileTransfer.cancel();
      };
 */
	AdvancedFileTransfer.prototype.cancel = function(){
		exec(null, null, "AdvancedFileTransfer", "cancel", [this.source, this.target]);
	};

	module.exports = AdvancedFileTransfer;
});
//file:plugins\com.polyvi.xface.extension.push\www\PushNotification.js
define("com.polyvi.xface.extension.push.PushNotification", function(require, exports, module) {
/*
 Copyright 2012-2013, Polyvi Inc. (http://www.xface3.com)
 This program is distributed under the terms of the GNU General Public License.

 This file is part of xFace.

 xFace is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 xFace is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with xFace.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
* 该模块提供向手机推送消息的功能
* @module push
* @main push
*/

/**
* 该类提供向手机推送消息的功能(Android, iOS, WP8)<br/>
* 该类不能通过new来创建相应的对象,只能通过xFace.PushNotification对象来直接使用该类定义的方法
* @class PushNotification
* @static
* @platform Android,iOS,WP8
* @since 3.0.0
*/
var exec = require('cordova/exec');
var argscheck = require('cordova/argscheck');
var PushNotification = function() {
    this.onReceived = null;
};

/**
* 当收到推送通知的回调函数
*/
PushNotification.prototype.fire = function(pushString) {
    if (this.onReceived) {
        this.onReceived(pushString);
    }
};

/**
* 注册一个监听器, 当手机收到推送消息时，该监听器会被回调(Android, iOS, WP8)<br/>
* @example
        xFace.PushNotification.registerOnReceivedListener(printPushData);
        function printPushData(info){
                alert(info);
            }
*@method registerOnReceivedListener
*@param {Function} listener 收到通知的监听
*@param {String} listener.message 收到通知的内容
*@platform Android, iOS, WP8
*@since 3.0.0
*/
PushNotification.prototype.registerOnReceivedListener = function(listener) {

    argscheck.checkArgs('f', 'PushNotification.registerOnReceivedListener', arguments);
    this.onReceived = listener;
    exec(null, null,"PushNotification", "registerOnReceivedListener", []);

};

/**
* 获取手机设备的唯一标识符(以UUID作为唯一标识符)(Android, iOS, WP8)<br/>
* @example
        xFace.PushNotification.getDeviceToken(success, error);
        function success(deviceToken){
                alert(deviceToken);
            };
        function error(err){
                alert(err);
            };
*@method getDeviceToken
*@param {Function} [successCallback] 成功回调函数
*@param {String} successCallback.deviceToken 手机的唯一标识符
*@param {Function} [errorCallback] 失败回调函数
*@param {String} errorCallback.err 失败的描述信息
*@platform Android, iOS, WP8
*@since 3.0.0
*/
PushNotification.prototype.getDeviceToken = function(successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'PushNotification.getDeviceToken', arguments);
    exec(successCallback, errorCallback,"PushNotification", "getDeviceToken", []);
};

/**
* 通过服务器地址,端口号打开Push(Android)<br/>
* @example
        xFace.PushNotification.open(host,port,success, error);
        function success(deviceToken){
                alert(deviceToken);
            };
        function error(err){
                alert(err);
            };
*@method openPush
*@param {String} host 服务器的地址
*@param {String} port 服务器的端口号
*@param {Function} [successCallback] 成功回调函数
*@param {Function} [errorCallback] 失败回调函数
*@param {String} errorCallback.err 失败的描述信息
*@platform Android
*@since 3.0.0
*/
PushNotification.prototype.open = function(host,port,successCallback, errorCallback) {
    argscheck.checkArgs('FF', 'PushNotification.open', arguments);
    exec(successCallback, errorCallback,"PushNotification", "open", [host,port]);
	};

module.exports = new PushNotification();
});

window.cordova = require('cordova');
// file: lib/scripts/bootstrap.js

(function (context) {
    if (context._cordovaJsLoaded) {
        throw new Error('cordova.js included multiple times.');
    }
    context._cordovaJsLoaded = true;

    var channel = require('cordova/channel');
    var pluginloader = require('cordova/pluginloader');

    var platformInitChannelsArray = [channel.onNativeReady, channel.onPluginsReady];

    function logUnfiredChannels(arr) {
        for (var i = 0; i < arr.length; ++i) {
            if (arr[i].state != 2) {
                console.log('Channel not fired: ' + arr[i].type);
            }
        }
    }

    window.setTimeout(function() {
        if (channel.onDeviceReady.state != 2) {
            console.log('deviceready has not fired after 5 seconds.');
            logUnfiredChannels(platformInitChannelsArray);
            logUnfiredChannels(channel.deviceReadyChannelsArray);
        }
    }, 5000);

    // Replace navigator before any modules are required(), to ensure it happens as soon as possible.
    // We replace it so that properties that can't be clobbered can instead be overridden.
    function replaceNavigator(origNavigator) {
        var CordovaNavigator = function() {};
        CordovaNavigator.prototype = origNavigator;
        var newNavigator = new CordovaNavigator();
        // This work-around really only applies to new APIs that are newer than Function.bind.
        // Without it, APIs such as getGamepads() break.
        if (CordovaNavigator.bind) {
            for (var key in origNavigator) {
                if (typeof origNavigator[key] == 'function') {
                    newNavigator[key] = origNavigator[key].bind(origNavigator);
                }
            }
        }
        return newNavigator;
    }
    if (context.navigator) {
        context.navigator = replaceNavigator(context.navigator);
    }

    // _nativeReady is global variable that the native side can set
    // to signify that the native code is ready. It is a global since
    // it may be called before any cordova JS is ready.
    if (window._nativeReady) {
        channel.onNativeReady.fire();
    }

    /**
     * Create all cordova objects once native side is ready.
     */
    channel.join(function() {
        // Call the platform-specific initialization
        require('cordova/platform').initialize();

        // Fire event to notify that all objects are created
        channel.onCordovaReady.fire();

        // Fire onDeviceReady event once page has fully loaded, all
        // constructors have run and cordova info has been received from native
        // side.
        // This join call is deliberately made after platform.initialize() in
        // order that plugins may manipulate channel.deviceReadyChannelsArray
        // if necessary.
        channel.join(function() {
            require('cordova').fireDocumentEvent('deviceready');
        }, channel.deviceReadyChannelsArray);

    }, platformInitChannelsArray);

    // Don't attempt to load when running unit tests.
    if (typeof XMLHttpRequest != 'undefined') {
        pluginloader.load();
    }
}(window));

// file: lib/scripts/bootstrap-android.js

// Tell the native code that a page change has occurred.
require('cordova/exec')(null, null, 'PluginManager', 'startup', []);
require('cordova/channel').onNativeReady.fire();

})();