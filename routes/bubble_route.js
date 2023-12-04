const express = require("express");
const path = require("path");
const ExtractorSvc = require("../services/bubble");
const axios = require("axios");
const { rmdir } = require("fs");
axios.defaults.baseURL = "http://localhost:5050/";

const bubbleRouter = express.Router();
// const urn =
//   "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6aXRpemJ1Y3ppYm00cG1wdHJ0ZWF0Z212bzRxMzRjYWstYmFzaWMtYXBwL3VuaXRSMTYyLnJ2dA";
const urn =
  "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YmltZGV2LWJ1Y2tldC80Nl9IQVJSSVNPTiUyMFNRVUFSRV9TdHVkaW8lMjBGJTIwQURBX0FzJTIwQnVpbHQlMjBXYWxrc2hlZXRfUFVSR0VEX1BVUkdFRF9BUFAucnZ0";
const dir = path.resolve(
  "downloadedsvf",
  `R16Template`
);

bubbleRouter.get("/bubble", async (req, res) => {
  const extractorSvc = new ExtractorSvc();
  const files = await extractorSvc.download(
    urn,
    dir
  );

  console.log(
    "download succeed! proceding with ziping the file"
  );

  //not neccessary the zip meanwhile
  // const zipfile = dir + ".zip";
  // const sth1 = await extractorSvc.createZip(
  //   dir,
  //   zipfile,
  //   "derivativesForge",
  //   files
  // );

  // rmdir(dir);//error with this one!
});
module.exports = { bubbleRouter };
