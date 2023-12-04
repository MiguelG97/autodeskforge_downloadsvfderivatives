const express = require("express");
const {
  getPublicToken,
  getInternalToken,
} = require("../services/forgeaps");

const authRouter = express.Router();
authRouter.get(
  "/auth/token",
  async (req, res) => {
    try {
      // res.json(await getPublicToken());
      res.json(await getInternalToken());
    } catch (error) {
      console.log(error);
      res.json(error);
    }
  }
);
module.exports = { authRouter };
