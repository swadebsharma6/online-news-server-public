const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fikwith.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const trendingCollection = client.db("news12SMDB").collection("trandings");
    const demoNewsCollection = client.db("news12SMDB").collection("demo-news");
    const articleCollection = client.db("news12SMDB").collection("articles");
    const viewsCollection = client.db("news12SMDB").collection("views");
    const userCollection = client.db("news12SMDB").collection("users");
    const publisherCollection = client.db("news12SMDB").collection("publishers");
    const plansCollection = client.db("news12SMDB").collection("plans");
    const paymentCollection = client.db("news12SMDB").collection("payment");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = async (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden Access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // publisher related Api
    // post publisher
    app.post("/publisher", async (req, res) => {
      const publisher = req.body;
      const result = await publisherCollection.insertOne(publisher);
      res.send(result);
    });

    // user Related Api
    app.patch("/user/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      // console.log(req.headers)
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // admin user api
    app.get(
      "/users/admin/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "unauthorized Access" });
        }

        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      }
    );

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existUser = await userCollection.findOne(query);
      if (existUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // views Collection
    app.post("/views", async (req, res) => {
      const news = req.body;
      const result = await viewsCollection.insertOne(news);
      res.send(result);
    });

    app.get("/views", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = viewsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // post article
    app.post("/articles", async (req, res) => {
      const article = req.body;
      const result = await articleCollection.insertOne(article);
      res.send(result);
    });

    app.get("/articles", async (req, res) => {
      // const query = { role: 'approve' };
      const cursor = articleCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.findOne(query);
      res.send(result);
    });

    app.delete("/articles/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articleCollection.deleteOne(query);
      res.send(result);
    });

    // making approved article
    app.patch("/articles/approved/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "approve",
        },
      };
      const result = await articleCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    // making premium article
    app.patch("/articles/premium/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "premium",
        },
      };
      const result = await articleCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get all demoNews
    app.get("/demo", async (req, res) => {
      const cursor = demoNewsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //
    app.get("/plans", async (req, res) => {
      const cursor = plansCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/plans/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await plansCollection.findOne(query);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        "payment_method_types": ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });

    })


    app.post('/payments', async(req, res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log('payment info', payment);
      // const query = {_id : {
      //   $in: payment.cartIds.map(_id => new ObjectId(id))
      // }}
      // const deleteResult = await cartCollection.deleteMany(query);

      res.send(paymentResult)

    })

    // get all trending
    app.get("/trending", async (req, res) => {
      const cursor = trendingCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("News is running");
});

app.listen(port, () => {
  console.log(`News is running  on port: ${port}`);
});
