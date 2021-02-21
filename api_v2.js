const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const error_message = { "error": "Requested resource was not found on the server."}

router.get('/hallon/faq', (req, res) => {
    if (!fs.existsSync(path.join(__dirname, 'v2/hallon/faq.json'))){
        res.send(error_message);
        return;
    }
    const faq = JSON.parse(fs.readFileSync(path.join(__dirname, 'v2/hallon/faq.json')))
    res.send(faq);
})

module.exports = router