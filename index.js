const express = require('express');
const FTPClient = require('ftp');
const app = express()
const _ = require('underscore');

if (process.env.NODE_ENV) {
    require('dotenv').config({path: '/home/admin/wizard-assistant'})
} else {
    require('dotenv').config()
}

const client = new FTPClient();
const excluded_dirs = ['.', '..']
let connected;

async function connectFTP(){
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
(async () => {
    connected = await connectFTP();
})();
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.get('/devices', (req, res) => {
    if (!connected){
        console.error('No ftp connection')
        res.status(404).send('No ftp connection')
        return;
    }
    client.listSafe('/', false, (err, listing) => {
        console.log(listing)
        listing = _.filter(listing, (element)=>{
            return element.type == 'd' && !excluded_dirs.includes(element.name); // 2 because type 2 means it's a directory
        })
        listing = _.map(listing, (element) => {
            return element.name;
        })
        console.log(listing)
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
