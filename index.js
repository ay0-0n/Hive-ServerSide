const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5174','http://localhost:5173'],
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
    const CommentsCollection = client.db("hive").collection("comments");
    const TagCollection = client.db("hive").collection("tags");
    const PostCollection = client.db("hive").collection("posts");

    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.JWT_Secret, { expiresIn: '1h' });
        res.send({ token });
    });

    app.get('/recent-posts/:email', async (req, res) => {
        const email = req.params.email;
        const posts = await PostCollection.find({ owner: email }).sort({ dateAdded: -1 }).limit(3).toArray();
        res.json(posts);
      });

    app.get('/tags', async (req, res) => {
        const tags = await TagCollection.find().toArray();
        res.json(tags);
    }
    );

    app.post('/posts', verifyToken, async (req, res) => {
        const { title, description, owner, tag, upVote, downVote, visibility,dateAdded } = req.body;
        const newPost = await PostCollection.insertOne({ title, description, owner, tag, upVote, downVote, visibility,dateAdded });
        res.status(201).send('Post created successfully');
    });



    app.patch('/post/visibility/:id', async (req, res) => {
        const id = req.params.id;
        const visibility = req.body.visibility;
        const result = await PostCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { visibility: !visibility } }
        );
        if (result.modifiedCount === 1) {
          res.status(200).send('Visibility updated successfully');
        } else {
          res.status(400).send('Failed to update visibility');
        }
    }
    );

    app.get('/posts/:email', async (req, res) => {
        const email = req.params.email;
        const posts = await PostCollection.find({ owner: email }).toArray();
        res.json(posts);
    });

    app.delete('/post/:id', async (req, res) => {
        const id = req.params.id;
        const result = await PostCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
            res.status(200).send('Post deleted successfully');
        } else {
            res.status(400).send('Failed to delete post');
        }
    });

    app.get('comments/:postId', async (req, res) => {
        const postId = req.params.postId;
        const comments = await CommentsCollection.find({ postId: postId }).toArray();
        res.json(comments);
    });
      

    app.patch('/users/:email/aboutMe', verifyToken, async (req, res) => {
        const email = req.params.email;
        const { aboutMe } = req.body;
        if (email !== req.decoded.email) {
          return res.status(401).send('Access Denied');
        }
        const result = await UserCollection.updateOne(
          { email: email },
          { $set: { aboutMe: aboutMe } }
        );
        if (result.modifiedCount === 1) {
          res.status(200).send('About Me updated successfully');
        } else {
          res.status(400).send('Failed to update About Me');
        }
      });
      

    app.post('/admin/tag', verifyToken, async (req, res) => {
        const { name, email, dateAdded } = req.body;
        const tag = await TagCollection.findOne({ name: name });
        if (tag) {
            console.log('Tag already exists');
            res.status(400).send('Tag already exists');
        } else {
            const newTag = await TagCollection.insertOne({ name, email, dateAdded });
            res.status(201).send('Tag created successfully');
        }
    });

    app.get('/posts', async (req, res) => {
        const posts = await PostCollection.find().toArray();
        res.json(posts);
    });

    app.get('/comments', async (req, res) => {
        const comments = await CommentsCollection.find().toArray();
        res.json(comments);
    });

    app.get('/users', verifyToken, async (req, res) => {
        const users = await UserCollection.find().toArray();
        res.json(users);
    });

    app.get('/user/:email', async (req, res) => {
        const email = req.params.email;
        const user = await UserCollection.findOne({ email: email });
        res.json(user);
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

    app.post('/announcement', verifyToken, async (req, res) => {
      console.log("asasasass");
      const { title, authorName,authorEmail, authorPhoto ,description,date } = req.body;
      const newAnnouncement = await AnnouncementsCollection.insertOne({ title, authorName,authorEmail, authorPhoto, description,date });
      res.status(201).send('Announcement created successfully');
  });

    app.get('/announcements', async (req, res) => {
        const announcements = await AnnouncementsCollection.find().toArray();
        res.json(announcements);
    });

    app.get('/announcements/:email', async (req, res) => {
        const email = req.params.email;
        const announcements = await AnnouncementsCollection.find({ authorEmail: email }).toArray();
        res.json(announcements);
    }
    );

    app.delete('/announcement/:id', async (req, res) => {
        const id = req.params.id;
        const result = await AnnouncementsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
            res.status(200).send('Announcement deleted successfully');
        } else {
            res.status(400).send('Failed to delete announcement');
        }
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
