const express = require('express');
const axios = require('axios');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'change-this-to-a-strong-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 }
}));

// Serve static files (your HTML, CSS, JS) from the same folder
app.use(express.static(__dirname));

// ---------- API PROXY ----------
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing credentials' });
    }

    try {
        // WeLearn is reachable because this server is on-campus
        const response = await axios.post(
            'https://welearn.iiserkol.ac.in/login/token.php',
            null,
            { params: { username, password, service: 'moodle_mobile_app' } }
        );

        if (response.data.token) {
            req.session.moodleToken = response.data.token;
            req.session.username = username;
            return res.json({ success: true, message: 'Authenticated' });
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('WeLearn auth error:', error.message);
        return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
});

app.get('/api/courses', async (req, res) => {
    const token = req.session.moodleToken;
    if (!token) return res.status(401).json({ error: 'Not logged in' });

    try {
        const site = await axios.post('https://welearn.iiserkol.ac.in/webservice/rest/server.php', null, {
            params: { wstoken: token, wsfunction: 'core_webservice_get_site_info', moodlewsrestformat: 'json' }
        });
        const userid = site.data.userid;

        const courses = await axios.post('https://welearn.iiserkol.ac.in/webservice/rest/server.php', null, {
            params: { wstoken: token, wsfunction: 'core_enrol_get_users_courses', moodlewsrestformat: 'json', userid }
        });
        res.json(courses.data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Start server – listen on all interfaces so others can connect
app.listen(PORT, '0.0.0.0', () => {
    console.log(`WeLearn portal running on http://<your-server-ip>:${PORT}`);
});
