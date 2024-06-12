const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 5000;

// MiddleWare
app.use(cors())
app.use(bodyParser.json());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.he8foru.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const postCollection = client.db('topicTalk').collection('posts')
    const usersCollection = client.db('topicTalk').collection('users');
    const announcementCollection = client.db('topicTalk').collection('announcements');

    // JWT token
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1d'
      });
      res.send({ token });
    });

    // MiddleWares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized Access' });
        }
        req.decoded = decoded;
        next();
      });
    };
    // Verify Admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // User related
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already Exists', insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden Access' });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const search = req.query.search;
      const query = {
        name: { $regex: search, $options: 'i' }
      }
      const result = await usersCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result);
    });

    app.get('/usersCount', async (req, res) => {
      const search = req.query.search;
      const query = {
        name: { $regex: search, $options: 'i' }
      }
      const count = await usersCollection.estimatedDocumentCount(query);
      res.send({ count })
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })


    app.get('/user/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result)
    })
    app.get('/mainUser',verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    // Post related API
    app.post('/posts', async (req, res) => {
      const post = req.body;
      const result = await postCollection.insertOne(post);
      res.send(result);
    });

          
    app.get('/myPosts',verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { authorEmail: email };
      const result = await postCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/myPosts/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await postCollection.deleteOne(query);
      res.send(result);
    })


    app.get('/posts', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const search = req.query.search;
      const query = {
        postTag: { $regex: search, $options: 'i' }
      }
      const result = await postCollection.find(query).skip(page * size).limit(size).toArray();
      res.send(result);
    })

    app.get('/post/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    app.get('/postsCount', async (req, res) => {
      const search = req.query.search;
      const query = {
        postTag: { $regex: search, $options: 'i' }
      }
      const count = await postCollection.estimatedDocumentCount(query);
      res.send({ count })
    })

    // AnnounceMents related 
    app.post('/announcements', async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    });
    app.get('/announcements', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result)
    })


    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
  res.send('TopicTalk Server is running')
})
app.listen(port, () => {
  console.log(`TopicTalk Server is running on port ${port}`);
})