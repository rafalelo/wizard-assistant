const express = require('express');
const {resolve} = require('path');
const FTPClient = require('ftp');
const app = express()
const path = require('path')
const fs = require('fs')
const _ = require('underscore');

const adspath = path.join(__dirname, "current_ads.json");
const dpath = path.join(__dirname, "devices")
const hallonfaqpath = path.join(__dirname, "hallon/hallon_faq.json")
const faqpath = path.join(__dirname, "wizard/faq.json")
const hex_file_path = path.join(__dirname, "wizard/hex_file.json")

const Logger = require('./logger');

if (process.env.NODE_ENV) {
    require('dotenv').config({path: resolve('/home/admin/wizard-assistant/.env')})
    console.log('Production .env file loaded.')
} else {
    require('dotenv').config()
    console.log('Development .env file loaded.')
}

app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.use('/update', require('./ftp_updater'))

app.get('/favicon.ico', (req, res) => {
    res.sendStatus(200)
})

//hallon
app.get('/ads', (req, res) => {
    const ads = fs.readFileSync(adspath);
    res.send(JSON.parse(ads));
})

app.use('/v2', require('./hallon/api_v2'));

app.get('/hallon/faq', (req, res) => {

    let faq = fs.readFileSync(hallonfaqpath);
    res.send(JSON.parse(faq));

})

//wizard
app.get('/dev/:device/:sensor', (req, res)=>{

    if (!req.params.device||!req.params.sensor){
        Logger.warn("Requested /dev endpoint.");
        res.sendStatus(501);
        return;
    }
    
    let device = req.params.device
    let sensor = req.params.sensor

    let firmwares = fs.readdirSync(path.join(dpath, device, sensor), err => {console.error(err)})

    res.send({"devices": firmwares})

})

app.get('/devices', (req, res) => {
    
    let devices = fs.readdirSync(dpath); // TODO: Ensure all returned items are directories

    res.send({"devices": devices})
    
})

app.get('/faq', (req, res) => {

    let faq = fs.readFileSync(faqpath);
    res.send(JSON.parse(faq));

})

app.get('/hex_file', (req, res) => {

    let hex = fs.readFileSync(hex_file_path);
    res.send(JSON.parse(hex));

})

app.get('/:device', (req, res)=>{
    
    let device = req.params.device
    let processor
    let baud
    let listing

    try {
        listing = fs.readdirSync(path.join(dpath, device));
    } catch (error) {
        Logger.error({message: `Someone tried access non-existing endpoint: ${device}`});
        res.sendStatus(501);
        return;
    }

    let procfile = _.find(listing, (el) => { return el.includes('.processor')})// Look for .processor file
    let baudfile = _.find(listing, (el) => { return el.includes('.baudrate')}) // Look for .baudrate file

    let sensors = _.filter(listing, (el)=> { return fs.lstatSync(path.join(dpath, device, el)).isDirectory()})
    
    if (procfile && baudfile){
        processor = procfile.split('.')[0]
        baud = baudfile.split('.')[0]
        
        res.send({"baudrate": baud, "processor": processor, "sensors": sensors})
    } else { // No .processor file means something went wrong and flash can't be performed
        res.send('') // TODO: should be replaced with status 404 or 500
    }
        
})

//
app.get('/*', function(req, res) {
     
    res.status(404).send("Not found")

})

app.listen(3000, console.log('Server running...'))
