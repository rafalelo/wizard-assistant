const express = require('express');
const {resolve} = require('path');
const FTPClient = require('ftp');
const app = express()
const _ = require('underscore');

if (process.env.NODE_ENV) {
    require('dotenv').config({path: resolve('/home/admin/wizard-assistant/.env')})
    console.log('Production .env file loaded.')
} else {
    require('dotenv').config()
    console.log('Development .env file loaded.')
}

const client = new FTPClient();
const excluded_dirs = ['.', '..']
let connected;

client.on('ready', () => {
    connected = true;
})

client.on('end', () => {
    connected = false;
    connectFTP();
})

client.on('error', (error) => {
    console.error(error);
})


function connectFTP(){
    try {
        client.connect({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        })
        
        return true
    } catch(err) {
        // Should terminate window and return to welcome window
        // with appropriate error message
        console.log("FTP ERROR: ", err)
        return false
    }
}

function reconnectFTP(){
    
    client.end();
    return
}

connectFTP();

setInterval(reconnectFTP, 180000) // Reconnect interval, every 180000ms=3min

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.get('/dev/:device/:sensor', (req, res)=>{
    let device = req.params.device
    let sensor = req.params.sensor
    let processor
    let baud

 

    client.listSafe(`/${device}/${sensor}`, false, (err, listing) => {
        console.log(listing)
        listing = _.filter(listing, (element)=>{
            return element.type == '-'; // 2 because type 2 means it's a directory
        })
        listing = _.map(listing, (element) => {
            return element.name;
        })
        console.log(listing)
        res.send({"devices": listing})
    })
    
    
})
app.get('/devices', (req, res) => {
    if (!connected){
        console.error('No ftp connection')
        res.status(404).send('No ftp connection')
        reconnectFTP();
        return;
    }
    client.listSafe('/', false, (err, listing) => {
        listing = _.filter(listing, (element)=>{
            return element.type == 'd' && !excluded_dirs.includes(element.name); // d because type d means it's a directory. And we don't want parent and current directory symlinks
        })
        listing = _.map(listing, (element) => {
            return element.name;
        })
        res.send({"devices": listing})
    })
})

app.get('/:device', (req, res)=>{
    let device = req.params.device
    let processor
    let baud
    client.listSafe(`/${device}`,false, (err, listing) =>{
        let procfile = _.find(listing, (el) => { return el.name.includes('.processor')})// Look for .processor file
        let baudfile = _.find(listing, (el) => { return el.name.includes('.baudrate')}) // Look for .baudrate file

    
        if (procfile && baudfile){
            processor = procfile.name.split('.')[0]
            baud = baudfile.name.split('.')[0]
            let lst = _.filter(listing, (el) => { //Look for all directories meaning sensors
                return el.type == 'd' && !excluded_dirs.includes(el.name);
            })
            lst = _.map(lst, (el) => { // Select only names of them
                return el.name;
            })
            res.send({"baudrate": baud, "processor": processor, "sensors": lst})
        } else { // No .processor file means something went wrong and flash can't be performed
            res.send('')
        }
        
    })

    
})

app.get('/*', function(req, res) {
     
        res.status(404).send("Not found")

})

app.listen(3000, console.log('Server running...'))
