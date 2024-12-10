const Protocol = require('./src/protocol');
const net = require('net');
const debug = require('debug')('illuminate:main');
const parse = require('color-parse');
var express = require('express');
var e131 = require('e131');
var app = express();

const e131Port = 5568; // e131 Port - Default = 5568
const port = 3000; // Web server Port
const illuminatePort = 5577; // Illuminate Modules Port
const deviceIPs = ['192.168.50.43']; // <--- insert your IPs here - 192.168.1.XXX'; //'192.168.1.27'
const universes = [0x0002]; // sACN Listening Universes

let lastSlotData = 0;

// sACN Server listening for VIXEN data.
var server = new e131.Server(universes, e131Port);
server.on('listening', function () {
  console.log('server listening on port %d, universes %j', this.port, this.universes);
});
server.on('packet', function (packet) {
  var sourceName = packet.getSourceName();
  var sequenceNumber = packet.getSequenceNumber();
  var universe = packet.getUniverse();
  var slotsData = packet.getSlotsData();

  let newSlotData = slotsData.toString('hex');

  // Check for New Data
  if (newSlotData !== lastSlotData) {
    console.log('source="%s", seq=%d, universe=%d, slots=%d', sourceName, sequenceNumber, universe, slotsData.length);
    console.log('slots data = %s', slotsData.toString('hex'));
    // Check if we are in range to use a pattern
    if (slotsData[0] === 255) {
      const programMode = slotsData[1] > 20 ? 0 : slotsData[1];
      const speed = slotsData[2] < 1 || slotsData[2] > 101 ? 50 : slotsData[2] - 1;
      console.log(programMode, speed);
      execute(deviceIPs, 'program', { program: programMode, speed: speed });
    } else { // Otherwise we use the first 4 slots to pick our color.
      const updateColorData = { r: slotsData[3], g: slotsData[4], b: slotsData[5], w: slotsData[6] };
      execute(deviceIPs, 'updateColor', updateColorData);
    }
    lastSlotData = newSlotData; // Update LastSlotData
  }
});

let text = '';

// RESTful endpoint for GET updates.  Primary used for Testing

app.get('/', function (request, response) {
  if (request.query.hasOwnProperty('test')) {
    const test = request.query.test;
    switch (test) {
      case '0': // Red Test
        execute(deviceIPs, 'updateColor', { r: 255, g: 0, b: 0, w: 0 });
        text = 'updateColor: red';
        break;
      case '1': // Green Test
        execute(deviceIPs, 'updateColor', { r: 0, g: 255, b: 0, w: 0 });
        text = 'updateColor: green';
        break;
      case '2': // Blue Test
        execute(deviceIPs, 'updateColor', { r: 0, g: 0, b: 255, w: 0 });
        text = 'updateColor: blue';
        break;
      case '3': // Custom Test
        execute(deviceIPs, 'custom', {
          colors: [
            { r: 255, g: 0, b: 0 },
            { r: 0, g: 255, b: 0 },
            { r: 0, g: 0, b: 255 }],
          speed: 100,
          mode: 'jump'
        });
        text = 'custom: Jumping Red, Green, Blue';
        break;
      case '4': // Timeout Test
        // Flips between Blue and White
        execute(deviceIPs, 'updateColor', { r: 0, g: 0, b: 255, w: 0 });
        setTimeout(() => {
          execute(deviceIPs, 'updateColor', { r: 0, g: 0, b: 0, w: 255 });
        }, 1000, 'colorTimeout');
        text = 'Timeout: blue/white toggle 1 sec';
        break;
      case '5': // Program Test
        execute(deviceIPs, 'program', { program: 1, speed: 50 });
        text = 'program: running program #1 at Speed 50%';
        break;
      case '6': // Pattern Test
        execute(deviceIPs, 'updatePattern', [
          { r: 255, g: 0, b: 0 },
          { r: 0, g: 255, b: 0 },
          { r: 0, g: 0, b: 255 }
        ]);
        text = 'pattern: Every other light Red, Green, Blue';
        break;
      default: // Status Response
        execute(deviceIPs, 'status', { });
        text = 'status: status of light module';
        break;
    }
    response.send('<h2>' + text + '</h2>');
  }
});

app.listen(port);
console.log(`Listening at http://localhost:${port}`);

/**
 * Sends Config Message to Light Control Module via IP
 * @param hosts - array of IP Addresses corresponding to the Light Modules Base
 * @param command - updateColor, custom, updatePattern, program
 * @param args - supporting values corresponding to the Commands
 */
function execute (hosts, command, args) {
  for (const host of hosts) {
    const client = new net.Socket();
    console.log(host, command, args);
    client.connect(illuminatePort, host, function () {
      const protocol = new Protocol(client);
      let paramsArr = [];
      let response = null;

      if (command in protocol) {
        switch (command) {
          case 'updateColor':
          case 'custom':
          case 'program':
          case 'updatePattern':
            paramsArr = [args];
            break;
          default:
            paramsArr = [];
            break;
        }
        debug('parameters', paramsArr);
        response = protocol[command].apply(protocol, paramsArr);
      }

      Promise.resolve(response).then(() => {
        client.destroy();
      });
    });

    client.on('error', (ex) => {
      console.log('handled error');
      console.log(ex);
      client.destroy();
    });
  }
}
