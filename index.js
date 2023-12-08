const express = require("express");
const cors = require("cors");
const {
  authRouter,
} = require("./routes/auth_route");
const {
  modelRoute,
} = require("./routes/model_route");
const {
  bubbleRouter,
} = require("./routes/bubble_route");

const app = express();

app.use(express.static("wwwroot"));
app.use(express.json());
app.use(cors());

app.use(authRouter);
app.use(modelRoute);
app.use(bubbleRouter);

app.listen(5050, () => {
  console.log("listening to port 5050...");
});

module.exports = app;
