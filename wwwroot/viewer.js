/// import * as Autodesk from "@types/forge-viewer";
// import * as APS from "forge-apis"; //this is the issue with node js curves!!

export function initViewer(container) {
  const options = {
    api: "derivativeV2",
    env: "AutodeskProduction",
    getAccessToken: async function (
      onTokenReady
    ) {
      const resp = await fetch("/auth/token");

      if (!resp.ok) {
        throw new Error(await resp.text());
      }

      const { access_token, expires_in } =
        await resp.json();
      // console.log(access_token, expires_in);
      onTokenReady(access_token, expires_in);
    },
  };

  // const options = {
  //   env: "Local",
  //   document: "./public/manifest/output.svf",
  // };

  return new Promise(function (resolve, reject) {
    Autodesk.Viewing.Initializer(
      options,

      //callback when initialization finished
      function () {
        const config = {
          extensions: [
            "Autodesk.DocumentBrowser",
          ],
        };
        //at this point we can access the guiViewer3D

        const viewer =
          new Autodesk.Viewing.GuiViewer3D(
            container,
            config
          );
        const startedCode = viewer.start();
        if (startedCode > 0) {
          console.error(
            "Failed to create a viewer: webgl not supported"
          );
          reject(
            "Failed to create a viewer: webgl not supported"
          );
        }
        viewer.setTheme("light-theme");
        resolve(viewer);
      }
    );
  });
}

export function loadModel(viewer, urn) {
  return new Promise(function (resolve, reject) {
    viewer.setLightPreset(0);
    Autodesk.Viewing.Document.load(
      "urn:" + urn,
      onDocumentLoadSuccess,
      onDocumentLoadFailure
    );
    function onDocumentLoadSuccess(doc) {
      var bubbleNode = doc.getRoot(); //Bubble is a container of json nodes that represents 2D/3D viewables, 2D/3D geometry, sheets, data, etc.
      //This can be a
      var nodesArray = bubbleNode.search({
        type: "geometry",
      });
      let unitFloorPlanBubble = nodesArray.find(
        function (bubble) {
          return (
            bubble.data.name ===
              "Unit Floor Plan" ||
            bubble.data.name ==
              "SW - Unit Floor Plan"
          );
        }
      );
      console.log(
        bubbleNode.getDefaultGeometry()
      );
      if (unitFloorPlanBubble) {
        resolve(
          viewer.loadDocumentNode(
            doc,
            unitFloorPlanBubble
          )
        );
      } else {
        resolve(
          viewer.loadDocumentNode(
            doc,
            bubbleNode.getDefaultGeometry()
          )
        );
      }
    }
    function onDocumentLoadFailure(
      code,
      message,
      errors
    ) {
      reject({ code, message, errors });
    }
  });
}
