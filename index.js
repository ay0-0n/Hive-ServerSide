const express = require('express');
const cors = require('cors');

require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;


//middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}
));

app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.b6ckjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
});

const cokkieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"? true: false,
    sameSite: process.env.NODE_ENV === "production"? "none":"strict"
}
async function run() {
    try {
  
    const UserCollection = client.db("hive").collection("users");

    

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello Bees!')
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});