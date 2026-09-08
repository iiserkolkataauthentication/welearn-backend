const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: true, // allow your frontend domain
    credentials: true
}));

// Session management (stores token server-side)
app.use(session({
    secret: 'replace-this-with-a-strong-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true if you use HTTPS (Render provides HTTPS)
        httpOnly: true,
        maxAge: 3600000 // 1 hour
    }
}));

// ---------- LOGIN ENDPOINT ----------
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing credentials' });
    }

    try {
        // Call WeLearn's official token endpoint
        const response = await axios.get('https://welearn.iiserkol.ac.in/login/token.php', {
            params: {
                username: username,
                password: password,
                service: 'moodle_mobile_app'
            }
        });

        const token = response.data.token;

        if (token) {
            // Store token in the session (never send it to the frontend)
            req.session.moodleToken = token;
            req.session.username = username;

            return res.json({
                success: true,
                message: 'Authentication successful'
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
    } catch (error) {
        console.error('WeLearn auth error:', error.response?.data || error.message);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed. Please check your credentials.'
        });
    }
});

// ---------- (OPTIONAL) PROXY FOR FETCHING COURSES ----------
// You can expand this later to fetch courses, assignments, etc.
app.get('/api/courses', async (req, res) => {
    const token = req.session.moodleToken;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const response = await axios.post('https://welearn.iiserkol.ac.in/webservice/rest/server.php', null, {
            params: {
                wstoken: token,
                wsfunction: 'core_enrol_get_users_courses',
                moodlewsrestformat: 'json',
                userid: 2 // You need to get the actual userid from a separate call
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`WeLearn proxy running on port ${PORT}`);
});