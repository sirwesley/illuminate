# illuminate
Philips Illuminate control scripts in Javascript

Some basic protocol hacking to create script to control my Philips Illuminate Christmas lights. Very rough at the moment.

*Update: integrated with sACN e1.31 to enable scripted output via lighting software. 
Currently using VIXEN (http://www.vixenlights.com) to control them.*

## Setup
Install: `npm install`

Setup IPs for Lighting Modules in the index.js file.

Run: `node index.js`

##Testing
Browse to: `http://127.0.0.1:3000?test=1`


