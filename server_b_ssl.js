/*
 * Michat Server
 * Created by Shuqiao Zhang in 2018.
 * https://zhangshuqiao.org
 */

/* 
 * This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 */

const program = require("commander"),
	fs = require("fs");

program
	.version("0.1.1b", "-v, --version")
	.description("Michat WebSocket server version 0.1.1b Copyright (c) 2018 Steven Joe 'Mimi' Zhang")
	.usage("_(:з」∠)_")
	.option("-d, --debug", "show logs in the console in order to debug")
	.option("-m, --multi", "write logs to different files accroading to the channel")
	.option("-s, --single", "write logs to a single file")
	.option("-p, --port <port>", "set the listening port <port>", 9005)
	.parse(process.argv);

if (!(program.port >= 0 && program.port < 65536 && program.port % 1 === 0)) {
	console.error("[ERROR] Port argument must be an integer >= 0 and < 65536.");
	program.port = 9005;
}

//控制台输出
var logs = program.multi || program.single;
console.log(`Thank you for using Michat WebSocket server. Use '-h' for help. The server will run on port ${program.port}. When users connect or send message, logs will ${program.debug ? "" : "not "}show in the console ${((program.debug && logs) || (!program.debug && !logs)) ? "and" : "but" } ${logs ? "write to files in /logs." : "won't write to files." }`);

//初始化
const ws = require("nodejs-websocket");
var options = {
	secure: true,
	cert: fs.readFileSync("/etc/letsencrypt/live/your.domain.name/fullchain.pem"),
	key: fs.readFileSync("/etc/letsencrypt/live/your.domain.name/privkey.pem")
}
var server = ws.createServer(options, function(conn){
	console.log("[New User]", conn.protocols[0]);
	//conn.channel = conn.protocols[0];
	//protocol用来区分channel 其值与前面的 info.req.headers["sec-websocket-protocol"] 相同
	if (!count[conn.protocols[0]]) count[conn.protocols[0]] = 1;
	else count[conn.protocols[0]]++;
	server.broadcast("system", count[conn.protocols[0]], "+1", conn.protocols[0]);
	//发送消息
	conn.on("text", function(data) {
		if (conn.banned) return;
		conn.banned = true;
		setTimeout(function(){conn.banned = false}, 3000); //避免刷屏
		var msg = JSON.parse(data);
		server.broadcast("user", msg.user, msg.content, conn.protocols[0]);
		var msglist = msg.user + " " + msg.content;
		if (program.debug) console.log("[New Message]", conn.protocols[0], msglist);
		if (program.multi) fs.appendFile("logs/" + conn.protocols[0] + ".log", timeStamp() + msglist + "\n", function(err) {
			if (err && program.debug) console.error("[ERROR] Failed to write the log.");
		});
		if (program.single) fs.appendFile("logs/msg.logs", timeStamp() + conn.protocols[0] + " " + msglist + "\n", function(err) {
			if (err && program.debug) console.error("[ERROR] Failed to write the log.");
		});
	});
	//退出聊天
	conn.on("close", function(close) {
		count[conn.protocols[0]]--;
		server.broadcast("system", count[conn.protocols[0]], "-1", conn.protocols[0]);
	});
	//错误处理
	conn.on("error", function(error) {
		if (program.debug) console.error("[ERROR] " + error);
	});
}).listen(program.port);

function timeStamp() {
	var date = new Date().toISOString();
	return date.slice(0, 10) + " " + date.slice(11, 19) + " ";
}
//count记录某个频道的人数
var count = [];
//广播
server.broadcast = function(type, user, content, towhom) {
	var data = {"type": type, "user": user, "content": content};
	var str = JSON.stringify(data);
	server.connections.forEach(function(client) {
		//console.log(client.protocol);
		if (client.protocols[0] == towhom) client.send(str);
	});
};
server.on("error", function(error) {
	if (program.debug) console.error("[ERROR] " + error);
});

process.on("uncaughtException", function(error) {
	if (program.debug) console.error("[FATAL ERROR] " + error);
	//process.exit(); //不强制退出可能产生不可控问题
});
