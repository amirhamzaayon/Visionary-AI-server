const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.bcwzf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const PostsInfo = client.db("Visionary-AI").collection("PostsInfo");
    const UsersInfo = client.db("Visionary-AI").collection("UsersInfo");
    const ReportsInfo = client.db("Visionary-AI").collection("ReportsInfo");

    // fetch api for home page post info
    // app.get("/posts", async (req, res) => {
    //   const cursor = PostsInfo.find({});
    //   const posts = await cursor.toArray();
    //   res.send(posts);
    // });

    // fetch api for search & filter results for home page post info
    app.get("/search", async (req, res) => {
      const { postTitle, tag } = req.query;
      const filter = {};
      if (postTitle) {
        filter.postTitle = { $regex: postTitle, $options: "i" };
      }
      if (tag) {
        filter.tag = tag;
      }
      const posts = await PostsInfo.find(filter).toArray();
      res.send(posts);
    });

    // fetch all category/tags
    app.get("/categories", async (req, res) => {
      const categories = await PostsInfo.distinct("tag");
      res.send(["All", ...categories]);
    });

    // fetch api for feature forums
    app.get("/top-posts", async (req, res) => {
      try {
        const topPosts = await PostsInfo.aggregate([
          {
            $sort: { totalUpvote: -1 },
          },
          {
            $limit: 5,
          },
          {
            $project: {
              postID: 1,
              authorName: 1,
              postTitle: 1,
              totalUpvote: 1,
              totalComments: 1,
              tag: 1,
            },
          },
        ]).toArray();

        res.send(topPosts);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "Server Error: " + error.message,
        });
      }
    });

    //get one service details
    app.get("/postdetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await PostsInfo.findOne(query);
      res.send(result);
    });

    //get only my posts
    app.get("/myposts", async (req, res) => {
      const email = req.query.email;
      const query = { authorEmail: email };
      const result = await PostsInfo.find(query).toArray();
      res.send(result);
    });

    //post a new post
    app.post("/newpost", async (req, res) => {
      const newPost = req.body;
      const result = await PostsInfo.insertOne(newPost);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("complete initial server setup");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
