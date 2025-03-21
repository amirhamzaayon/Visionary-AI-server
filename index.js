require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://visionary-ai-optional.web.app",
      "https://visionary-ai-optional.firebaseapp.com",
    ],
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
    const AnnouncementInfo = client
      .db("Visionary-AI")
      .collection("AnnouncementInfo");

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

    //get one service details page
    app.get("/postdetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await PostsInfo.findOne(query);
      res.send(result);
    });

    //----------------- user dashboard ------------------
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

    //previous update Upvote and downvote
    app.patch("/postdetails/:id/vote", async (req, res) => {
      try {
        const id = req.params.id;
        const { totalUpvote, totalDownvote } = req.body; // Changed to match client-side case

        console.log("Received data:", req.body); // Add this line for debugging

        const filter = {
          _id: new ObjectId(id),
        };

        const update = {
          $set: {},
        };

        if (totalUpvote !== undefined) {
          update.$set.totalUpvote = totalUpvote;
        }
        if (totalDownvote !== undefined) {
          update.$set.totalDownvote = totalDownvote;
        }

        const result = await PostsInfo.updateOne(filter, update);
        res.json(result);
      } catch (error) {
        console.error("Update error:", error); // Add error logging
        res.status(500).json({ error: error.message });
      }
    });

    //add new comment in post
    app.post("/postdetails/:id/add-comment", async (req, res) => {
      const id = req.params.id;
      const newComment = { commentID: new ObjectId(), ...req.body };
      const filter = { _id: new ObjectId(id) };
      const result = await PostsInfo.findOne(filter);

      const updatedComments = [...(result.comments || []), newComment];
      const updatedCommentsCount = updatedComments.length;
      const update = await PostsInfo.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            totalComments: updatedCommentsCount,
            comments: updatedComments,
          },
        }
      );
      res.send({ message: "Updated comments", update });
    });

    // report a comment of users
    app.post("/report", async (req, res) => {
      const reportInfo = req.body;
      const filter = {
        "comments.commentID": new ObjectId(reportInfo.commentID),
      };
      const result = await PostsInfo.findOne(filter);

      reportInfo.postTitle = result.postTitle;
      reportInfo.authorName = result.authorName;
      reportInfo.authorEmail = result.authorEmail;
      reportInfo.authorProfile = result.authorProfile;

      const update = await ReportsInfo.insertOne(reportInfo);
      res.send({ message: "Report added successfully", update });
    });

    //delete a post
    app.delete("/post/delete/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await PostsInfo.deleteOne(filter);
      res.send({ message: "Post Deleted successfully", result });
    });

    //----------------- admin dashboard ------------------
    //get all the users information
    app.get("/usersInfo", async (req, res) => {
      const result = await UsersInfo.find({}).toArray();
      res.send(result);
    });

    //get all the reports information
    app.get("/usersReports", async (req, res) => {
      const result = await ReportsInfo.find({}).toArray();
      res.send(result);
    });

    //delete a comment
    app.delete("/admin/delete-comment/:id", async (req, res) => {
      const id = req.params.id;

      // First find the post that contains this comment
      const post = await PostsInfo.findOne({
        comments: {
          $elemMatch: { commentID: new ObjectId(id) },
        },
      });

      if (!post) {
        return res
          .status(404)
          .send({ message: "Post not found containing this comment" });
      }

      // Remove the comment from the post's comments array
      const updateResult = await PostsInfo.updateOne(
        { _id: post._id },
        { $pull: { comments: { commentID: new ObjectId(id) } } }
      );

      // Delete the report
      const reportResult = await ReportsInfo.deleteOne({
        commentID: id,
      });

      // Update total comments count
      await PostsInfo.updateOne(
        { _id: post._id },
        { $inc: { totalComments: -1 } }
      );

      res.send({
        message: "Comment and report deleted successfully",
        updateResult,
        reportResult,
      });
    });

    //reject a report
    app.delete("/admin/reject-comment/:id", async (req, res) => {
      const id = req.params.id;

      // Delete only the report
      const result = await ReportsInfo.deleteOne({
        commentID: id,
      });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Report not found" });
      }

      res.send({
        message: "Report rejected successfully",
        result,
      });
    });

    //make a user admin
    app.put("/admin/make-admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: { userBadge: "Admin", userRole: "Admin" } };
      const result = await UsersInfo.updateOne(filter, update);
      res.send({ message: "User is now Admin", result });
    });

    // get the announcement
    app.get("/announcement", async (req, res) => {
      const result = await AnnouncementInfo.find({}).toArray();
      res.send(result);
    });

    // add a announcement
    app.put("/add-announcement", async (req, res) => {
      try {
        // Validate that request body contains announcement
        if (!req.body.announcement) {
          return res
            .status(400)
            .json({ error: "Announcement text is required" });
        }
        newAnnouncement = req.body.announcement;
        console.log(newAnnouncement);

        // Update only the announcement field
        const result = await AnnouncementInfo.updateOne(
          {}, // Empty filter to match the single document
          { $set: { announcement: newAnnouncement } },
          { upsert: true } // Create if doesn't exist
        );

        res.json(result);
      } catch (error) {
        console.error("Error updating announcement:", error);
        res.status(500).json({ error: "Failed to update announcement" });
      }
    });

    // admin and user identification
    app.get("/usersInfo/:email", async (req, res) => {
      const userEmail = req.params.email;
      const query = { userEmail: userEmail };
      const result = await UsersInfo.findOne(query);
      res.send(result);
    });

    // add new users information
    app.post("/usersInfo", async (req, res) => {
      const newUserInfo = req.body;
      console.log(newUserInfo);
      const result = await UsersInfo.insertOne(newUserInfo);
      res.send(result);
      console.log(result);
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
