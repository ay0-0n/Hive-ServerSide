const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;


//middleware
app.use(cors({
    origin: ['http://localhost:5173','https://node-93afa.web.app','https://node-93afa.firebaseapp.com'],
    credentials: true
}
));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.json());