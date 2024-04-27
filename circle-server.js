require('dotenv').config()
const express = require('express');
const path = require('path');
const cors = require('cors')
const app = express();
const PORT = 3000;
const sendNotification = require('./functions/validateSignatureAndNotify')

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'build')));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const API = require('./functions/API')
for (const endpoint in API) {
    if (Object.hasOwnProperty.call(API, endpoint)) {
        app.get('/api/' + endpoint, async (req, res) => {
            let profile;
            const jwt = require('jsonwebtoken')
            const decoded = jwt.decode(req.query.credential, process.env.GOOGLE_SECRET);
            if(decoded){
                profile = {
                id: decoded.email,
                name: decoded.name,
                picture: decoded.picture
            }
            } else {
                return res.status(401).json({message: 'Unauthorised Access: Invalid or Expired Token. Please Login Again!', status: 401});
            }
            const data = await API[endpoint](req, profile)
            if (data?.status === null || !data) {
                console.log(data?.error)
                res.status(500).json({message: data?.error?.message, status: 500})
            }
            else res.json(data);
        });
    }
}
app.post('/webhooks', async (req, res) => {
    try {
        sendNotification(req)
    } catch(e) {
        console.log(e)
    } finally {
        res.status(200).json("Successful")
    }
})