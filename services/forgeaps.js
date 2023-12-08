const fs = require("fs");
const APS = require("forge-apis");

//a) credentials[change them upper account]
// const APS_CLIENT_ID =
//   "itiZBuczIbM4PMPTRteAtGMvO4Q34cAK";
// const APS_CLIENT_SECRET = "AM2UhaffSs8zcFOF";

// const APS_BUCKET = `${APS_CLIENT_ID.toLowerCase()}-basic-app`;

const APS_CLIENT_ID =
  "Wf7RDimoQ5QMu1bCHc3kumOAI3kVSv8x";
const APS_CLIENT_SECRET = "WOxAeVRD6tw6pSa1";

const APS_BUCKET = "bimdev-bucket";

//b) get auth tokens!
let internalAuthClient =
  new APS.AuthClientTwoLegged(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [
      "bucket:read",
      "bucket:create",
      "data:read",
      "data:write",
      "data:create",
    ],
    true
  );
let publicAuthClient =
  new APS.AuthClientTwoLegged(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    ["viewables:read"],
    true
  );
const getInternalToken = async () => {
  if (!internalAuthClient.isAuthorized()) {
    await internalAuthClient.authenticate();
  }
  return internalAuthClient.getCredentials();
};

const getPublicToken = async () => {
  if (!publicAuthClient.isAuthorized()) {
    await publicAuthClient.authenticate();
  }
  // console.log(publicAuthClient.isAuthorized());
  return publicAuthClient.getCredentials();
};

//c)Object storage service CRUD: CREATE | GET | UPLOAD
//create a bucket if doesnt exist
const ensureBucketExists = async (bucketKey) => {
  try {
    await new APS.BucketsApi().getBucketDetails(
      bucketKey,
      null,
      await getInternalToken()
    );
  } catch (err) {
    if (err.response.status === 404) {
      await new APS.BucketsApi().createBucket(
        { bucketKey, policyKey: "persistent" },
        {},
        null,
        await getInternalToken()
      );
    } else {
      throw err;
    }
  }
};

const listObjects = async () => {
  await ensureBucketExists(APS_BUCKET);
  let resp =
    await new APS.ObjectsApi().getObjects(
      APS_BUCKET,
      { limit: 64 },
      null,
      await getInternalToken()
    );
  let objects = resp.body.items;
  while (resp.body.next) {
    const startAt = new URL(
      resp.body.next
    ).searchParams.get("startAt");
    resp = await new APS.ObjectsApi().getObjects(
      APS_BUCKET,
      { limit: 64, startAt },
      null,
      await getInternalToken()
    );
    objects = objects.concat(resp.body.items);
  }
  return objects;
};

const uploadObject = async (
  objectName,
  filePath
) => {
  await ensureBucketExists(APS_BUCKET);
  const buffer = await fs.promises.readFile(
    filePath
  );
  const results =
    await new APS.ObjectsApi().uploadResources(
      APS_BUCKET,
      [{ objectKey: objectName, data: buffer }],
      {
        useAcceleration: false,
        minutesExpiration: 15,
      },
      null,
      await getInternalToken()
    );
  if (results[0].error) {
    throw results[0].completed;
  } else {
    return results[0].completed;
  }
};

//d)Model derivative API: Translatate files
const translateObject = async (
  urn,
  rootFilename
) => {
  const job = {
    input: { urn },
    output: {
      formats: [
        { type: "svf", views: ["2d", "3d"] },
      ],
    },
  };
  if (rootFilename) {
    job.input.compressedUrn = true;
    job.input.rootFilename = rootFilename;
  }
  const resp =
    await new APS.DerivativesApi().translate(
      job,
      {},
      null,
      await getInternalToken()
    );
  return resp.body;
};

const getManifest = async (urn) => {
  try {
    //I believe this api is deprecated regarding docs!
    const resp =
      await new APS.DerivativesApi().getManifest(
        urn,
        {},
        null,
        await getInternalToken()
      );
    return resp.body;
  } catch (err) {
    if (err.response.status === 404) {
      return null;
    } else {
      throw err;
    }
  }
};

//extras
const urnify = (id) =>
  Buffer.from(id)
    .toString("base64")
    .replace(/=/g, "");

module.exports = {
  listObjects,
  translateObject,
  uploadObject,
  getManifest,
  getPublicToken,
  getInternalToken,
  urnify,
  ensureBucketExists,
};
