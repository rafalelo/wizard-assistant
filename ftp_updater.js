const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const FTPClient = require('ftp');
const _ = require('underscore')

const client = new FTPClient();
const excluded_dirs = ['.', '..', '.ftpquota']
const dpath = path.join(__dirname, "devices")
const faq = path.join(__dirname, "faq.json")

const Logger = require('./logger');

let devices = []

let device_sensor = [] 

function update_hexfiles() {

    let conf = device_sensor.pop()

    client.listSafe(`/no_hex_file/${conf.device}/${conf.sensor}`, false, (err, listing) => {
        let firmwares = _.chain(listing)
                        .filter( (el) => { return el.type == '-'})
                        .map((el) => { return el.name })
                        .value()

        //console.log(`Firmwares for ${conf.device}/${conf.sensor}: ${firmwares}`)
        
        let current_items = fs.readdirSync(path.join(dpath, conf.device, conf.sensor), err => { console.error(err)})
        try {
            for (item of current_items) {
                if (fs.existsSync(path.join(dpath, conf.device, conf.sensor, item))){//&&fs.statSync(path.join(dpath, device, item)).isDirectory())){
                    fs.rmdirSync(path.join(dpath, conf.device, conf.sensor, item), {recursive: true})
                }
            }   
        } catch (error) {
            Logger.warn("Removing directory in /no_hex_file failed.");
        }

        _.each(firmwares, (el, k, idx) => {
            try{
                if (!fs.existsSync(path.join(dpath, conf.device, conf.sensor, el))){
                    fs.writeFile(path.join(dpath, conf.device, conf.sensor, el),'', (err)=>{
                        if (err) {console.log(err)}
                    })
                }
            } catch (error){
                Logger.warn("Writing to file in /no_hex_file failed.");
            }
        })

        if (device_sensor.length >0 ) {
            update_hexfiles();
        } else {
            client.end();
            Logger.info("Client closed successfully. Looks like update went OK.");
        }

    })
    
    return true;
}

function update_sensors(){

    device = devices.pop()

    client.listSafe(`/no_hex_file/${device}`, false, (err, listing) => {

        let sensors = _.chain(listing)
            .filter((el) => { return el.type == 'd' && !excluded_dirs.includes(el.name) })
            .map((el) => { return el.name })
            .value()

        let confs = _.chain(listing)
            .filter((el)=> {return el.type == '-'})
            .map((el)=> { return el.name})
            .value()

        let current_items = fs.readdirSync(path.join(dpath, device), err => { console.error(err)})
        try {
            for (item of current_items) {
               if (fs.existsSync(path.join(dpath, device, item))){//&&fs.statSync(path.join(dpath, device, item)).isDirectory())){
                   fs.rmdirSync(path.join(dpath, device, item), {recursive: true})
               }
            }   
        } catch (error) {
            Logger.warn("Removing directory failed in update_sensors()");
        }

        //for (item of current_items) {
        //    fs.unlink(path.join(dpath, device, item), err => {
        //        if (err) console.error(err);
        //    })
        //}

        _.each(listing, (el, k, idx) => {
            try{
                if (!fs.existsSync(path.join(dpath, device, el.name))){
                    if (el.type == "d"){
                        fs.mkdirSync(path.join(dpath, device, el.name))
                        device_sensor.push({device: device, sensor: el.name})
                    } else {
                        fs.writeFile(path.join(dpath, device, el.name),'', (err)=>{ if (err) {console.log(err)} }); 
                    }
                }
            } catch (err) {
                Logger.warn("Writing to file or creating a directory failed in update_sensors()");
            }
        })
        
        if (devices.length>0){

            update_sensors();

        } else {
            
            update_hexfiles();
        }

    })

}

function update_devices(new_devices){

    Logger.info("The devices update procedure has started.");
    let current_devices = undefined;
    
    try {
        current_devices = fs.readdirSync(dpath)
    } catch (error) {
        Logger.error("Couldn't find /devices directory.");
    }

    _.each(new_devices, (el, k, idx) => {
        if (!current_devices.includes(el)){
            try {
                if (!fs.existsSync(path.join(dpath, el))) {
                    fs.mkdirSync(path.join(dpath, el))
                }
            } catch (err) {
                //console.log(err) // TODO: Change to logging to file
                Logger.warn("Error during creating a directory for some device.");
            }
        }
    })
    _.each(current_devices, (el, k, idx) => {
        if (!new_devices.includes(el)){
            fs.rmdir(path.join(dpath, el), {recursive: true }, (err) => {
                if (err){
                    //console.log("Directory remove error: ", err) // TODO: Change to logging to file
                    Logger.warn("Directory remove error.");
                }
            })
        }
    })

    // So far we have to be sure that folders in device/ are up to date

    devices = new_devices;
    //new_devices.forEach( (device) => {
    //    update_sensors(device)
    //})
    update_sensors();
}

function update_faq(){
     client.get('/faq/faq.json', (err, stream) => {
        if(err) {
            Logger.error("Error happend during retrieving the faq.json from the server.");
            update_faq();
            return;
        }
        stream.once("close", () => {
            update_hex_file();
        })
        stream.pipe(fs.createWriteStream('faq.json'))
     });

}

var update_hex_file = function(){
     client.get('/hex_file/printers.json', (err, stream) => {
        if(err){
            Logger.error("Error happend during retrieving the /hex_file/printers.json from the server.");
            update_hex_file();
            return;
        }
        stream.once("close", () => {
            update_hallon_faq();
        })
        stream.pipe(fs.createWriteStream('hex_file.json'))
     });
}

var update_hallon_faq = function(){
     client.get('/faq_configurator/faq.json', (err, stream) => {
         if (err) {
            Logger.error("Error happend during retrieving the /faq_configurator/faq.json from the server.");
            update_hallon_faq();
            return;
         }

         stream.pipe(fs.createWriteStream('hallon_faq.json'))
     });
}


client.on('ready', () => {

    client.listSafe('/no_hex_file', false, (err, listing) => {
        if (err) {
            Logger.error("Error happend during retrieving the /no_hex_file from the server.");
        }

        devices = _.filter(listing, (element) => {
            return element.type == 'd' && !excluded_dirs.includes(element.name); // d because type d means it's a directory. And we don't want parent and current directory symlinks
        })
        devices = _.map(devices, (el) => {
            return el.name
        })
        update_devices(devices);

        update_faq()//.then(update_hex_file).then(update_hallon_faq);
    })
  
})

client.on('error', (error) => {
    //console.error(error); // TODO: change console logging to logging to file
    Logger.error("Error during connecting to the FTP server.");
})

router.get('/', async (req, res) => {
    //new ftpdump({
    //    host: process.env.FTP_HOST,
    //    port: 21,
    //    user: process.env.FTP_USER,
    //    password: process.env.FTP_PASSWORD,
    //    root: "/"
    //}, dpath, (err) => {
    //    if (err) return console.log(err);
    //});


    //res.sendStatus(200)
    try {
        client.connect({
            host: process.env.FTP_HOST,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
            secure: false
        })
        
        res.sendStatus(200)
    } catch(err) {
        // Should terminate window and return to welcome window
        // with appropriate error message
        Logger.error("Error with connecting to the FTP server at early stage. Place: ftp_updater.js, router.get('/', ...) function.");
        res.sendStatus(500)
    }
})

module.exports = router