/**
 * Created by John LIm on 9/3/2017.
 */


module.exports = function (s) {
    var sessionid = s;

    var module = {};
    var irc = require('irc');
    var pipedXdcc = require("piped-xdcc");
    var fs = require("fs");
    var mime = require('mime-types');

    var finished = function() {
        if (global.client !== null) {
            global.client.say(global.botname, "XDCC CANCEL");
            console.log("DISCONNECTED");
            global.client.removeAllListeners('join');
            global.client.removeAllListeners('notice');
            global.client.removeAllListeners('error');
            global.client.disconnect();
        }
        console.log("RESET name");
        global.lastInfo.busy = false;
        global.lastInfo.lastTitle = "pending";
        global.lastInfo.lastPercentage = "0";
        global.botname = "";
    };

    module.stream = function (req, res) {
        var session = sessionid;
        if (global.endPipe !== null) {

            console.log("myConfig = " + myConfig);
            res.writeHead(200, {
                'Content-Type': mime.contentType(myConfig.filename),
                'Content-Disposition': 'attachment; filename="' + myConfig.filename + '"; modification-date="Wed, 12 Feb 1997 16:29:51 -0500"',
                'Content-Length' : myConfig.filesize
            });
            global.endPipe.pipe(res);

            res.on('close', function() {
                console.log(session);
                if (global.io.sockets.connected[session]) {
                    global.io.sockets.connected[session].emit("download", {"finished": true});
                }
                console.log('SOCKETPLZ');
                console.log('file done');
                finished();
                res.status(400);
            }).on('error', function() {
                if (global.io.sockets.connected[session]) {
                    global.io.sockets.connected[session].emit("errormsg", "Connection aborted. Try again");
                }
                console.log('ERROR');
                finished();
                res.status(400);
            });
        } else {
            res.send("not initialized for some reason");
        }
    };

    module.cancel = function (req, res) {
        finished();
        console.log("visited cancel");
        if (global.endPipe != null) {
            global.endPipe.end();
        }
        res.send("canceled");

        // res.redirect("http" + (req.socket.encrypted ? "s" : "") + "://" +
        //     req.headers.host + "/mongolian/error/");
    };

    module.connectIRC = function (bot, pack) {
        global.botname = bot;
        var url = 'irc.rizon.net';
        var user = 'desu' + Math.random().toString(36).substr(7, 3);

        console.log('Connecting to ' + url);

        global.client = new irc.Client(url, user, {
            channels: ['#nibl'],
            userName: user,
            realName: user
        });

        var pipeCallback = function (message, xdccInstance) {
            global.endPipe = xdccInstance;

            var percentage = 0;

            if (message == null) {
                console.log("it probably went good");

                xdccInstance.on('connect', function (config) {
                        console.log("config = " + config.filesize);
                        global.myConfig = {
                            command: config.command,
                            filename: config.filename,
                            ip : config.ip,
                            port : config.port,
                            filesize : config.filesize
                        };
                        global.lastInfo.lastTitle = config.filename;
                        let startConfig = {
                            filename : config.filename,
                            ip : config.ip,
                            port : config.port
                        };

                        global.checkIfStuck = setTimeout(function () {
                            if (global.lastInfo.lastPercentage == "0" && startConfig.filename == global.lastInfo.lastTitle && startConfig.ip == global.lastInfo.ip && startConfig.port == global.lastInfo.port) {
                                if (global.io.sockets.connected[sessionid]) {
                                    global.io.sockets.connected[sessionid].emit("errormsg", "Request timed out. Try another bot.");
                                }
                                console.log("Timed out");
                                finished();
                            }
                            global.checkIfStuck = null;
                        }, 30000, startConfig);
                    global.io.sockets.connected[sessionid].emit("download", config);
                    }
                );

                xdccInstance.on('progress', function (totalReceived) {
                    clearTimeout(global.checkIfStuck);
                    global.checkIfStuck = null;
                    let temp = Math.round((totalReceived * 100) / global.myConfig.filesize );
                    if (temp > percentage) {
                        if (global.io.sockets.connected[sessionid]) {
                            global.io.sockets.connected[sessionid].emit("downloading", {name: global.myConfig.filename, percent : temp});
                        }
                        global.lastInfo.lastPercentage = temp;
                        console.log( percentage + "% " + totalReceived + " / " + global.myConfig.filesize);
                        percentage = temp;
                    }
                });

                xdccInstance.on('complete', function (config) {
                    if (global.io.sockets.connected[sessionid]) {
                        global.io.sockets.connected[sessionid].emit("download", {finished : true});
                    }
                    console.log("Downloaded " + config.filename + " from " + config.ip);
                    global.endPipe = null;
                    finished();
                });

                xdccInstance.on('dlerror', function (error, config) {
                    console.log("Error");
                    console.log(error);
                    if (global.io.sockets.connected[sessionid]) {
                        global.io.sockets.connected[sessionid].emit("errormsg", error);
                    }
                    global.endPipe = null;
                    finished();
                });
            } else {
                if (global.io.sockets.connected[sessionid]) {
                    global.io.sockets.connected[sessionid].emit("errormsg", message);
                }
                console.log(message);
                global.endPipe = null;
                finished();
            }
        };

        global.client.on('join', function(channel, nick, message) {
            if (nick !== user) return;
            console.log('Joined ', channel);
            pipedXdcc.pipeXdccRequest(global.client, {botNickname: bot, packNumber: pack}, pipeCallback);
        });

        global.client.on('notice', function(from, to, message) {
            if (to == user && from == bot) {
                console.log("[notice]", message);
                if (global.io.sockets.connected[sessionid]) {
                global.io.sockets.connected[sessionid].emit("errormsg", message);
                }
            }
        });

        global.client.on('error', function(message) {
            console.log("[error]", message);
            if (global.io.sockets.connected[sessionid]) {
                global.io.sockets.connected[sessionid].emit("errormsg", message);
            }
            finished();
        });
    };

    return module;
};