const Protocol = require('./src/protocol');
const net = require('net');
const debug = require('debug')('illuminate:main');
const parse = require('color-parse');
var express = require('express');
var fs = require('fs');
var app = express();

const port = 3000;
const IP = '192.168.1.XXX,192.168.1.XXX'; // Comma delimited string of Lighting Module IP address - 192.168.1.XXX';

app.get('/', function (request, response) {
  console.log('GET /');
  console.log(request.query);

  if (request.query.hasOwnProperty('test')) {
    const test = request.query.test;
    switch (test) {
      case '0':
        execute(IP, 'updateColor', { r: 255, g: 0, b: 0, w: 0 });
        break;
      case '1':
        execute(IP, 'updateColor', { r: 0, g: 255, b: 0, w: 0 });
        break;
      case '2':
        execute(IP, 'updateColor', { r: 0, g: 0, b: 255, w: 0 });
        break;
      case '3':
        execute(IP, 'updateColor', { r: 0, g: 0, b: 0, w: 255 });
        break;
      case '4':
        // Flips between Blue and White
        execute(IP, 'updateColor', { r: 0, g: 0, b: 255, w: 0 });
        setTimeout(() => {
          execute(IP, 'updateColor', { r: 0, g: 0, b: 0, w: 255 });
        }, 1000, 'funky');

        break;
      default:
        execute(IP, 'program', { program: 1, speed: 50 });
        break;
    }
  }

  response.send(request.query);
});

app.listen(port);
console.log(`Listening at http://localhost:${port}`);

/**
 * Sends Config Message to Light Control Module via IP
 * @param ips - Comma Delimited List of Module IPs
 * @param type - Command Type ( updateColor, program, custom)
 * @param params - Params corresponding to defined Type.
 */
function execute (ips, type, params) {
  const hosts = ips.split(',');
  const command = type;
  const args = params;

  for (const host of hosts) {
    const client = new net.Socket();
    console.log(host, command, args);
    client.connect(5577, host, function () {
      const protocol = new Protocol(client);
      let paramsArr = [];
      let response = null;

      // console.log(colors)
      if (command in protocol) {
        switch (command) {
          case 'updateColor':
            if (args.length === 1) {
              paramsArr = [parse(args[0]).values.concat(0)]; // [ R, G, B, 0 ]
            } else {
              paramsArr = [Object.values(args)];
            }
            break;
          case 'updateColors':
            paramsArr = [Object.values(args)];
            break;
          case 'custom':
            paramsArr.push(args[0]);
            paramsArr.push(args[1]);
            paramsArr = paramsArr.concat(args.slice(2).map((color) => parse(color).values));
            break;
          case 'program':
            paramsArr = Object.values(args);
            break;
        }
        debug('parameters', paramsArr);
        response = protocol[command].apply(protocol, paramsArr);
      }

      Promise.resolve(response).then(() => {
        client.destroy();
      });
    });
  }
}
