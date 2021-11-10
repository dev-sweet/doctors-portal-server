const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const admin = require("firebase-admin");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// midle ware
const serviceAccount = require("./doctor-portal-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

// mongo db uri and mongodb client
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DP_PASS}@cluster0.mas8d.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// verfy token
async function verfyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}
// create run app function
async function run() {
  try {
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("user");
    /*--------------appointments------------  */
    // get all appointments
    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();

      const filter = { email: email, date: date };
      const cursor = appointmentsCollection.find(filter);
      const result = await cursor.toArray();

      res.send(result);
    });

    // post apointments
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      console.log(result);
      res.json(result);
    });

    /*---------- users----------- */
    // post user to user collection
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.json(result);
      console.log(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);

      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    // put users
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.put("/users/admin", verfyToken, async (req, res) => {
      const email = req.body.email;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: email };
          const updateDoc = { $set: { role: "admin" } };

          const result = await usersCollection.updateOne(filter, updateDoc);

          res.json(result);
        } else {
          res
            .status(401)
            .json({ message: "You do not have access to make admin ativity" });
        }
      }
    });
  } catch {
    // client.close()
  }
}
run().catch(console.dir());

app.get("/", (req, res) => {
  res.send("Welcome to doctors portal server");
});

app.listen(port, () => {
  console.log(`Your server is running at port : http://localhost:${port}`);
});
