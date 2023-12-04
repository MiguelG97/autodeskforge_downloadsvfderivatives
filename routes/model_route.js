const {
  listObjects,
  translateObject,
  uploadObject,
  urnify,
} = require("../services/forgeaps");
const express = require("express");
const modelRoute = express.Router();

modelRoute.get("/models", async (req, res) => {
  try {
    const objects = await listObjects();
    res.json(
      objects.map((o) => ({
        name: o.objectKey,
        urn: urnify(o.objectId),
      }))
    );
  } catch (error) {
    res.json(error);
  }
});
modelRoute.get(
  "/models/:urn/status",
  async (req, res) => {
    try {
      const { urn } = req.params;
      const manifest = await getManifest(urn);
      if (manifest) {
        let messages = [];

        if (manifest.derivatives) {
          for (const derivative of manifest.derivatives) {
            messages = messages.concat(
              derivative.messages || []
            );
            if (derivative.children) {
              for (const child of derivative.children) {
                messages.concat(
                  child.messages || []
                );
              }
            }
          }
        }
        res.json({
          status: manifest.status,
          progress: manifest.progress,
          messages,
        });
      } else {
        res.json({ status: "n/a" });
      }
    } catch (error) {
      res.json(error);
    }
  }
);

//Translate objects!
modelRoute.post("/models", async (req, res) => {
  const formData = await req.formData();
  const file = formData.get("model-file");
  if (!file) {
    res.json({
      message:
        'The required field ("model-file") is missing.',
    });
  }
  try {
    const obj = await uploadObject(
      file.name,
      file.path
    );
    const rootFileName = formData.get(
      "model-zip-entrypoint"
    );
    await translateObject(
      urnify(obj.objectId),
      rootFileName
    );
    res.json({
      name: obj.objectKey,
      urn: urnify(obj.objectId),
    });
  } catch (err) {
    re.json(err);
  }
});

module.exports = { modelRoute };
