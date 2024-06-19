const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const e = require('express');
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const PostReportsCollection = client.db("hive").collection("postReports")
    const CommentsReportsCollection = client.db("hive").collection("commentsReports")
    const PaymentCollection = client.db("hive").collection("payments")
    const SearchCollection = client.db("hive").collection("searches");
    const VotesCollection = client.db("hive").collection("votes");


    //Votes
    app.post('/votes', async (req, res) => {
      const { user, postId, voteType, date } = req.body;
      const newVote = await VotesCollection.insertOne({ user, postId, voteType, date });
      res.status(201).send('Vote created successfully');
    }
    );

    app.delete('/votes/:id', async (req, res) => {
      const id = req.params.id;
      const result = await VotesCollection.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 1) {
          res.status(200).send('Vote deleted successfully');
      } else {
          res.status(400).send('Failed to delete vote');
      }
    }
    );

    app.patch('/votes/:id', async (req, res) => {
      const id = req.params.id;
      const { voteType, date } = req.body;
      const result = await VotesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { voteType: voteType, date: date } }
      );
      if (result.modifiedCount === 1) {
        res.status(200).send('Vote updated successfully');
      }
      else {
        res.status(400).send('Failed to update vote');
      }
    }
    );

    app.get('/votes', async (req, res) => {
      const votes = await VotesCollection.find().toArray();
      res.json(votes);
    });


    app.get('/votes/:email', async (req, res) => {
      const email = req.params.email;
      const votes = await VotesCollection.find({ user:email }).toArray();
      res.json(votes);
    }
    );

    //Homepage Routes
    app.post('/posts/search', async (req, res) => {
      const { user, searchTag, date,  } = req.body;
      const newSearch = await SearchCollection.insertOne({ user, searchTag, date });
      res.status(201).send('Search created successfully');
    });
  
    app.get('/searches/popular', async (req, res) => {
      const searches = await SearchCollection.aggregate([
          { $group: { _id: "$searchTag", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 3 }
      ]).toArray();
      res.json(searches.map(search => search._id));
    });

    app.get('/posts/visible', async (req, res) => {
      const posts = await PostCollection.find({ visibility: true }).sort({ dateAdded: -1 }).toArray();
      res.json(posts);
    }
    );

    app.get('/posts/tag/:tag', async (req, res) => {
      const { tag } = req.params;
      const posts = await PostCollection.find({
        tag: { $regex: tag, $options: 'i' },
        visibility: true
      })
      .sort({ dateAdded: -1 })
      .toArray();
      res.json(posts);
    });

    app.get('/posts/:tag', async (req, res) => {
      const {tag}  = req.params;
      const posts = await PostCollection.find({ tag: tag }).sort({ dateAdded: -1 }).toArray();
      res.json(posts);
    }
    );

    app.get('/posts/sort/:type', async (req, res) => {
      const { type } = req.params;
    
      try {
        let posts = await PostCollection.find({ visibility: true }).sort({ dateAdded: -1 }).toArray();
    
        if (type === 'popularity') {
          const votes = await VotesCollection.find().toArray();
    
          posts = posts.map(post => {
            const postVotes = votes.filter(vote => vote.postId.toString() === post._id.toString());
            const upVotes = postVotes.filter(vote => vote.voteType === 'up').length;
            const downVotes = postVotes.filter(vote => vote.voteType === 'down').length;
            post.popularity = upVotes - downVotes;
            return post;
          });
          
          posts.sort((a, b) => b.popularity - a.popularity);
        } else if (type === 'comments') {

          const comments = await CommentsCollection.find().toArray();
    
          posts = posts.map(post => {
            post.commentCount = comments.filter(comment => comment.postID.toString() === post._id.toString()).length;
            return post;
          });
    
          posts.sort((a, b) => b.commentCount - a.commentCount);
    
        } else {
          return res.status(400).json({ error: 'Invalid sort type' });
        }
        res.json(posts);
    
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
  
    //Stripe
    app.post('/create-payment-intent',verifyToken, async (req, res) => {
      const {price} = req.body;
      const amount = price * 100; 

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments',verifyToken, async (req, res) => {
      const {user, amount, transaction_id, date} = req.body;
      const newPayment = await PaymentCollection.insertOne({user, amount, transaction_id, date });
      res.status(201).send('Payment created successfully');
    }
    );

    app.patch('/user/membership/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await UserCollection.updateOne(
        { email: email },
        { $set: { membership: true } }
      );
      if (result.modifiedCount === 1) {
        res.status(200).send('Membership updated successfully');
      } else {
        res.status(400).send('Failed to update membership');
      }
    });

    app.get('/post-reports', verifyToken, (req, res)=>{
      const postReports = PostReportsCollection.find().toArray()
      res.json(postReports)
    })


    app.get('/comments-reports', verifyToken, (req, res)=>{
      const commentsReports = CommentsReportsCollection.find().toArray()
      res.json(commentsReports)
    }
    )

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
        const { title, description, owner, tag, visibility,dateAdded } = req.body;
        const newPost = await PostCollection.insertOne({ title, description, owner, tag, visibility,dateAdded });
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

    app.get('/posts/mypost/:email', async (req, res) => {
      const email = req.params.email;
      console.log("hey",email); 
      const posts = await PostCollection.find({ owner: email }).sort({ dateAdded: -1 }).toArray();
      res.json(posts);
    }
    );

    //check later
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

    app.patch('/users/admin/:email', verifyToken, async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        const result = await UserCollection.updateOne(
          { email: email },
          { $set: { role: role } }
        );
        if (result.modifiedCount === 1) {
          res.status(200).send('Role updated successfully');
        } else {
          res.status(400).send('Failed to update role');
        }
      } 
    );
      

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

    app.get('/users', async (req, res) => {
        const users = await UserCollection.find().toArray();
        res.json(users);
    });

    app.get('/users/search', async (req, res) => {
        const username = req.query.username;
        const users = await UserCollection.find({ name: { $regex: username, $options: 'i' } }).toArray();
        res.json(users);
    });

    app.delete('/users/:email',verifyToken, async (req, res) => {
        const email = req.params.email;
        const result = await UserCollection.deleteOne({ email: email });
        if (result.deletedCount === 1) {
            res.status(200).send('User deleted successfully');
        } else {
            res.status(400).send('Failed to delete user');
        }
    } );


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
