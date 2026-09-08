const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- CORS – allow your Vercel frontend ----------
// ✅ Add your actual Vercel URLs here (or use a dynamic check)
const allowedOrigins = [
    'https://we-theta-eight.vercel.app',
    'https://we-pvj1fe3xn-acemk.vercel.app',
    // add any custom domain you might use later
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true   // ✅ allow cookies
}));

app.use(express.json());

// ---------- Session – secure cross-origin cookies ----------
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,          // ✅ must be true on HTTPS
        httpOnly: true,
        sameSite: 'none',      // ✅ required for cross-site requests
        maxAge: 3600000        // 1 hour
    }
}));

// ---------- LOGIN ENDPOINT ----------
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing credentials' });
    }

    try {
        const response = await axios.get('https://welearn.iiserkol.ac.in/login/token.php', {
            params: {
                username: username,
                password: password,
                service: 'moodle_mobile_app'
            }
        });

        const token = response.data.token;

        if (token) {
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

// ---------- FETCH COURSES (with dynamic userid) ----------
app.get('/api/courses', async (req, res) => {
    const token = req.session.moodleToken;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Get userid dynamically
        const siteInfo = await axios.post('https://welearn.iiserkol.ac.in/webservice/rest/server.php', null, {
            params: {
                wstoken: token,
                wsfunction: 'core_webservice_get_site_info',
                moodlewsrestformat: 'json'
            }
        });
        const userid = siteInfo.data.userid;

        // Fetch courses
        const courses = await axios.post('https://welearn.iiserkol.ac.in/webservice/rest/server.php', null, {
            params: {
                wstoken: token,
                wsfunction: 'core_enrol_get_users_courses',
                moodlewsrestformat: 'json',
                userid: userid
            }
        });
        res.json(courses.data);
    } catch (error) {
        console.error('Error fetching courses:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// ---------- LOGOUT ----------
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`WeLearn proxy running on port ${PORT}`);
});
