// import BaseSvc from "./BaseSvc";
var archiver = require("archiver");
var { mkdirp } = require("mkdirp");
var Forge = require("forge-apis");
var request = require("request");
var Zip = require("node-zip");
var Zlib = require("zlib");
var path = require("path");
var _ = require("lodash");
var fs = require("fs");
const {
  getInternalToken,
} = require("./forgeaps");
// var { dir } = require("console");

module.exports = class ExtractorSvc {
  //extends BaseSvc

  constructor(config) {
    // super(config);

    this.derivativesAPI =
      new Forge.DerivativesApi();
  }

  name() {
    return "ExtractorSvc";
  }

  /////////////////////////////////////////////////////////
  // download all URN resources to target directory
  // (unzipped)
  //
  /////////////////////////////////////////////////////////
  download(
    urn,
    directory //getToken function eliminated and token turns to be to the actual token auth json
  ) {
    return new Promise(
      async (resolve, reject) => {
        try {
          // get URN top level manifest
          const manifest =
            await this.derivativesAPI.getManifest(
              urn,
              {},
              null,
              await getInternalToken()
            );

          // harvest(gather,caching) derivatives:
          //a) Parse manifest -> body prop
          //manifest.body.derivates contains derivatives (svf, thumbnail)
          //derivative contains a children prop
          //children contains role,guid, urn, mime props
          //if role is included in a list of roles, then we build an item object that contains guid, mime and urn

          //b) depending upon mime prop, we get a specific derivative (svf, f2d, json.gz)
          // const items = this.parseManifest(
          //   manifest.body
          // );
          // const svfPaths = items.map((item) => {
          //   return item.urn.slice(
          //     item.basePath.length
          //   );
          // });
          // console.log(svfPaths);
          const derivatives =
            await this.getDerivatives(
              manifest.body
            );
          // console.log(derivatives);

          // format derivative resources
          const nestedDerivatives =
            derivatives.map((item) => {
              return item.files.map((file) => {
                const localPath = path.resolve(
                  directory,
                  item.localPath
                );
                return {
                  basePath: item.basePath,
                  guid: item.guid,
                  mime: item.mime,
                  fileName: file,
                  urn: item.urn,
                  localPath,
                };
              });
            });
          // console.log(nestedDerivatives);

          // flatten resources (./BaseSvc  where this comes from??)
          const derivativesList = _.flattenDeep(
            nestedDerivatives
          );
          // console.log(
          //   nestedDerivatives,
          //   derivativesList
          // );

          // creates async download tasks for each
          // derivative file
          const downloadTasks =
            derivativesList.map((derivative) => {
              return new Promise(
                async (resolve) => {
                  const urn = path.join(
                    derivative.basePath,
                    derivative.fileName
                  );
                  const data =
                    await this.getDerivative(
                      await getInternalToken(),
                      urn
                    );
                  // console.log(data);
                  const filename = path.resolve(
                    derivative.localPath,
                    derivative.fileName
                  );

                  await this.saveToDisk(
                    data,
                    filename
                  );

                  resolve(filename);
                }
              );
            });
          console.log(downloadTasks);

          // wait for all files to be downloaded
          const files = await Promise.all(
            downloadTasks
          );
          resolve(files);
        } catch (error) {
          console.log("Miguelg", error);
        }
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Parse top level manifest to collect derivatives
  //
  /////////////////////////////////////////////////////////
  parseManifest(manifestBody) {
    const items = [];

    const parseNodeRec = (node) => {
      const roles = [
        "Autodesk.CloudPlatform.DesignDescription",
        "Autodesk.CloudPlatform.PropertyDatabase",
        "Autodesk.CloudPlatform.IndexableContent",
        "leaflet-zip",
        "thumbnail",
        "graphics",
        "preview",
        "raas",
        "pdf",
        "lod",
      ];

      if (roles.includes(node.role)) {
        const item = {
          guid: node.guid,
          mime: node.mime,
        };

        const pathInfo = this.getPathInfo(
          node.urn
        );

        items.push(
          Object.assign({}, item, pathInfo)
        );
      }

      //infinite loop until as long as the node.children exists!
      if (node.children) {
        node.children.forEach((child) => {
          parseNodeRec(child);
        });
      }
    };

    //infinite loop until as long as the node.children exists!
    parseNodeRec({
      children: manifestBody.derivatives,
    });

    return items;
  }

  /////////////////////////////////////////////////////////
  // Collect derivatives for SVF
  //
  /////////////////////////////////////////////////////////
  getSVFDerivatives(item) {
    return new Promise(
      async (resolve, reject) => {
        try {
          const svfPath = item.urn.slice(
            item.basePath.length
          );

          const files = [svfPath];

          const data = await this.getDerivative(
            await getInternalToken(),
            item.urn
          );

          const pack = new Zip(data, {
            checkCRC32: true,
            base64: false,
          });

          // const manifestData =
          //   pack.files[
          //     "manifest.json"
          //   ].asNodeBuffer();
          const manifestData =
            pack.files["manifest.json"];
          // const manifestBuffer = Buffer.from(
          //   JSON.stringify(manifestData),
          //   "utf8"
          // );
          // const manifest = JSON.parse(
          //   manifestData.toString("utf8")
          // );
          // JSON.parse(
          //   manifestBuffer.toString("utf-8")
          // )
          const datajson = JSON.parse(
            manifestData.data
          );

          if (datajson.assets) {
            datajson.assets.forEach((asset) => {
              // Skip SVF embedded resources
              if (
                asset.URI.indexOf("embed:/") === 0
              ) {
                return;
              }

              files.push(asset.URI);
            });
          }

          return resolve(
            Object.assign({}, item, {
              files,
            })
          );
        } catch (ex) {
          reject(ex);
        }
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Collect derivatives for F2D
  //
  /////////////////////////////////////////////////////////
  getF2dDerivatives(getToken, item) {
    return new Promise(
      async (resolve, reject) => {
        try {
          const files = ["manifest.json.gz"];

          const manifestPath =
            item.basePath + "manifest.json.gz";

          const data = await this.getDerivative(
            getToken,
            manifestPath
          );

          const manifestData =
            Zlib.gunzipSync(data);

          const manifest = JSON.parse(
            manifestData.toString("utf8")
          );

          if (manifest.assets) {
            manifest.assets.forEach((asset) => {
              // Skip SVF embedded resources
              if (
                asset.URI.indexOf("embed:/") === 0
              ) {
                return;
              }

              files.push(asset.URI);
            });
          }

          return resolve(
            Object.assign({}, item, {
              files,
            })
          );
        } catch (ex) {
          reject(ex);
        }
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Get all derivatives from top level manifest
  //
  /////////////////////////////////////////////////////////
  getDerivatives(manifestBody) {
    return new Promise(
      async (resolve, reject) => {
        const items =
          this.parseManifest(manifestBody);

        const derivativeTasks = items.map(
          async (item) => {
            switch (item.mime) {
              case "application/autodesk-svf":
                return this.getSVFDerivatives(
                  item
                );

              case "application/autodesk-f2d":
                return this.getF2dDerivatives(
                  await getInternalToken(),
                  item
                );

              case "application/autodesk-db":
                return Promise.resolve(
                  Object.assign({}, item, {
                    files: [
                      "objects_attrs.json.gz",
                      "objects_vals.json.gz",
                      "objects_offs.json.gz",
                      "objects_ids.json.gz",
                      "objects_avs.json.gz",
                      item.rootFileName,
                    ],
                  })
                );

              default:
                return Promise.resolve(
                  Object.assign({}, item, {
                    files: [item.rootFileName],
                  })
                );
            }
          }
        );

        const derivatives = await Promise.all(
          derivativeTasks
        );

        return resolve(derivatives);
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Generate path information from URN
  //
  /////////////////////////////////////////////////////////
  getPathInfo(encodedURN) {
    const urn = decodeURIComponent(encodedURN);

    const rootFileName = urn.slice(
      urn.lastIndexOf("/") + 1
    );

    const basePath = urn.slice(
      0,
      urn.lastIndexOf("/") + 1
    );

    const localPathTmp = basePath.slice(
      basePath.indexOf("/") + 1
    );

    const localPath = localPathTmp.replace(
      /^output\//,
      ""
    );

    return {
      rootFileName,
      localPath,
      basePath,
      urn,
    };
  }

  /////////////////////////////////////////////////////////
  // Get derivative data for specific URN
  //
  /////////////////////////////////////////////////////////
  getDerivative(getToken, urn) {
    return new Promise(
      async (resolve, reject) => {
        const baseUrl =
          "https://developer.api.autodesk.com/";

        const url =
          baseUrl +
          `derivativeservice/v2/derivatives/${urn}`; //deprecated??

        const token = await getInternalToken();

        request(
          {
            url,
            method: "GET",
            headers: {
              Authorization:
                "Bearer " + token.access_token,
              "Accept-Encoding": "gzip, deflate",
            },
            encoding: null,
          },
          (err, response, body) => {
            if (err) {
              return reject(err);
            }

            if (body && body.errors) {
              return reject(body.errors);
            }

            if (
              [200, 201, 202].indexOf(
                response.statusCode
              ) < 0
            ) {
              return reject(response);
            }

            return resolve(body || {});
          }
        );
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Save data to disk
  //
  /////////////////////////////////////////////////////////
  saveToDisk(data, filename) {
    return new Promise(
      async (resolve, reject) => {
        //watchout! we need to create directories and not directories with full filname!!
        const mkRes = await mkdirp(
          path.dirname(filename)
        );

        //returns undefined if it was already created! || it can happen we are looping with the same filename so we get undefined
        if (mkRes === undefined) {
          // console.log(filename);
        }

        const ext = path.extname(filename);

        const wstream =
          fs.createWriteStream(filename);

        wstream.on("finish", () => {
          resolve();
        });

        if (
          typeof data === "object" &&
          ext === ".json"
        ) {
          wstream.write(JSON.stringify(data));
        } else {
          wstream.write(data);
        }

        wstream.end();
      }
    );
  }

  /////////////////////////////////////////////////////////
  // Create a zip
  //
  /////////////////////////////////////////////////////////
  createZip(rootDir, zipfile, zipRoot, files) {
    return new Promise((resolve, reject) => {
      try {
        const output =
          fs.createWriteStream(zipfile);

        const archive = archiver("zip");

        output.on("close", () => {
          resolve();
        });

        archive.on("error", (err) => {
          reject(err);
        });

        archive.pipe(output);

        if (files) {
          files.forEach((file) => {
            try {
              const rs =
                fs.createReadStream(file);

              archive.append(rs, {
                name: `${zipRoot}/${file.replace(
                  rootDir,
                  ""
                )}`,
              });
            } catch (ex) {
              console.log(ex);
            }
          });
        } else {
          archive.bulk([
            {
              expand: false,
              src: [rootDir + "/*"],
            },
          ]);
        }

        archive.finalize();
      } catch (ex) {
        reject(ex);
      }
    });
  }
};
