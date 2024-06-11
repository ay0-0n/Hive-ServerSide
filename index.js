const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b6ckjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send('Access Denied');
    }
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send('Access Denied');
    }
    
    jwt.verify(token, process.env.JWT_Secret, (err, decoded) => {
        if (err) {
            return res.status(401).send('Access Denied');
        }

    req.decoded = decoded;
    next();
    });
};


async function run() {
  try {
    await client.connect();
    const UserCollection = client.db("hive").collection("users");
    const AnnouncementsCollection = client.db("hive").collection("announcements");

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_Secret, { expiresIn: '1h' });
        res.send({ token });
    });

    app.get('/users', verifyToken, async (req, res) => {
        const users = await UserCollection.find().toArray();
        res.json(users);
    });

    app.get('/user/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        if(email !== req.decoded.email) {
            return res.status(401).send('Access Denied');
        }

        const user = await UserCollection.findOne({ email: email });
        if(user) {
            admin = user.role === 'admin';
        }
        res.json({admin});
    }
    );

    app.post('/users', async (req, res) => {
      const { name, email, photo, membership, role, registerDate } = req.body;
      const user = await UserCollection.findOne({ email });
      if (user) {
        res.json({ message: "User already exists" });
      } else {
        const newUser = await UserCollection.insertOne({ name, email, photo, membership, role, registerDate });
        res.json({ message: "User created successfully", newUser });
      }
    });

    app.get('/announcements', async (req, res) => {
        const announcements = await AnnouncementsCollection.find().toArray();
        res.json(announcements);
    });

    console.log("Successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Bees!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
